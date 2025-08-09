from flask import Blueprint, jsonify
from app.models import db, User
from flask_jwt_extended import jwt_required, get_jwt_identity

admin_bp = Blueprint('admin', __name__)

# Ruta para obtener todos los abogados aprobados y activos
@admin_bp.route('/api/admin/abogados', methods=['GET'])
@jwt_required()
def get_abogados():
    # ... (código para verificar que el usuario es admin)
    abogados = User.query.filter_by(role='abogado', is_approved=True).all()
    # ... (código para devolver la lista de abogados)
    return jsonify([{'id': ab.id, 'nombres': ab.nombres, 'apellidos': ab.apellidos, 'email': ab.email, 'is_active': ab.is_active} for ab in abogados])


# Ruta para desactivar un usuario (abogado o cliente)
@admin_bp.route('/api/admin/users/<int:user_id>/deactivate', methods=['POST'])
@jwt_required()
def deactivate_user(user_id):
    # ... (lógica para verificar que el usuario es admin)
    user_to_deactivate = User.query.get(user_id)
    # ... (lógica para desactivar el usuario y guardar en DB)
    user_to_deactivate.is_active = False
    db.session.commit()
    return jsonify({'message': 'Usuario desactivado exitosamente'}), 200


# Ruta para reactivar un usuario
@admin_bp.route('/api/admin/users/<int:user_id>/reactivate', methods=['POST'])
@jwt_required()
def reactivate_user(user_id):
    # ... (lógica para verificar que el usuario es admin)
    user_to_reactivate = User.query.get(user_id)
    # ... (lógica para reactivar el usuario y guardar en DB)
    user_to_reactivate.is_active = True
    db.session.commit()
    return jsonify({'message': 'Usuario reactivado exitosamente'}), 200