# backend/app/routes/chat.py
import os
from flask import Blueprint, jsonify, request, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from stream_chat import StreamChat
from sqlalchemy.exc import IntegrityError
from app.models import db, User

# ⚠️ Este blueprint YA incluye el prefijo '/api/chat'
chat_bp = Blueprint('chat', __name__, url_prefix='/api/chat')

# ---------- Modelo simple para archivados por usuario ----------
class ChatArchivedChannel(db.Model):
    __tablename__ = "chat_archived_channel"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    cid = db.Column(db.String(128), nullable=False)  # ej: messaging:!members-xxxx
    __table_args__ = (db.UniqueConstraint('user_id', 'cid', name='uq_chat_archive'),)

# ---------- Utilidades ----------
def _get_identity_user_id():
    """Compatibilidad: identity puede ser int o dict con 'id'/'user_id'."""
    identity = get_jwt_identity()
    if isinstance(identity, dict):
        return int(identity.get("id") or identity.get("user_id"))
    return int(identity)

def get_stream_client():
    api_key = os.environ.get("STREAM_API_KEY") or current_app.config.get("STREAM_API_KEY")
    api_secret = os.environ.get("STREAM_API_SECRET") or current_app.config.get("STREAM_API_SECRET")
    if not api_key or not api_secret:
        raise RuntimeError("STREAM_API_KEY/STREAM_API_SECRET no configurados")
    return StreamChat(api_key=api_key, api_secret=api_secret)

def _uploads_dir():
    # .../backend/app/routes/chat.py -> .../backend/uploads
    return os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'uploads'))

def _find_avatar_filename(user_id: int):
    """Busca un archivo user_<id>.(webp|jpg|jpeg|png) en /uploads."""
    base = _uploads_dir()
    for ext in ('webp', 'jpg', 'jpeg', 'png'):
        fname = f"user_{user_id}.{ext}"
        if os.path.exists(os.path.join(base, fname)):
            return fname
    return None

def _build_avatar_url(user_id: int):
    """
    Devuelve URL ABSOLUTA a la foto si existe. Ej: http://localhost:5001/uploads/user_7.webp
    """
    fname = _find_avatar_filename(user_id)
    if not fname:
        return None
    return f"{request.host_url.rstrip('/')}/uploads/{fname}"

# ---------- Health / debug ----------
@chat_bp.route('/health', methods=['GET'])
def health():
    return jsonify({"ok": True}), 200

# ---------- Token de conexión a Stream Chat (asegura name + image) ----------
@chat_bp.route('/token', methods=['GET'])
@jwt_required()
def get_token():
    """
    Devuelve { apiKey, token, user } para el usuario logueado.
    También hace upsert del perfil en Stream (name, image).
    """
    uid = _get_identity_user_id()
    user = User.query.get(uid)
    if not user:
        return jsonify({"message": "Usuario no encontrado"}), 404

    client = get_stream_client()

    # Construir name e image
    name = f"{(user.nombres or '').strip()} {(user.apellidos or '').strip()}".strip() or (user.email or f"user_{uid}")
    image_url = _build_avatar_url(uid)

    stream_user = {"id": str(uid), "name": name}
    if image_url:
        stream_user["image"] = image_url

    # Upsert del usuario en Stream
    client.upsert_user(stream_user)

    # Crear token de conexión
    token = client.create_token(str(uid))
    api_key = os.environ.get("STREAM_API_KEY") or current_app.config.get("STREAM_API_KEY")
    return jsonify({"apiKey": api_key, "token": token, "user": stream_user}), 200

# ---------- Asegurar/Upsert de cualquier usuario (para DMs) ----------
@chat_bp.route('/users/ensure/<int:user_id>', methods=['POST', 'GET'])
@jwt_required()
def ensure_stream_user(user_id):
    """
    Upsert idempotente de un usuario (por ej. el otro miembro del DM).
    Devuelve { ensured: true, user: { id, name, image? } }
    """
    u = User.query.get(user_id)
    if not u:
        return jsonify({"message": "Usuario no encontrado"}), 404

    client = get_stream_client()
    name = f"{(u.nombres or '').strip()} {(u.apellidos or '').strip()}".strip() or (u.email or f"user_{user_id}")
    image_url = _build_avatar_url(u.id)

    stream_user = {"id": str(u.id), "name": name}
    if image_url:
        stream_user["image"] = image_url

    client.upsert_user(stream_user)
    return jsonify({"ensured": True, "user": stream_user}), 200

# ---------- Archivado: listar ----------
@chat_bp.route('/archived', methods=['GET'])
@jwt_required()
def list_archived():
    """Lista de CIDs archivados para el usuario actual: { cids: [] }."""
    uid = _get_identity_user_id()
    rows = ChatArchivedChannel.query.filter_by(user_id=uid).all()
    return jsonify({"cids": [r.cid for r in rows]}), 200

# ---------- Archivado: set/unset ----------
@chat_bp.route('/archive', methods=['POST'])
@jwt_required()
def set_archive():
    """
    Body: { cid: string, archived: bool }
    archived=true  -> guarda/asegura que esté archivado
    archived=false -> elimina de archivados
    """
    uid = _get_identity_user_id()
    data = request.get_json(force=True) or {}

    cid = str(data.get("cid") or "").strip()
    archived = bool(data.get("archived", True))

    if not cid:
        return jsonify({"message": "cid requerido"}), 400
    if len(cid) > 128:
        return jsonify({"message": "cid demasiado largo"}), 400

    if archived:
        rec = ChatArchivedChannel(user_id=uid, cid=cid)
        db.session.add(rec)
        try:
            db.session.commit()
        except IntegrityError:
            db.session.rollback()  # ya existía; idempotente
    else:
        ChatArchivedChannel.query.filter_by(user_id=uid, cid=cid).delete()
        db.session.commit()

    return jsonify({"cid": cid, "archived": archived}), 200
