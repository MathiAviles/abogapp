# backend/app/routes/kyc.py
import os
from datetime import datetime
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename
from ..models import db, User

kyc_bp = Blueprint("kyc", __name__, url_prefix="/api/kyc")


ALLOWED = {"png", "jpg", "jpeg", "webp", "pdf"}

# Helpers de ruta y borrado seguro

def _uploads_dir():
    # .../backend/app/routes/kyc.py -> .../backend/uploads
    return os.path.abspath(os.path.join(current_app.root_path, "..", "uploads"))


def _delete_url_file(public_url: str):
    """Recibe una URL pública como "/uploads/xyz.ext" y borra el archivo físico si existe."""
    if not public_url:
        return
    prefix = "/uploads/"
    if public_url.startswith(prefix):
        filename = public_url[len(prefix):]
        path = os.path.join(_uploads_dir(), filename)
        try:
            if os.path.exists(path):
                os.remove(path)
        except Exception as e:
            # No interrumpimos el flujo por errores al borrar, solo registramos
            print(f"[KYC] Error borrando archivo {path}: {e}")

def _save_file(file_storage, prefix):
    if not file_storage:
        return None
    filename = secure_filename(file_storage.filename or "")
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in ALLOWED:
        raise ValueError("Formato no permitido")
    fn = f"{prefix}_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}.{ext}"
    upload_dir = os.path.join(current_app.root_path, "..", "uploads")
    os.makedirs(upload_dir, exist_ok=True)
    path = os.path.join(upload_dir, fn)
    file_storage.save(path)
    return f"/uploads/{fn}"

@kyc_bp.route("/status", methods=["GET"])
@jwt_required()
def kyc_status():
    uid = int(get_jwt_identity())
    u = User.query.get(uid)
    return jsonify({
        "kyc_status": u.kyc_status,
        "kyc_doc_front_url": u.kyc_doc_front_url,
        "kyc_doc_back_url": u.kyc_doc_back_url,
        "kyc_selfie_url": u.kyc_selfie_url,
        "role": u.role,
        "email_verified": u.email_verified,
        "is_approved": u.is_approved,
    }), 200

@kyc_bp.route("/submit", methods=["POST"])
@jwt_required()
def kyc_submit():
    uid = int(get_jwt_identity())
    u = User.query.get(uid)
    if u.role != "abogado":
        return jsonify({"error": "Solo abogados realizan KYC"}), 403

    doc_front = request.files.get("doc_front")
    doc_back  = request.files.get("doc_back")
    selfie    = request.files.get("selfie")

    try:
        if doc_front: u.kyc_doc_front_url = _save_file(doc_front, f"kyc_{uid}_front")
        if doc_back:  u.kyc_doc_back_url  = _save_file(doc_back,  f"kyc_{uid}_back")
        if selfie:    u.kyc_selfie_url    = _save_file(selfie,    f"kyc_{uid}_selfie")
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    u.kyc_status = "pending"
    u.kyc_submitted_at = datetime.utcnow()
    u.recompute_approval()
    db.session.commit()
    return jsonify({"ok": True, "kyc_status": u.kyc_status, "is_approved": u.is_approved}), 200

# Acciones admin unificadas: cuando admin aprueba KYC, se recalcula aprobación final
@kyc_bp.route("/approve/<int:user_id>", methods=["POST"])
@jwt_required()
def kyc_approve(user_id):
    admin = User.query.get(int(get_jwt_identity()))
    if not admin or admin.role != "admin":
        return jsonify({"error": "Solo admin"}), 403
    u = User.query.get_or_404(user_id)
    if u.role != "abogado":
        return jsonify({"error": "Solo aplica a abogados"}), 400
    u.kyc_status = "approved"
    # Borrar archivos físicos para mayor privacidad
    _delete_url_file(u.kyc_doc_front_url)
    _delete_url_file(u.kyc_doc_back_url)
    _delete_url_file(u.kyc_selfie_url)

    # Limpiar referencias en BD
    u.kyc_doc_front_url = None
    u.kyc_doc_back_url = None
    u.kyc_selfie_url = None
    u.recompute_approval()
    db.session.commit()
    return jsonify({"ok": True, "is_approved": u.is_approved}), 200

@kyc_bp.route("/reject/<int:user_id>", methods=["POST"])
@jwt_required()
def kyc_reject(user_id):
    admin = User.query.get(int(get_jwt_identity()))
    if not admin or admin.role != "admin":
        return jsonify({"error": "Solo admin"}), 403
    reason = (request.json or {}).get("reason", "")
    u = User.query.get_or_404(user_id)
    if u.role != "abogado":
        return jsonify({"error": "Solo aplica a abogados"}), 400
    u.kyc_status = "rejected"
    u.kyc_notes = reason
    # (Opcional) también borrar documentos al rechazar
    _delete_url_file(u.kyc_doc_front_url)
    _delete_url_file(u.kyc_doc_back_url)
    _delete_url_file(u.kyc_selfie_url)

    u.kyc_doc_front_url = None
    u.kyc_doc_back_url = None
    u.kyc_selfie_url = None
    u.recompute_approval()
    db.session.commit()
    return jsonify({"ok": True, "is_approved": u.is_approved}), 200