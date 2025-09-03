# backend/app/routes/favorites.py
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy.exc import IntegrityError
from app.models import db, User, Favorite

favorites_bp = Blueprint('favorites', __name__)

def _uid():
    ident = get_jwt_identity()
    return int(ident.get("id") if isinstance(ident, dict) else ident)

def _lawyer_dict(u: User):
    return {
        "id": u.id,
        "nombres": u.nombres,
        "apellidos": u.apellidos,
        "especialidad": u.especialidad,
        "about_me": u.about_me,
        "titles": u.titles,
        "profile_picture_url": u.profile_picture_url,
        "consultation_price": u.consultation_price,
    }

# ---- Health (para verificar registro de rutas) ----
@favorites_bp.route("/favorites/health", methods=["GET"])
@favorites_bp.route("/favoritos/health", methods=["GET"])
@favorites_bp.route("/api/favorites/health", methods=["GET"])
@favorites_bp.route("/api/favoritos/health", methods=["GET"])
def health():
    return jsonify({"ok": True}), 200

# ---- GET: IDs favoritos ----
@favorites_bp.route("/favorites/ids", methods=["GET"])
@favorites_bp.route("/favoritos/ids", methods=["GET"])
@favorites_bp.route("/api/favorites/ids", methods=["GET"])
@favorites_bp.route("/api/favoritos/ids", methods=["GET"])
@jwt_required()
def get_favorite_ids():
    uid = _uid()
    rows = Favorite.query.filter_by(user_id=uid).all()
    return jsonify({"ids": [r.lawyer_id for r in rows]}), 200

# ---- GET: listado de abogados favoritos ----
@favorites_bp.route("/favorites", methods=["GET"])
@favorites_bp.route("/favoritos", methods=["GET"])
@favorites_bp.route("/api/favorites", methods=["GET"])
@favorites_bp.route("/api/favoritos", methods=["GET"])
@jwt_required()
def get_favorites():
    uid = _uid()
    ids = [r.lawyer_id for r in Favorite.query.filter_by(user_id=uid).all()]
    if not ids:
        return jsonify([]), 200
    lawyers = User.query.filter(User.id.in_(ids)).all()
    # mantener el orden de guardado aproximado
    lawyers_sorted = sorted(lawyers, key=lambda x: ids.index(x.id))
    return jsonify([_lawyer_dict(l) for l in lawyers_sorted]), 200

# ---- POST: añadir favorito ----
@favorites_bp.route("/favorites/<int:lawyer_id>", methods=["POST"])
@favorites_bp.route("/favoritos/<int:lawyer_id>", methods=["POST"])
@favorites_bp.route("/api/favorites/<int:lawyer_id>", methods=["POST"])
@favorites_bp.route("/api/favoritos/<int:lawyer_id>", methods=["POST"])
@jwt_required()
def add_favorite(lawyer_id):
    uid = _uid()
    target = User.query.get(lawyer_id)
    if not target or target.role != "abogado":
        return jsonify({"message": "Abogado no encontrado"}), 404
    if uid == lawyer_id:
        return jsonify({"message": "No puedes marcarte a ti mismo"}), 400

    fav = Favorite(user_id=uid, lawyer_id=lawyer_id)
    db.session.add(fav)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()  # ya existía, es idempotente
    return jsonify({"ok": True}), 201

# ---- DELETE: quitar favorito ----
@favorites_bp.route("/favorites/<int:lawyer_id>", methods=["DELETE"])
@favorites_bp.route("/favoritos/<int:lawyer_id>", methods=["DELETE"])
@favorites_bp.route("/api/favorites/<int:lawyer_id>", methods=["DELETE"])
@favorites_bp.route("/api/favoritos/<int:lawyer_id>", methods=["DELETE"])
@jwt_required()
def remove_favorite(lawyer_id):
    uid = _uid()
    Favorite.query.filter_by(user_id=uid, lawyer_id=lawyer_id).delete()
    db.session.commit()
    return jsonify({"ok": True}), 200