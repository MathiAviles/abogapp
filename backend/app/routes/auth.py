import re
from flask import Blueprint, request, jsonify, current_app
from app.models import db, User
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from stream_chat import StreamChat

auth_bp = Blueprint('auth', __name__)
ph = PasswordHasher()

def validar_password_fuerte(password):
    if len(password) < 8: return False, "La contraseña debe tener al menos 8 caracteres."
    if not re.search(r"[A-Z]", password): return False, "La contraseña debe tener al menos una letra mayúscula."
    if not re.search(r"[a-z]", password): return False, "La contraseña debe tener al menos una letra minúscula."
    if not re.search(r"\d", password): return False, "La contraseña debe tener al menos un número."
    if not re.search(r"[!@#$%^&*()_+\-=\[\]{};':\"\\|,.<>\/?]", password): return False, "La contraseña debe tener al menos un símbolo."
    return True, ""

def validar_email(email):
    patron = r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$"
    return re.match(patron, email) is not None

@auth_bp.route('/api/register', methods=['POST'])
def register():
    data = request.get_json()
    email = data.get('email').lower() if data.get('email') else None
    password = data.get('password')
    identificacion = data.get('identificacion')
    role = data.get('role').lower() if data.get('role') else None
    nombres = data.get('nombres')
    apellidos = data.get('apellidos')
    especialidad = data.get('especialidad')
    if not all([email, password, identificacion, role, nombres, apellidos]):
        return jsonify({'message': 'Todos los campos principales son obligatorios.'}), 400
    if role == 'abogado' and not especialidad:
        return jsonify({'message': 'La especialidad es obligatoria para los abogados.'}), 400
    if not validar_email(email):
        return jsonify({'message': 'El formato del email no es válido.'}), 400
    is_strong, msg = validar_password_fuerte(password)
    if not is_strong:
        return jsonify({'message': msg}), 400
    if User.query.filter_by(email=email).first():
        return jsonify({'message': 'Este correo electrónico ya está registrado.'}), 400
    hashed_password = ph.hash(password)
    is_approved = role != 'abogado'
    new_user = User(
        email=email, password=hashed_password, identificacion=identificacion,
        role=role, nombres=nombres, apellidos=apellidos,
        especialidad=especialidad if role == 'abogado' else None,
        is_approved=is_approved
    )
    db.session.add(new_user)
    db.session.commit()
    # --- INICIO: Integración con GetStream ---
    try:
        stream_client = StreamChat(
            api_key=current_app.config['STREAM_API_KEY'], 
            api_secret=current_app.config['STREAM_API_SECRET']
        )
        stream_client.upsert_user({
            "id": str(new_user.id),
            "name": f"{new_user.nombres} {new_user.apellidos}",
            "role": new_user.role
            # Puedes añadir más campos personalizados si lo necesitas
        })
    except Exception as e:
        # En un escenario real, aquí deberías manejar el error.
        # Por ejemplo, podrías revertir la creación del usuario o marcarlo 
        # para una sincronización posterior.
        print(f"Error al crear el usuario en GetStream: {e}")
    # --- FIN: Integración con GetStream ---
    if role == 'abogado' and not is_approved:
        return jsonify({'message': 'Registro exitoso. Apenas tu cuenta sea aprobada, podrás comenzar.'}), 201
    return jsonify({'message': 'Usuario registrado exitosamente.'}), 201

@auth_bp.route('/api/login', methods=['POST'])
def login():    
    data = request.get_json()
    email = data.get('email').lower() if data.get('email') else None
    password = data.get('password')
    if not email or not password:
        return jsonify({'message': 'Email y contraseña son obligatorios.'}), 400
    user = User.query.filter_by(email=email).first()
    if user and not user.is_active:
        return jsonify({'message': 'Tu cuenta ha sido desactivada.'}), 403
    if user:
        if user.role == 'abogado' and not user.is_approved:
            return jsonify({'message': 'Tu cuenta de abogado aún no ha sido aprobada.'}), 403
        try:
            ph.verify(user.password, password)
            access_token = create_access_token(identity=str(user.id))
            return jsonify({
                'message': 'Login exitoso',
                'access_token': access_token,
                'role': user.role,
            }), 200
        except VerifyMismatchError:
            pass
    return jsonify({'message': 'Credenciales incorrectas.'}), 401

@auth_bp.route('/api/abogados/pendientes', methods=['GET'])
@jwt_required()
def listar_abogados_pendientes():
    user_id = int(get_jwt_identity())
    current_user = User.query.get(user_id)
    if not current_user or current_user.role not in ['admin', 'backoffice']:
        return jsonify({'message': 'Acceso no autorizado'}), 403
    pendientes = User.query.filter_by(role='abogado', is_approved=False).all()
    return jsonify([{'id': ab.id, 'email': ab.email, 'identificacion': ab.identificacion, 'nombres': ab.nombres, 'apellidos': ab.apellidos} for ab in pendientes]), 200

@auth_bp.route('/api/abogados/aprobar/<int:abogado_id>', methods=['POST'])
@jwt_required()
def aprobar_abogado(abogado_id):
    user_id = int(get_jwt_identity())
    current_user = User.query.get(user_id)
    if not current_user or current_user.role not in ['admin', 'backoffice']:
        return jsonify({'message': 'Acceso no autorizado'}), 403
    abogado = User.query.get(abogado_id)
    if not abogado or abogado.role != 'abogado':
        return jsonify({'message': 'Abogado no encontrado'}), 404
    abogado.is_approved = True
    db.session.commit()
    return jsonify({'message': 'Abogado aprobado exitosamente'}), 200

@auth_bp.route('/api/abogados/rechazar/<int:abogado_id>', methods=['POST'])
@jwt_required()
def rechazar_abogado(abogado_id):
    user_id = int(get_jwt_identity())
    current_user = User.query.get(user_id)
    if not current_user or current_user.role not in ['admin', 'backoffice']:
        return jsonify({'message': 'Acceso no autorizado'}), 403
    abogado = User.query.get(abogado_id)
    if not abogado or abogado.role != 'abogado':
        return jsonify({'message': 'Abogado no encontrado'}), 404
    db.session.delete(abogado)
    db.session.commit()
    return jsonify({'message': 'Abogado rechazado y eliminado'}), 200

@auth_bp.route('/api/stream-token', methods=['GET'])
@jwt_required()
def get_stream_token():
    user_id = get_jwt_identity()
    if not user_id:
        return jsonify({"message": "Identidad de usuario no encontrada en el token"}), 400

    try:
        stream_client = StreamChat(
            api_key=current_app.config['STREAM_API_KEY'], 
            api_secret=current_app.config['STREAM_API_SECRET']
        )
        # El ID del usuario en Stream DEBE ser un string
        token = stream_client.create_token(str(user_id))
        return jsonify({'token': token}), 200
    except Exception as e:
        return jsonify({"message": f"Error al generar el token de Stream: {str(e)}"}), 500