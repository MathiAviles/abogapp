# backend/app/routes/user.py
import os
from datetime import datetime
from flask import Blueprint, jsonify, request, current_app as app
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename
from ..models import db, User

user_bp = Blueprint("user", __name__, url_prefix="/api/user")

ALLOWED_EXT = {"jpg", "jpeg", "png", "webp"}

def _allowed(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXT

@user_bp.get("/me")
@jwt_required()
def me():
    uid = get_jwt_identity()
    user = User.query.get(uid)
    if not user:
        return jsonify({"error": "user not found"}), 404

    return jsonify({
        "id": user.id,
        "email": user.email,
        "role": user.role,
        "nombres": getattr(user, "nombres", ""),
        "apellidos": getattr(user, "apellidos", ""),
        "profile_picture_url": getattr(user, "profile_picture_url", None),
    })

@user_bp.post("/profile-picture")
@jwt_required()
def upload_profile_picture():
    uid = get_jwt_identity()
    user = User.query.get(uid)
    if not user:
        return jsonify({"error": "user not found"}), 404

    if "profile_picture" not in request.files:
        return jsonify({"error": "file field 'profile_picture' is required"}), 400

    file = request.files["profile_picture"]
    if file.filename == "":
        return jsonify({"error": "empty filename"}), 400
    if not _allowed(file.filename):
        return jsonify({"error": "invalid file type"}), 400

    # ruta y nombre
    uploads_dir = os.path.join(app.root_path, "..", "uploads")
    os.makedirs(uploads_dir, exist_ok=True)
    ext = file.filename.rsplit(".", 1)[1].lower()
    filename = secure_filename(f"user_{uid}_{int(datetime.utcnow().timestamp())}.{ext}")
    path = os.path.join(uploads_dir, filename)

    file.save(path)

    # guarda sólo el nombre; ya sirves /uploads/<file>
    user.profile_picture_url = filename
    db.session.commit()

    return jsonify({
        "ok": True,
        "filename": filename,
        "url": f"/uploads/{filename}",
    })
