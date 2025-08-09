import os
from flask import Blueprint, jsonify, request, send_from_directory
from app.models import db, User, Availability
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename
from datetime import datetime

lawyers_bp = Blueprint('lawyers', __name__)

UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'uploads')
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'webp'}

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@lawyers_bp.route('/api/abogados/<especialidad>', methods=['GET'])
def get_abogados_por_especialidad(especialidad):
    abogados = User.query.filter(
        User.role == 'abogado',
        User.is_approved == True,
        User.is_active == True,
        User.especialidad.ilike(f'%{especialidad}%')
    ).all()
    lista_abogados = [{
        'id': abogado.id, 'nombres': abogado.nombres, 'apellidos': abogado.apellidos,
        'especialidad': abogado.especialidad, 'about_me': abogado.about_me,
        'profile_picture_url': abogado.profile_picture_url, 'consultation_price': abogado.consultation_price
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
        'nombres': lawyer.nombres, 'apellidos': lawyer.apellidos, 'especialidad': lawyer.especialidad,
        'about_me': lawyer.about_me, 'titles': lawyer.titles,
        'profile_picture_url': lawyer.profile_picture_url, 'consultation_price': lawyer.consultation_price
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
        'id': abogado.id, 'nombres': abogado.nombres, 'apellidos': abogado.apellidos,
        'especialidad': abogado.especialidad, 'about_me': abogado.about_me,
        'titles': abogado.titles, 'profile_picture_url': abogado.profile_picture_url,
        'consultation_price': abogado.consultation_price
    }), 200

@lawyers_bp.route('/api/lawyer/availability', methods=['GET'])
@jwt_required()
def get_availability():
    user_id = int(get_jwt_identity())
    availabilities = Availability.query.filter_by(lawyer_id=user_id).all()
    availability_map = {
        item.date.strftime('%Y-%m-%d'): item.time_slots for item in availabilities
    }
    return jsonify(availability_map), 200

# VERSIÓN CON DEPURACIÓN
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
        
        availability_entry = Availability.query.filter_by(lawyer_id=user_id, date=date_obj).first()

        if availability_entry:
            print(f"Actualizando entrada existente para la fecha {date_str}")
            availability_entry.time_slots = time_slots
        else:
            print(f"Creando NUEVA entrada para la fecha {date_str}")
            availability_entry = Availability(lawyer_id=user_id, date=date_obj, time_slots=time_slots)
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
        item.date.strftime('%Y-%m-%d'): item.time_slots for item in availabilities
    }
    return jsonify(availability_map), 200