import os
import re
import secrets
from datetime import datetime, timedelta

from flask import Blueprint, request, jsonify, current_app
from app.models import db, User
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from stream_chat import StreamChat

# Brevo SDK directo para códigos al usuario
import sib_api_v3_sdk
from sib_api_v3_sdk.rest import ApiException

# Reutilizamos tu emailer para notificar a abogados
from app.emailer import send_raw  # usamos envío crudo reutilizable

auth_bp = Blueprint('auth', __name__)
ph = PasswordHasher()

def send_email_via_brevo(to_email: str, subject: str, html: str, sender_email=None, sender_name=None) -> bool:
    api_key = os.getenv("BREVO_API_KEY")
    if not api_key:
        print("[Brevo] Falta BREVO_API_KEY")
        return False
    configuration = sib_api_v3_sdk.Configuration()
    configuration.api_key['api-key'] = api_key
    api = sib_api_v3_sdk.TransactionalEmailsApi(sib_api_v3_sdk.ApiClient(configuration))
    sender = {
        "email": sender_email or os.getenv("SENDER_EMAIL", "no-reply@abogapp.local"),
        "name": sender_name or os.getenv("APP_NAME", "AbogApp"),
    }
    email = sib_api_v3_sdk.SendSmtpEmail(sender=sender, to=[{"email": to_email}], subject=subject, html_content=html)
    try:
        api.send_transac_email(email)
        return True
    except ApiException as e:
        print("[Brevo] Error enviando email", getattr(e, "status", None), getattr(e, "reason", None))
        return False

def validar_password_fuerte(password):
    if len(password) < 8:
        return False, "La contraseña debe tener al menos 8 caracteres."
    if not re.search(r"[A-Z]", password):
        return False, "La contraseña debe tener al menos una letra mayúscula."
    if not re.search(r"[a-z]", password):
        return False, "La contraseña debe tener al menos una letra minúscula."
    if not re.search(r"\d", password):
        return False, "La contraseña debe tener al menos un número."
    if not re.search(r"[!@#$%^&*()_+\-=\[\]{};':\"\\|,.<>\/?]", password):
        return False, "La contraseña debe tener al menos un símbolo."
    return True, ""

def validar_email(email):
    patron = r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$"
    return re.match(patron, email) is not None

def gen_6_digit_code() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"

def hash_code(code: str) -> str:
    return ph.hash(code)

def verify_code_hash(code: str, hash_value: str) -> bool:
    try:
        return ph.verify(hash_value, code)
    except VerifyMismatchError:
        return False

def _find_assigned_lawyer_for(user: User):
    """
    Intenta resolver el abogado asignado a un cliente.
    Por defecto, usa user.created_by. Ajusta aquí si tu relación es distinta.
    """
    try:
        created_by = getattr(user, "created_by", None)
    except Exception:
        created_by = None

    if created_by:
        ab = User.query.get(created_by)
        if ab and ab.role == "abogado" and ab.email:
            return ab
    return None


# ========== REGISTRO ==========
@auth_bp.route('/api/register', methods=['POST'])
def register():
    data = request.get_json() or {}
    email = data.get('email').lower().strip() if data.get('email') else None
    password = data.get('password')
    identificacion = data.get('identificacion')
    role = data.get('role').lower().strip() if data.get('role') else None
    nombres = data.get('nombres')
    apellidos = data.get('apellidos')
    especialidad = data.get('especialidad')

    if role == 'admin':
        admin_secret_env = os.getenv('ADMIN_CREATE_SECRET')
        if not admin_secret_env:
            return jsonify({'message': 'ADMIN_CREATE_SECRET no está configurado en el servidor'}), 500
        provided = request.headers.get('X-Admin-Create-Secret', '')
        if provided != admin_secret_env:
            return jsonify({'message': 'No autorizado para crear admin'}), 403

    if not all([email, password, identificacion, role, nombres, apellidos]):
        return jsonify({'message': 'Todos los campos principales son obligatorios.'}), 400

    if role == 'abogado' and not especialidad:
        return jsonify({'message': 'La especialidad es obligatoria para los abogados.'}), 400

    if not validar_email(email):
        return jsonify({'message': 'El formato del email no es válido.'}), 400

    ok, msg = validar_password_fuerte(password)
    if not ok:
        return jsonify({'message': msg}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({'message': 'Este correo electrónico ya está registrado.'}), 400

    hashed_password = ph.hash(password)

    new_user = User(
        email=email,
        password=hashed_password,
        identificacion=identificacion,
        role=role,
        nombres=nombres,
        apellidos=apellidos,
        especialidad=especialidad if role == 'abogado' else None,
        email_verified=False,
        kyc_status="not_submitted"
    )
    new_user.recompute_approval()
    db.session.add(new_user)
    db.session.commit()

    # GetStream (best-effort)
    try:
        stream_client = StreamChat(
            api_key=current_app.config['STREAM_API_KEY'],
            api_secret=current_app.config['STREAM_API_SECRET']
        )
        stream_client.upsert_user({
            "id": str(new_user.id),
            "name": f"{new_user.nombres} {new_user.apellidos}",
            "role": new_user.role
        })
    except Exception as e:
        print(f"Error al crear el usuario en GetStream: {e}")

    if role == 'admin':
        new_user.email_verified = True
        new_user.email_verified_at = datetime.utcnow()
        new_user.email_verif_code_hash = None
        new_user.email_verif_expires = None
        new_user.recompute_approval()
        db.session.commit()
        return jsonify({
            'message': 'Administrador creado. No requiere verificación por correo.',
            'needsVerification': False
        }), 201

    # Envío de código de verificación
    try:
        code = gen_6_digit_code()
        new_user.email_verified = False
        new_user.email_verif_code_hash = hash_code(code)
        new_user.email_verif_expires = datetime.utcnow() + timedelta(minutes=10)
        new_user.recompute_approval()
        db.session.commit()

        html = f"""
        <h2>Verificación de correo - AbogApp</h2>
        <p>Hola {new_user.nombres} {new_user.apellidos},</p>
        <p>Usa este código para verificar tu correo:</p>
        <p style="font-size:24px;font-weight:bold;letter-spacing:3px">{code}</p>
        <p>El código expira en 10 minutos.</p>
        """
        send_ok = send_email_via_brevo(
            to_email=new_user.email,
            subject="Verifica tu correo",
            html=html
        )
        if not send_ok:
            return jsonify({
                'message': 'Usuario registrado. No pudimos enviar el código, intenta reenviarlo.',
                'needsVerification': True
            }), 202
    except Exception as e:
        print(f"[Verificación] Error enviando código: {e}")
        return jsonify({
            'message': 'Usuario registrado. Ocurrió un problema enviando el código.',
            'needsVerification': True
        }), 202

    msg_registro = 'Registro exitoso. Revisa tu correo para el código de verificación.'
    if role == 'abogado':
        msg_registro += ' Completa tu KYC después de verificar el correo.'
    return jsonify({'message': msg_registro, 'needsVerification': True}), 201

# ========== VERIFICAR EMAIL / REENVIAR ==========
@auth_bp.route('/api/verify-email', methods=['POST'])
def verify_email():
    data = request.get_json() or {}
    email = (data.get('email') or '').strip().lower()
    code = (data.get('code') or '').strip()

    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({"message": "Usuario no encontrado"}), 404

    # Si ya está verificado, de todos modos emitimos token para que pueda ir a /abogado/kyc
    if user.email_verified:
        access_token = create_access_token(identity=str(user.id))
        return jsonify({
            "message": "Email ya verificado",
            "access_token": access_token,
            "user": {
                "id": user.id,
                "role": user.role,
                "email_verified": True,
                "kyc_status": user.kyc_status,
                "is_approved": user.is_approved
            }
        }), 200

    # Validaciones
    if not user.email_verif_expires or datetime.utcnow() > user.email_verif_expires:
        return jsonify({"message": "Código expirado"}), 400
    if not user.email_verif_code_hash or not verify_code_hash(code, user.email_verif_code_hash):
        return jsonify({"message": "Código inválido"}), 400

    # Marca verificado y recalcula aprobación
    user.email_verified = True
    user.email_verified_at = datetime.utcnow()
    user.email_verif_code_hash = None
    user.email_verif_expires = None
    user.recompute_approval()
    db.session.commit()

    # === NUEVO: Notificar al abogado asignado si el usuario es CLIENTE ===
    try:
        if user.role == "cliente":
            abogado = _find_assigned_lawyer_for(user)
            if abogado:
                subject = "Tu cliente acaba de verificar su correo ✅"
                text = (
                    f"Hola {abogado.nombres or 'abogado'},\n\n"
                    f"El cliente {user.nombres} {user.apellidos} ({user.email}) "
                    f"acaba de verificar su correo en AbogApp.\n\n"
                    "Ya puedes continuar con la coordinación de su caso o agendar la reunión.\n\n"
                    "— AbogApp"
                )
                html = f"""
                <p>Hola {abogado.nombres or 'abogado'},</p>
                <p>El cliente <strong>{user.nombres} {user.apellidos}</strong> ({user.email})
                acaba de verificar su correo en <strong>AbogApp</strong>.</p>
                <p>Ya puedes continuar con la coordinación de su caso o agendar la reunión.</p>
                <p>— AbogApp</p>
                """
                # Usamos el helper centralizado (app.emailer.send_raw)
                try:
                    send_raw(
                        to_email=abogado.email,
                        subject=subject,
                        text=text,
                        html=html,
                        tags=["client_verified"]
                    )
                except Exception as e:
                    current_app.logger.warning(f"[verify-email] fallo al enviar notificación al abogado: {e}")
    except Exception as e:
        current_app.logger.exception(f"[verify-email] error notificando al abogado: {e}")

    # Emite token para poder llamar /api/kyc/* inmediatamente
    access_token = create_access_token(identity=str(user.id))

    return jsonify({
        "message": "Email verificado",
        "access_token": access_token,
        "user": {
            "id": user.id,
            "role": user.role,
            "email_verified": True,
            "kyc_status": user.kyc_status,
            "is_approved": user.is_approved
        }
    }), 200

@auth_bp.route('/api/verify-email/resend', methods=['POST'])
def resend_verification():
    data = request.get_json() or {}
    email = (data.get('email') or '').strip().lower()

    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({"message": "Si el email existe, te enviamos un código."}), 200
    if user.email_verified:
        return jsonify({"message": "Email ya verificado"}), 200

    code = gen_6_digit_code()
    user.email_verif_code_hash = hash_code(code)
    user.email_verif_expires = datetime.utcnow() + timedelta(minutes=10)
    db.session.commit()

    html = f"""
    <h2>Tu nuevo código</h2>
    <p>Usa este código para verificar tu correo:</p>
    <p style="font-size:24px;font-weight:bold;letter-spacing:3px">{code}</p>
    <p>El código expira en 10 minutos.</p>
    """
    send_email_via_brevo(
        to_email=user.email,
        subject="Nuevo código de verificación",
        html=html
    )
    return jsonify({"message": "Código reenviado"}), 200

# ========== LOGIN ==========
@auth_bp.route('/api/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    email = data.get('email').lower().strip() if data.get('email') else None
    password = data.get('password')

    if not email or not password:
        return jsonify({'message': 'Email y contraseña son obligatorios.'}), 400

    user = User.query.filter_by(email=email).first()
    if user and not user.is_active:
        return jsonify({'message': 'Tu cuenta ha sido desactivada.'}), 403

    if user:
        if user.role != 'admin' and not user.email_verified:
            return jsonify({'message': 'Debes verificar tu email.', 'code': 'EMAIL_NOT_VERIFIED'}), 403

        try:
            ph.verify(user.password, password)
            access_token = create_access_token(identity=str(user.id))
            # Nota: no bloqueamos aquí por is_approved; el frontend redirige a /abogado/kyc si aplica
            return jsonify({
                'message': 'Login exitoso',
                'access_token': access_token,
                'user': {
                    'id': user.id,
                    'email': user.email,
                    'role': user.role,
                    'email_verified': user.email_verified,
                    'kyc_status': user.kyc_status,
                    'is_approved': user.is_approved
                }
            }), 200
        except VerifyMismatchError:
            pass

    return jsonify({'message': 'Credenciales incorrectas.'}), 401

# ========== PENDIENTES (para panel) ==========
@auth_bp.route('/api/abogados/pendientes', methods=['GET'])
@jwt_required()
def listar_abogados_pendientes():
    user_id = int(get_jwt_identity())
    current_user = User.query.get(user_id)
    if not current_user or current_user.role not in ['admin', 'backoffice']:
        return jsonify({'message': 'Acceso no autorizado'}), 403
    pendientes = User.query.filter_by(role='abogado').filter(User.is_approved == False).all()  # noqa: E712
    return jsonify([{
        'id': ab.id,
        'email': ab.email,
        'identificacion': ab.identificacion,
        'nombres': ab.nombres,
        'apellidos': ab.apellidos,
        'especialidad': ab.especialidad,
        'email_verified': ab.email_verified,
        'kyc_status': ab.kyc_status,
        'kyc_bar_number': ab.kyc_bar_number,
        'kyc_doc_front_url': ab.kyc_doc_front_url,
        'kyc_doc_back_url': ab.kyc_doc_back_url,
        'kyc_selfie_url': ab.kyc_selfie_url,
    } for ab in pendientes]), 200

# (Mantengo endpoints de GetStream que ya tenías)
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
        token = stream_client.create_token(str(user_id))
        user = User.query.get(int(user_id)) if str(user_id).isdigit() else None
        name = f"{user.nombres} {user.apellidos}" if user else None
        image = None
        if user and getattr(user, "profile_picture_url", None):
            image = f"http://localhost:5001/uploads/{user.profile_picture_url}"
        return jsonify({
            "token": token,
            "apiKey": current_app.config["STREAM_API_KEY"],
            "user_id": str(user_id),
            "name": name,
            "image": image,
        }), 200
    except Exception as e:
        return jsonify({"message": f"Error al generar el token de Stream: {str(e)}"}), 500

@auth_bp.route('/api/stream-upsert-user', methods=['POST'])
@jwt_required()
def stream_upsert_user():
    data = request.get_json() or {}
    target_id = data.get("id")
    if target_id is None:
        return jsonify({"message": "id es requerido"}), 400
    target_id = str(target_id)
    name = data.get("name") or f"user_{target_id}"
    image = data.get("image")
    api_key = current_app.config["STREAM_API_KEY"]
    api_secret = current_app.config["STREAM_API_SECRET"]
    if not api_key or not api_secret:
        return jsonify({"message": "Faltan STREAM_API_KEY/STREAM_API_SECRET"}), 500
    client = StreamChat(api_key=api_key, api_secret=api_secret)
    user_payload = {"id": target_id, "name": name}
    if image:
        user_payload["image"] = image
    client.upsert_user(user_payload)
    return jsonify({"ok": True}), 200