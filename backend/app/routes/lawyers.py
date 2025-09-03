import os
from flask import Blueprint, jsonify, request, send_from_directory
from app.models import db, User, Availability, LawyerGalleryImage, LawyerIntroVideo
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename
from datetime import datetime
import re

lawyers_bp = Blueprint('lawyers', __name__)

UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'uploads')
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'webp'}


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


# ==========================
#  Normalización de horarios
# ==========================
_HHMM_AMPM_RE = re.compile(r'^\s*(\d{1,2})(?::(\d{2}))?\s*([ap]m)\s*$', re.IGNORECASE)
_HHMM_24H_RE = re.compile(r'^\s*(\d{1,2}):(\d{2})(?::\d{2})?\s*$')


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
            if hh == 12:
                hh = 0
        else:
            if hh < 12:
                hh += 12
        return (hh, mi)
    m = _HHMM_24H_RE.match(raw)
    if m:
        return (int(m.group(1)), int(m.group(2)))
    return (0, 0)


def _canonical_slot_str(s):
    h24, mi = _parse_time_components(s)
    ampm = "AM" if h24 < 12 else "PM"
    h12 = h24 % 12 or 12
    return f"{h12}:{mi:02d} {ampm}"


def _slot_minutes(s) -> int:
    h, m = _parse_time_components(s)
    return h * 60 + m


def _normalize_slots_list(slots):
    if not isinstance(slots, list):
        return []
    canon = {_canonical_slot_str(x) for x in slots if x}
    return sorted(canon, key=_slot_minutes)


# ==========================
#  ESPECIALIDADES
# ==========================
# 1) Estático (igual a la web) – fuente estable para clientes
STATIC_SPECIALTIES = [
    "Laboral", "Familia", "Migratorio", "Penal", "Civil", "Mercantil", "Administrativo",
]


@lawyers_bp.route('/api/specialties', methods=['GET'])
def specialties_static():
    """Lista fija para clientes (mobile/web)."""
    return jsonify(STATIC_SPECIALTIES), 200


# 2) Dinámico (derivado de la DB, como venías usando)
def _unique_case_preserving(names):
    seen = set()
    out = []
    for n in names or []:
        key = (n or "").strip()
        if not key:
            continue
        low = key.lower()
        if low in seen:
            continue
        seen.add(low)
        out.append(key)
    return sorted(out, key=lambda s: s.lower())


@lawyers_bp.route('/api/lawyers/specialties', methods=['GET'])
def specialties_from_db():
    """Lista construida a partir de User.especialidad (abogados) en la DB."""
    try:
        rows = db.session.query(User.especialidad).filter(User.role == 'abogado').all()
        tokens = []
        for (raw,) in rows:
            if not raw:
                continue
            for part in re.split(r'[,/;|]', str(raw)):
                name = part.strip()
                if name:
                    tokens.append(name)
        return jsonify(_unique_case_preserving(tokens)), 200
    except Exception:
        return jsonify([]), 200


# ==========================
#  Resto de endpoints
# ==========================
@lawyers_bp.route('/api/abogados/<especialidad>', methods=['GET'])
def get_abogados_por_especialidad(especialidad):
    abogados = User.query.filter(
        User.role == 'abogado',
        User.is_approved.is_(True),
        User.is_active.is_(True),
        User.especialidad.ilike(f'%{especialidad}%')
    ).all()
    lista_abogados = [{
        'id': abogado.id,
        'nombres': abogado.nombres,
        'apellidos': abogado.apellidos,
        'especialidad': abogado.especialidad,
        'about_me': abogado.about_me,
        'profile_picture_url': abogado.profile_picture_url,
        'consultation_price': abogado.consultation_price
    } for abogado in abogados]
    return jsonify(lista_abogados), 200


@lawyers_bp.route('/api/lawyer/profile', methods=['GET'])
@jwt_required()
def get_lawyer_profile():
    user_id = int(get_jwt_identity())
    lawyer = User.query.get(user_id)
    if not lawyer or lawyer.role != 'abogado':
        return jsonify({'message': 'Perfil no encontrado o no autorizado'}), 404
    return jsonify({
        'nombres': lawyer.nombres,
        'apellidos': lawyer.apellidos,
        'especialidad': lawyer.especialidad,
        'about_me': lawyer.about_me,
        'titles': lawyer.titles,
        'profile_picture_url': lawyer.profile_picture_url,
        'consultation_price': lawyer.consultation_price
    }), 200


@lawyers_bp.route('/api/lawyer/profile', methods=['PUT'])
@jwt_required()
def update_lawyer_profile():
    user_id = int(get_jwt_identity())
    lawyer = User.query.get(user_id)
    if not lawyer or lawyer.role != 'abogado':
        return jsonify({'message': 'Perfil no encontrado o no autorizado'}), 404
    data = request.get_json()
    lawyer.about_me = data.get('about_me', lawyer.about_me)
    lawyer.titles = data.get('titles', lawyer.titles)
    lawyer.consultation_price = data.get('consultation_price', lawyer.consultation_price)
    db.session.commit()
    return jsonify({'message': 'Perfil actualizado exitosamente'}), 200


@lawyers_bp.route('/api/lawyer/profile/upload-picture', methods=['POST'])
@jwt_required()
def upload_profile_picture():
    user_id = int(get_jwt_identity())
    lawyer = User.query.get(user_id)
    if not lawyer or lawyer.role != 'abogado':
        return jsonify({'message': 'No autorizado'}), 403
    if 'profile_picture' not in request.files:
        return jsonify({'message': 'No se encontró el archivo'}), 400
    file = request.files['profile_picture']
    if file.filename == '':
        return jsonify({'message': 'No se seleccionó ningún archivo'}), 400
    if file and allowed_file(file.filename):
        file_ext = os.path.splitext(file.filename)[1]
        filename = secure_filename(f"user_{user_id}{file_ext}")
        filepath = os.path.join(UPLOAD_FOLDER, filename)
        try:
            file.save(filepath)
            lawyer.profile_picture_url = filename
            db.session.commit()
            return jsonify({'message': 'Foto de perfil actualizada', 'filepath': filename}), 200
        except Exception as e:
            db.session.rollback()
            return jsonify({'message': f'Error al guardar el archivo: {str(e)}'}), 500
    return jsonify({'message': 'Tipo de archivo no permitido'}), 400


@lawyers_bp.route('/uploads/<path:filename>')
def uploaded_file(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)


@lawyers_bp.route('/api/abogado/perfil/<int:abogado_id>', methods=['GET'])
def get_public_lawyer_profile(abogado_id):
    abogado = User.query.get(abogado_id)
    if not abogado or abogado.role != 'abogado' or not abogado.is_approved or not abogado.is_active:
        return jsonify({'message': 'Abogado no encontrado o no disponible'}), 404
    return jsonify({
        'id': abogado.id,
        'nombres': abogado.nombres,
        'apellidos': abogado.apellidos,
        'especialidad': abogado.especialidad,
        'about_me': abogado.about_me,
        'titles': abogado.titles,
        'profile_picture_url': abogado.profile_picture_url,
        'consultation_price': abogado.consultation_price
    }), 200


@lawyers_bp.route('/api/lawyer/availability', methods=['GET'])
@jwt_required()
def get_availability():
    user_id = int(get_jwt_identity())
    availabilities = Availability.query.filter_by(lawyer_id=user_id).all()
    availability_map = {
        item.date.strftime('%Y-%m-%d'): _normalize_slots_list(item.time_slots)
        for item in availabilities
    }
    return jsonify(availability_map), 200


@lawyers_bp.route('/api/lawyer/availability', methods=['POST'])
@jwt_required()
def set_availability():
    user_id = int(get_jwt_identity())
    print(f"--- Intentando guardar disponibilidad para user_id: {user_id} ---")

    lawyer = User.query.get(user_id)
    if not lawyer or lawyer.role != 'abogado':
        print(f"ERROR: El usuario con id {user_id} no es un abogado válido.")
        return jsonify({'message': 'Usuario no es un abogado válido'}), 403

    data = request.get_json()
    date_str = data.get('date')
    time_slots = data.get('time_slots')
    print(f"Datos recibidos del frontend: date='{date_str}', slots={time_slots}")

    if not date_str or time_slots is None:
        return jsonify({'message': 'Faltan la fecha o los horarios'}), 400

    try:
        date_obj = datetime.strptime(date_str, '%Y-%m-%d').date()

        # Normalizar/ordenar/depurar antes de guardar
        cleaned_slots = _normalize_slots_list(time_slots)

        availability_entry = Availability.query.filter_by(lawyer_id=user_id, date=date_obj).first()
        if availability_entry:
            print(f"Actualizando entrada existente para la fecha {date_str}")
            availability_entry.time_slots = cleaned_slots
        else:
            print(f"Creando NUEVA entrada para la fecha {date_str}")
            availability_entry = Availability(lawyer_id=user_id, date=date_obj, time_slots=cleaned_slots)
            db.session.add(availability_entry)

        db.session.commit()
        print("--- ¡COMMIT EXITOSO! La disponibilidad fue guardada en la DB. ---")
        return jsonify({'message': 'Disponibilidad guardada exitosamente'}), 200

    except Exception as e:
        db.session.rollback()
        print(f"!!!!!! ERROR DURANTE EL PROCESO DE GUARDADO: {str(e)} !!!!!!")
        return jsonify({'message': f"Error en la base de datos: {str(e)}"}), 500


@lawyers_bp.route('/api/abogado/availability/<int:abogado_id>', methods=['GET'])
def get_lawyer_public_availability(abogado_id):
    abogado = User.query.filter_by(id=abogado_id, role='abogado', is_approved=True, is_active=True).first()
    if not abogado:
        return jsonify({'message': 'Abogado no encontrado o no disponible'}), 404
    availabilities = Availability.query.filter_by(lawyer_id=abogado_id).all()
    availability_map = {
        item.date.strftime('%Y-%m-%d'): _normalize_slots_list(item.time_slots)
        for item in availabilities
    }
    return jsonify(availability_map), 200


@lawyers_bp.route('/api/lawyer/gallery', methods=['GET'])
@jwt_required()
def my_gallery():
    uid = int(get_jwt_identity())
    imgs = LawyerGalleryImage.query.filter_by(lawyer_id=uid).order_by(LawyerGalleryImage.created_at.desc()).all()
    return jsonify([{'id': i.id, 'filename': i.filename, 'url': f'/uploads/{i.filename}'} for i in imgs]), 200


@lawyers_bp.route('/api/lawyer/gallery/upload', methods=['POST'])
@jwt_required()
def my_gallery_upload():
    uid = int(get_jwt_identity())
    files = request.files.getlist('images')
    if not files:
        return jsonify({'message': 'No files'}), 400
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    saved = 0
    for f in files:
        if not f or not f.filename:
            continue
        ext = f.filename.rsplit('.', 1)[-1].lower()
        if ext not in {'png', 'jpg', 'jpeg', 'webp'}:
            continue
        fname = secure_filename(f"{uid}_gal_{db.func.random()}_{f.filename}")
        f.save(os.path.join(UPLOAD_FOLDER, fname))
        db.session.add(LawyerGalleryImage(lawyer_id=uid, filename=fname))
        saved += 1
    db.session.commit()
    return jsonify({'uploaded': saved}), 201


@lawyers_bp.route('/api/lawyer/gallery/<int:image_id>', methods=['DELETE'])
@jwt_required()
def my_gallery_delete(image_id):
    uid = int(get_jwt_identity())
    img = LawyerGalleryImage.query.get(image_id)
    if not img or img.lawyer_id != uid:
        return jsonify({'message': 'Not found'}), 404
    try:
        path = os.path.join(UPLOAD_FOLDER, img.filename)
        if os.path.exists(path):
            os.remove(path)
    except Exception:
        pass
    db.session.delete(img)
    db.session.commit()
    return jsonify({'deleted': True}), 200


# --- Galería (público) ---
@lawyers_bp.route('/api/abogado/galeria/<int:abogado_id>', methods=['GET'])
def public_gallery(abogado_id):
    imgs = LawyerGalleryImage.query.filter_by(lawyer_id=abogado_id).order_by(LawyerGalleryImage.created_at.desc()).all()
    return jsonify([{'id': i.id, 'filename': i.filename, 'url': f'/uploads/{i.filename}'} for i in imgs]), 200


# --- Video (privado) ---
@lawyers_bp.route('/api/lawyer/video', methods=['GET'])
@jwt_required()
def my_video():
    uid = int(get_jwt_identity())
    v = LawyerIntroVideo.query.filter_by(lawyer_id=uid).first()
    if not v:
        return jsonify({}), 200
    return jsonify({'filename': v.filename, 'url': f'/uploads/{v.filename}'}), 200


@lawyers_bp.route('/api/lawyer/video', methods=['DELETE'])
@jwt_required()
def my_video_delete():
    uid = int(get_jwt_identity())
    v = LawyerIntroVideo.query.filter_by(lawyer_id=uid).first()
    if not v:
        return jsonify({'message': 'Not found'}), 404
    try:
        path = os.path.join(UPLOAD_FOLDER, v.filename)
        if os.path.exists(path):
            os.remove(path)
    except Exception:
        pass
    db.session.delete(v)
    db.session.commit()
    return jsonify({'deleted': True}), 200


@lawyers_bp.route('/api/lawyer/video/upload', methods=['POST'])
@jwt_required()
def my_video_upload():
    uid = int(get_jwt_identity())
    f = request.files.get('video')
    if not f or not f.filename:
        return jsonify({'message': 'No file'}), 400
    ext = f.filename.rsplit('.', 1)[-1].lower()
    if ext not in {'mp4', 'webm', 'mov', 'qt'}:
        return jsonify({'message': 'Bad format'}), 400
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    # si ya existe, eliminar anterior
    prev = LawyerIntroVideo.query.filter_by(lawyer_id=uid).first()
    if prev:
        try:
            old = os.path.join(UPLOAD_FOLDER, prev.filename)
            if os.path.exists(old):
                os.remove(old)
        except Exception:
            pass
        db.session.delete(prev)
        db.session.commit()
    # guardar nuevo
    fname = secure_filename(f"{uid}_intro_{db.func.random()}_{f.filename}")
    f.save(os.path.join(UPLOAD_FOLDER, fname))
    db.session.add(LawyerIntroVideo(lawyer_id=uid, filename=fname))
    db.session.commit()
    return jsonify({'filename': fname, 'url': f'/uploads/{fname}'}), 201


# --- Video (público) ---
@lawyers_bp.route('/api/abogado/video/<int:abogado_id>', methods=['GET'])
def public_video(abogado_id):
    v = LawyerIntroVideo.query.filter_by(lawyer_id=abogado_id).first()
    if not v:
        return jsonify({}), 200
    return jsonify({'filename': v.filename, 'url': f'/uploads/{v.filename}'}), 200