from flask import Blueprint, jsonify, request
from app.models import db, User, Meeting, Availability
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime

meetings_bp = Blueprint('meetings', __name__)

# --- FUNCIÓN AUXILIAR PARA CALCULAR LA SIGUIENTE MEDIA HORA ---

def get_next_slot(time_slot_str):
    """
    Calcula la siguiente franja horaria de 30 minutos.
    Ej: Recibe "6:30 AM" y devuelve "7:00 AM".
    """
    try:
        all_slots = []
        for hour in range(24):
            for minute in ['00', '30']:
                # --- ESTA ES LA LÍNEA CORREGIDA ---
                ampm = 'PM' if hour >= 12 else 'AM'
                display_hour = hour % 12
                if display_hour == 0: 
                    display_hour = 12
                all_slots.append(f"{display_hour}:{minute} {ampm}")

        current_index = all_slots.index(time_slot_str)
        
        if current_index + 1 < len(all_slots):
            return all_slots[current_index + 1]
    except (ValueError, IndexError):
        return None

# --- RUTAS DE LA API ---

@meetings_bp.route('/api/meetings', methods=['POST'])
@jwt_required()
def create_meeting():
    client_id = int(get_jwt_identity())
    data = request.get_json()
    
    lawyer_id = data.get('lawyer_id')
    date_str = data.get('date')
    time_slot = data.get('time')

    if not all([lawyer_id, date_str, time_slot]):
        return jsonify({'message': 'Faltan datos para crear la reunión'}), 400
    
    date_obj = datetime.strptime(date_str, '%Y-%m-%d').date()

    availability_entry = Availability.query.filter_by(lawyer_id=lawyer_id, date=date_obj).first()

    if not availability_entry or time_slot not in availability_entry.time_slots:
        return jsonify({'message': 'El horario seleccionado ya no está disponible. Por favor, elige otro.'}), 409

    slot_to_remove1 = time_slot
    slot_to_remove2 = get_next_slot(time_slot)
    
    slots_to_remove = [slot_to_remove1]
    if slot_to_remove2:
        slots_to_remove.append(slot_to_remove2)

    updated_slots = [slot for slot in availability_entry.time_slots if slot not in slots_to_remove]
    availability_entry.time_slots = updated_slots

    new_meeting = Meeting(
        client_id=client_id,
        lawyer_id=lawyer_id,
        meeting_date=date_obj,
        meeting_time=time_slot
    )
    db.session.add(new_meeting)
    
    db.session.commit()

    return jsonify({'message': 'Reunión creada y horario bloqueado exitosamente'}), 201

@meetings_bp.route('/api/meetings', methods=['GET'])
@jwt_required()
def get_meetings():
    user_id = int(get_jwt_identity())
    current_user = User.query.get(user_id)
    
    meetings_query = None
    if current_user.role == 'cliente':
        meetings_query = Meeting.query.filter_by(client_id=user_id).order_by(Meeting.meeting_date.desc()).all()
    elif current_user.role == 'abogado':
        meetings_query = Meeting.query.filter_by(lawyer_id=user_id).order_by(Meeting.meeting_date.desc()).all()
    else:
        return jsonify([])

    meetings_list = []
    for meeting in meetings_query:
        other_user = None
        if current_user.role == 'cliente':
            other_user = User.query.get(meeting.lawyer_id)
        else: 
            other_user = User.query.get(meeting.client_id)
        
        meetings_list.append({
            'id': meeting.id,
            'date': meeting.meeting_date.strftime('%Y-%m-%d'),
            'time': meeting.meeting_time,
            'status': meeting.status,
            'with_user': {
                'name': f"{other_user.nombres} {other_user.apellidos}",
                'role': other_user.role
            }
        })
        
    return jsonify(meetings_list), 200