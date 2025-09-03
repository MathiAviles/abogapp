# backend/app/routes/reviews.py
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import func
from app.models import db, User, Meeting, Review

reviews_bp = Blueprint('reviews', __name__)

def _current_user():
    try:
        uid = int(get_jwt_identity())
    except Exception:
        uid = None
    return User.query.get(uid) if uid else None

@reviews_bp.route('/reviews', methods=['POST'])
@jwt_required()
def create_review():
    """
    Body: { meeting_id, lawyer_id, rating (1..5), comment? }
    Solo el cliente de esa reunión puede reseñar; 1 reseña por reunión.
    """
    data = request.get_json() or {}
    meeting_id = data.get('meeting_id')
    lawyer_id = data.get('lawyer_id')
    comment = (data.get('comment') or '').strip()

    try:
        rating = int(data.get('rating', 0))
    except Exception:
        rating = 0

    if not (meeting_id and lawyer_id and 1 <= rating <= 5):
        return jsonify({'message': 'Datos inválidos'}), 400

    user = _current_user()
    if not user or getattr(user, 'role', None) != 'cliente':
        return jsonify({'message': 'No autorizado'}), 403

    meeting = Meeting.query.get(int(meeting_id))
    if (not meeting) or meeting.client_id != user.id or meeting.lawyer_id != int(lawyer_id):
        return jsonify({'message': 'Reunión no válida para reseñar'}), 400

    exists = Review.query.filter_by(client_id=user.id, meeting_id=meeting.id).first()
    if exists:
        return jsonify({'message': 'Ya reseñaste esta reunión'}), 409

    rv = Review(
        lawyer_id=int(lawyer_id),
        client_id=user.id,
        meeting_id=meeting.id,
        rating=rating,
        comment=comment
    )
    db.session.add(rv)
    db.session.commit()
    return jsonify({'id': rv.id}), 201

# ---- SUMMARY: alias EN/ES ----
@reviews_bp.route('/lawyers/<int:lawyer_id>/reviews/summary', methods=['GET'])
@reviews_bp.route('/abogado/<int:lawyer_id>/reviews/summary', methods=['GET'])
def lawyer_reviews_summary(lawyer_id):
    q_all = Review.query.filter_by(lawyer_id=lawyer_id)
    lifetime_count = q_all.count()
    lifetime_avg = db.session.query(func.avg(Review.rating)).filter_by(lawyer_id=lawyer_id).scalar()
    lifetime_avg = float(round(lifetime_avg or 0.0, 2))

    last5 = q_all.order_by(Review.created_at.desc()).limit(5).all()
    last5_avg = float(round((sum(r.rating for r in last5) / len(last5)) if last5 else 0.0, 2))

    items = []
    for r in last5:
        client = User.query.get(r.client_id)
        display_name = "Cliente"
        try:
            if client and client.nombres and client.apellidos:
                display_name = f"{client.nombres.split()[0]} {client.apellidos[0]}."
        except Exception:
            pass
        items.append({
            'rating': r.rating,
            'comment': r.comment or "",
            'created_at': r.created_at.isoformat(),
            'client': display_name
        })

    return jsonify({
        'lifetime': {'avg': lifetime_avg, 'count': lifetime_count},
        'last5': {'avg': last5_avg, 'count': len(last5), 'items': items}
    }), 200

# ---- LISTA PAGINADA: alias EN/ES ----
@reviews_bp.route('/lawyers/<int:lawyer_id>/reviews', methods=['GET'])
@reviews_bp.route('/abogado/<int:lawyer_id>/reviews', methods=['GET'])
def lawyer_reviews_paginated(lawyer_id):
    page = int(request.args.get('page', 1))
    per_page = min(50, int(request.args.get('per_page', 10)))

    q = Review.query.filter_by(lawyer_id=lawyer_id).order_by(Review.created_at.desc())
    pag = q.paginate(page=page, per_page=per_page, error_out=False)

    items = []
    for r in pag.items:
        client = User.query.get(r.client_id)
        display_name = "Cliente"
        try:
            if client and client.nombres and client.apellidos:
                display_name = f"{client.nombres.split()[0]} {client.apellidos[0]}."
        except Exception:
            pass
        items.append({
            'rating': r.rating,
            'comment': r.comment or "",
            'created_at': r.created_at.isoformat(),
            'client': display_name
        })

    return jsonify({
        'page': page, 'per_page': per_page, 'total': pag.total,
        'items': items
    }), 200