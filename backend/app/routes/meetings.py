from flask import Blueprint, jsonify, request, current_app
from app.models import db, User, Meeting, Availability, MeetingPresence
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime, time as dtime, timedelta, timezone
from stream_chat import StreamChat
from flask_cors import cross_origin
from zoneinfo import ZoneInfo
import re

meetings_bp = Blueprint('meetings', __name__)
DEFAULT_DURATION_MIN = 30

def _tz():
    name = current_app.config.get("APP_TIMEZONE", "America/Panama")
    try:
        return ZoneInfo(name)
    except Exception:
        return ZoneInfo("UTC")

# ==========================
#  Normalización de horarios
# ==========================
_HHMM_AMPM_RE = re.compile(r'^\s*(\d{1,2})(?::(\d{2}))?\s*([ap]m)\s*$', re.IGNORECASE)
_HHMM_24H_RE  = re.compile(r'^\s*(\d{1,2}):(\d{2})(?::\d{2})?\s*$')

def _parse_time_components(s):
    if not s:
        return (0, 0)
    raw = str(s).strip().lower()

    m = _HHMM_AMPM_RE.match(raw)
    if m:
        hh = int(m.group(1))
        mi = int(m.group(2) or 0)
        ap = m.group(3)
        if ap == 'am':
            if hh == 12: hh = 0
        else:
            if hh < 12: hh += 12
        return (hh, mi)

    m = _HHMM_24H_RE.match(raw)
    if m:
        return (int(m.group(1)), int(m.group(2)))

    return (0, 0)

def _canonical_slot_str(s):
    h24, mi = _parse_time_components(s)
    ampm = "AM" if h24 < 12 else "PM"
    h12 = h24 % 12
    if h12 == 0: h12 = 12
    return f"{h12}:{mi:02d} {ampm}"

def _slot_minutes(s) -> int:
    h, m = _parse_time_components(s)
    return h * 60 + m

def _normalize_slots_list(slots):
    if not isinstance(slots, list):
        return []
    canon = {_canonical_slot_str(x) for x in slots if x}
    return sorted(canon, key=_slot_minutes)

def _parse_time_str(s: str) -> dtime:
    h, m = _parse_time_components(s)
    return dtime(h, m)

def _start_datetime(meeting: Meeting) -> datetime:
    mt = _parse_time_str(getattr(meeting, 'meeting_time', '00:00'))
    md = getattr(meeting, 'meeting_date', None)
    if isinstance(md, datetime):
        md = md.date()
    dt = datetime.combine(md, mt)
    return dt.replace(tzinfo=_tz())

def _is_join_window(meeting: Meeting, now: datetime = None, duration_min: int = None) -> bool:
    now = now or datetime.now(_tz())
    duration = duration_min or getattr(meeting, 'duration', DEFAULT_DURATION_MIN) or DEFAULT_DURATION_MIN
    start_dt = _start_datetime(meeting)
    end_dt = start_dt + timedelta(minutes=duration)
    return (now >= start_dt - timedelta(minutes=10)) and (now < end_dt)

def _all_canonical_slots():
    out = []
    for hour in range(24):
        for minute in (0, 30):
            ampm = "PM" if hour >= 12 else "AM"
            display_hour = hour % 12 or 12
            out.append(f"{display_hour}:{minute:02d} {ampm}")
    return out

def get_next_slot(time_slot_str: str):
    try:
        all_slots = _all_canonical_slots()
        norm = _canonical_slot_str(time_slot_str)
        idx = all_slots.index(norm)
        if idx + 1 < len(all_slots):
            return all_slots[idx + 1]
    except (ValueError, IndexError):
        pass
    return None

def _stream_user_id_from_user(user: User, fallback_id) -> str:
    raw = (getattr(user, 'email', None) or str(getattr(user, 'id', None) or fallback_id)).lower()
    return re.sub(r'[^a-z0-9_@-]', '_', raw)

def _get_stream_client():
    api_key = current_app.config.get("STREAM_API_KEY")
    api_secret = current_app.config.get("STREAM_API_SECRET")
    if not api_key or not api_secret:
        return None, None, None
    sc = StreamChat(api_key=api_key, api_secret=api_secret)
    return sc, api_key, api_secret

def _normalize_avatar_path(user: User):
    val = getattr(user, 'profile_picture_url', None) or getattr(user, 'avatar', None)
    if not val:
        return None
    val = str(val)
    if val.startswith("http://") or val.startswith("https://"):
        return val
    val = val.lstrip("/")
    if val.startswith("uploads/"):
        return "/" + val
    return f"/uploads/{val}"

def _as_int(x):
    try:
        return int(x)
    except (TypeError, ValueError):
        return x

def _authorized_to_modify(meeting: Meeting, uid):
    uid_int = _as_int(uid)
    if isinstance(uid_int, int) and uid_int in (meeting.client_id, meeting.lawyer_id):
        return True
    user = User.query.get(uid_int) if isinstance(uid_int, int) else None
    if user and user.role in ('admin', 'backoffice'):
        return True
    return False

# ---------- NUEVO: parser “relajado” de fecha ----------
def parse_date_loose(value):
  """
  Acepta 'YYYY-MM-DD' o ISO ('2025-08-16T05:00:00Z' / con offset).
  Devuelve date (naive) usando solo el día.
  """
  if isinstance(value, str):
      v = value.strip()
      # 1) ideal: YYYY-MM-DD
      try:
          return datetime.strptime(v[:10], '%Y-%m-%d').date()
      except Exception:
          pass
      # 2) ISO con / sin 'Z'
      try:
          v2 = v.replace('Z', '+00:00')
          dt = datetime.fromisoformat(v2)
          if dt.tzinfo is None:
              return dt.date()
          return dt.astimezone(timezone.utc).date()
      except Exception:
          pass
  raise ValueError("Fecha inválida")
# -------------------------------------------------------

@meetings_bp.route('/api/meetings', methods=['POST'])
@jwt_required()
def create_meeting():
    client_id = int(get_jwt_identity())
    data = request.get_json() or {}
    lawyer_id = data.get('lawyer_id')
    date_str = data.get('date')
    time_slot = data.get('time')

    if not all([lawyer_id, date_str, time_slot]):
        return jsonify({'message': 'Faltan datos para crear la reunión'}), 400

    try:
        date_obj = parse_date_loose(date_str)   # <- usa parser tolerante
    except ValueError:
        return jsonify({'message': 'Formato de fecha inválido, usa YYYY-MM-DD'}), 400

    availability_entry = Availability.query.filter_by(lawyer_id=lawyer_id, date=date_obj).first()
    if not availability_entry:
        return jsonify({'message': 'El horario seleccionado ya no está disponible. Por favor, elige otro.'}), 409

    slot_norm = _canonical_slot_str(time_slot)
    avail_norm = _normalize_slots_list(availability_entry.time_slots or [])

    if slot_norm not in avail_norm:
        return jsonify({'message': 'El horario seleccionado ya no está disponible. Por favor, elige otro.'}), 409

    slot2 = get_next_slot(slot_norm)
    to_remove = {slot_norm}
    if slot2:
        to_remove.add(slot2)

    availability_entry.time_slots = [s for s in availability_entry.time_slots if _canonical_slot_str(s) not in to_remove]

    lawyer = User.query.get(lawyer_id)
    consulta_price = 0.0
    if lawyer and getattr(lawyer, 'consultation_price', None) is not None:
        try:
            consulta_price = float(lawyer.consultation_price)
        except (TypeError, ValueError):
            consulta_price = 0.0
    price_cents = int(round(consulta_price * 100))

    meeting = Meeting(
        client_id=client_id,
        lawyer_id=lawyer_id,
        meeting_date=date_obj,
        meeting_time=slot_norm,
        status='confirmada',
        price_at_booking_cents=price_cents,
        currency='USD',
    )
    db.session.add(meeting)
    db.session.commit()

    return jsonify({'message': 'Reunión creada y horario bloqueado exitosamente'}), 201

@meetings_bp.route('/api/meetings', methods=['GET'])
@jwt_required()
def get_meetings():
    user_id = int(get_jwt_identity())
    current_user = User.query.get(user_id)
    if not current_user:
        return jsonify([]), 200

    if current_user.role == 'cliente':
        meetings_query = Meeting.query.filter_by(client_id=user_id).order_by(Meeting.meeting_date.desc()).all()
    elif current_user.role == 'abogado':
        meetings_query = Meeting.query.filter_by(lawyer_id=user_id).order_by(Meeting.meeting_date.desc()).all()
    else:
        return jsonify([]), 200

    meetings_list = []
    for m in meetings_query:
        other_id = m.lawyer_id if current_user.role == 'cliente' else m.client_id
        other_user = User.query.get(other_id)
        duration = getattr(m, 'duration', None) or DEFAULT_DURATION_MIN

        if other_user:
            stream_uid = _stream_user_id_from_user(other_user, other_id)
            other_name = f"{getattr(other_user, 'nombres', '')} {getattr(other_user, 'apellidos', '')}".strip()
            other_role = getattr(other_user, 'role', None)
            other_avatar = _normalize_avatar_path(other_user)
        else:
            stream_uid = None
            other_name = ""
            other_role = None
            other_avatar = None

        price_cents = int(getattr(m, 'price_at_booking_cents', 0) or 0)
        currency = getattr(m, 'currency', 'USD') or 'USD'

        meetings_list.append({
            'id': m.id,
            'date': m.meeting_date.strftime('%Y-%m-%d'),
            'time': _canonical_slot_str(m.meeting_time),
            'duration': duration,
            'status': getattr(m, 'status', 'confirmada'),
            'price_cents': price_cents,
            'price': price_cents / 100.0,
            'currency': currency,
            'with_user': {
                'id': other_id,
                'stream_id': stream_uid,
                'name': other_name,
                'role': other_role,
                'avatar': other_avatar,
            }
        })

    return jsonify(meetings_list), 200

@meetings_bp.route('/api/chat/users/ensure/<int:other_user_id>', methods=['POST'])
@jwt_required()
def ensure_stream_user(other_user_id):
    me_id = int(get_jwt_identity())
    has_meeting = Meeting.query.filter(
        ((Meeting.client_id == me_id) & (Meeting.lawyer_id == other_user_id)) |
        ((Meeting.client_id == other_user_id) & (Meeting.lawyer_id == me_id))
    ).first()
    if not has_meeting:
        return jsonify({'ok': False, 'message': 'No autorizado'}), 403

    other = User.query.get(other_user_id)
    if not other:
        return jsonify({'ok': False, 'message': 'Usuario no encontrado'}), 404

    sc, api_key, api_secret = _get_stream_client()
    if not sc:
        return jsonify({'ok': False, 'message': 'STREAM_API_KEY/SECRET faltantes'}), 500

    stream_id = _stream_user_id_from_user(other, other_user_id)
    name = f"{getattr(other, 'nombres', '')} {getattr(other, 'apellidos', '')}".strip()
    image_path = _normalize_avatar_path(other)
    payload = {"id": stream_id, "name": (name or f"user_{stream_id}") }
    if image_path:
        payload["image"] = image_path
    sc.upsert_user(payload)
    return jsonify({'ok': True, 'stream_id': stream_id}), 200

@meetings_bp.route('/api/meetings/<int:meeting_id>/can-join', methods=['GET'])
@jwt_required()
def can_join(meeting_id):
    uid = int(get_jwt_identity())
    meeting = Meeting.query.get(meeting_id)
    if not meeting:
        return jsonify({'allowed': False, 'message': 'Reunión not encontrada'}), 404
    if uid not in (meeting.client_id, meeting.lawyer_id):
        return jsonify({'allowed': False, 'message': 'No autorizado'}), 403
    allowed = _is_join_window(meeting)
    return jsonify({'allowed': allowed}), 200

@meetings_bp.route('/api/meetings/<int:meeting_id>/status', methods=['PATCH'])
@jwt_required()
def update_meeting_status(meeting_id):
    uid = int(get_jwt_identity())
    meeting = Meeting.query.get(meeting_id)
    if not meeting:
        return jsonify({'message': 'Reunión no encontrada'}), 404
    if uid not in (meeting.client_id, meeting.lawyer_id):
        return jsonify({'message': 'No autorizado'}), 403
    data = request.get_json(silent=True) or {}
    new_status = data.get('status')
    valid_status = {'confirmada', 'por-comenzar', 'iniciada', 'finalizada'}
    if new_status not in valid_status:
        return jsonify({'message': 'Estado inválido'}), 400
    meeting.status = new_status
    db.session.commit()
    return jsonify({'ok': True}), 200

@meetings_bp.route('/api/meeting/<int:meeting_id>/video', methods=['GET', 'OPTIONS'])
@cross_origin(
    origins=['http://localhost:3000'],
    supports_credentials=True,
    methods=['GET', 'OPTIONS'],
    allow_headers=['Authorization', 'Content-Type'],
    expose_headers=['Authorization', 'Content-Type'],
    max_age=86400,
)
@jwt_required()
def meeting_video_join_info(meeting_id):
    identity = get_jwt_identity()
    try:
        uid_int = int(identity)
    except (TypeError, ValueError):
        uid_int = identity

    meeting = Meeting.query.get(meeting_id)
    if not meeting:
        return jsonify({"error": "meeting not found"}), 404
    if str(meeting.client_id) != str(uid_int) and str(meeting.lawyer_id) != str(uid_int):
        return jsonify({"error": "forbidden"}), 403
    if getattr(meeting, "status", "confirmada") not in ("confirmada", "paid", "confirmed", "por-comenzar", "iniciada"):
        return jsonify({"error": "meeting not paid/confirmed"}), 402
    if not _is_join_window(meeting):
        return jsonify({"error": "not in join window (available 10 minutes before start)"}), 403

    sc, api_key, api_secret = _get_stream_client()
    if not sc:
        return jsonify({"error": "stream creds missing"}), 500

    user = User.query.get(uid_int) if isinstance(uid_int, int) else None
    stream_user_id = _stream_user_id_from_user(user, uid_int)
    token = sc.create_token(stream_user_id)
    call_id = f"meeting_{meeting.id}"

    return jsonify({
        "apiKey": api_key,
        "token": token,
        "callId": call_id,
        "userId": stream_user_id
    }), 200

@meetings_bp.route('/api/reuniones/<int:meeting_id>', methods=['GET'])
@jwt_required()
def get_meeting(meeting_id):
    m = Meeting.query.get(meeting_id)
    if not m:
        return jsonify({'message':'Reunión no encontrada'}), 404
    uid = int(get_jwt_identity())
    if uid not in [m.client_id, m.lawyer_id]:
        return jsonify({'message':'No autorizado'}), 403
    duration = getattr(m, 'duration', None) or DEFAULT_DURATION_MIN
    price_cents = int(getattr(m, 'price_at_booking_cents', 0) or 0)
    currency = getattr(m, 'currency', 'USD') or 'USD'
    return jsonify({
        'id': m.id,
        'meeting_date': m.meeting_date.isoformat(),
        'meeting_time': _canonical_slot_str(m.meeting_time),
        'status': getattr(m, 'status', 'confirmada'),
        'client_id': m.client_id,
        'lawyer_id': m.lawyer_id,
        'duration': duration,
        'price_cents': price_cents,
        'price': price_cents / 100.0,
        'currency': currency,
    }), 200

@meetings_bp.route('/api/meetings/<int:meeting_id>/presence/join', methods=['POST'])
@jwt_required()
def meeting_presence_join(meeting_id):
    uid = _as_int(get_jwt_identity())
    meeting = Meeting.query.get_or_404(meeting_id)
    if not _authorized_to_modify(meeting, uid):
        return jsonify({'message': 'No autorizado'}), 403

    user = User.query.get_or_404(uid) if isinstance(uid, int) else None
    pres = MeetingPresence.query.filter_by(meeting_id=meeting_id, user_id=uid).first()
    if not pres:
        pres = MeetingPresence(meeting_id=meeting_id, user_id=uid, role=(user.role if user else None))
        db.session.add(pres)

    pres.joined_at = datetime.utcnow()
    db.session.commit()
    return jsonify({'ok': True, 'joined_at': pres.joined_at.isoformat()}), 200

@meetings_bp.route('/api/meetings/<int:meeting_id>/presence/leave', methods=['POST'])
@jwt_required()
def meeting_presence_leave(meeting_id):
    uid = _as_int(get_jwt_identity())
    meeting = Meeting.query.get_or_404(meeting_id)
    if not _authorized_to_modify(meeting, uid):
        return jsonify({'message': 'No autorizado'}), 403

    pres = MeetingPresence.query.filter_by(meeting_id=meeting_id, user_id=uid).first()
    if not pres:
        user = User.query.get(uid) if isinstance(uid, int) else None
        pres = MeetingPresence(meeting_id=meeting_id, user_id=uid, role=(user.role if user else None))
        db.session.add(pres)

    pres.left_at = datetime.utcnow()
    db.session.commit()
    return jsonify({'ok': True, 'left_at': pres.left_at.isoformat()}), 200

@meetings_bp.route('/api/meetings/<int:meeting_id>/finish', methods=['POST'])
@jwt_required()
def meeting_finish(meeting_id):
    uid = _as_int(get_jwt_identity())
    meeting = Meeting.query.get_or_404(meeting_id)
    if not _authorized_to_modify(meeting, uid):
        return jsonify({'message': 'No autorizado'}), 403

    if meeting.status.lower() in ('completada', 'cancelada'):
        return jsonify({'id': meeting.id, 'status': meeting.status}), 200

    presences = MeetingPresence.query.filter_by(meeting_id=meeting_id).all()
    has_client = any(p.role == 'cliente'  and p.joined_at for p in presences)
    has_lawyer = any(p.role == 'abogado' and p.joined_at for p in presences)

    if has_client and has_lawyer:
        meeting.status = 'completada'
    db.session.commit()
    return jsonify({'id': meeting.id, 'status': meeting.status}), 200
