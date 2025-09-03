# backend/app/routes/admin.py
import json
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models import db, User
from app.emailer import (
    notify_lawyer_status,
    send_raw,
    brevo_account,
    brevo_debug_summary,
)

admin_bp = Blueprint("admin", __name__)


def _require_admin():
    uid_str = get_jwt_identity()
    try:
        uid = int(uid_str)
    except (TypeError, ValueError):
        return False
    admin = User.query.get(uid)
    return bool(admin and admin.role == "admin")


# ---------------------------------------------------------------------
# Lista de abogados aprobados (activos/inactivos)
# ---------------------------------------------------------------------
@admin_bp.route("/api/admin/abogados", methods=["GET"])
@jwt_required()
def get_abogados():
    if not _require_admin():
        return jsonify({"message": "Acceso no autorizado"}), 403

    abogados = User.query.filter_by(role="abogado", is_approved=True).all()
    return jsonify(
        [
            {
                "id": ab.id,
                "nombres": ab.nombres,
                "apellidos": ab.apellidos,
                "email": ab.email,
                "especialidad": ab.especialidad,
                "is_active": ab.is_active,
            }
            for ab in abogados
        ]
    )


# ---------------------------------------------------------------------
# Desactivar / Reactivar usuario
# ---------------------------------------------------------------------
@admin_bp.route("/api/admin/users/<int:user_id>/deactivate", methods=["POST"])
@jwt_required()
def deactivate_user(user_id):
    if not _require_admin():
        return jsonify({"message": "Acceso no autorizado"}), 403

    user_to_deactivate = User.query.get_or_404(user_id)
    user_to_deactivate.is_active = False
    db.session.commit()
    return jsonify({"message": "Usuario desactivado exitosamente"}), 200


@admin_bp.route("/api/admin/users/<int:user_id>/reactivate", methods=["POST"])
@jwt_required()
def reactivate_user(user_id):
    if not _require_admin():
        return jsonify({"message": "Acceso no autorizado"}), 403

    user_to_reactivate = User.query.get_or_404(user_id)
    user_to_reactivate.is_active = True
    db.session.commit()
    return jsonify({"message": "Usuario reactivado exitosamente"}), 200


# ---------------------------------------------------------------------
# Aprobar usuario -> dispara correo "Cuenta aprobada"
# ---------------------------------------------------------------------
@admin_bp.route("/api/admin/users/approve/<int:user_id>", methods=["POST"])
@jwt_required()
def admin_approve_user(user_id):
    if not _require_admin():
        return jsonify({"message": "Acceso no autorizado"}), 403

    u = User.query.get_or_404(user_id)

    # asegura email verificado
    try:
        u.email_verified = True
    except Exception:
        pass

    # si es abogado, marca KYC aprobado
    if u.role == "abogado":
        try:
            u.kyc_status = "approved"
        except Exception:
            pass  # si no existe el campo, lo ignoramos

    # Recalcula bandera de aprobación (según tu lógica en models.py)
    try:
        u.recompute_approval()
    except Exception:
        u.is_approved = True

    db.session.commit()

    # Email de notificación (no debe romper el flujo si falla)
    email_result = notify_lawyer_status(u, approved=True, reason=None)

    return (
        jsonify(
            {
                "ok": True,
                "is_approved": u.is_approved,
                "email_result": email_result,
            }
        ),
        200,
    )


# ---------------------------------------------------------------------
# Rechazar usuario -> dispara correo "Cuenta rechazada" con motivo
# ---------------------------------------------------------------------
@admin_bp.route("/api/admin/users/reject/<int:user_id>", methods=["POST"])
@jwt_required()
def admin_reject_user(user_id):
    if not _require_admin():
        return jsonify({"message": "Acceso no autorizado"}), 403

    u = User.query.get_or_404(user_id)
    data = request.get_json(silent=True) or {}
    reason = (data.get("reason") or "").strip()

    if u.role == "abogado":
        try:
            u.kyc_status = "rejected"
        except Exception:
            pass
        try:
            u.kyc_notes = reason
        except Exception:
            pass

    try:
        u.recompute_approval()
    except Exception:
        u.is_approved = False

    db.session.commit()

    # Email de notificación (no debe romper el flujo si falla)
    email_result = notify_lawyer_status(u, approved=False, reason=reason)

    return (
        jsonify(
            {
                "ok": True,
                "is_approved": u.is_approved,
                "email_result": email_result,
            }
        ),
        200,
    )


# ---------------------------------------------------------------------
# Endpoint de PRUEBA con template (sin tocar estados)
# ---------------------------------------------------------------------
@admin_bp.route("/api/admin/test-email", methods=["POST"])
@jwt_required()
def admin_test_email():
    if not _require_admin():
        return jsonify({"message": "Acceso no autorizado"}), 403

    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip()
    approved = bool(data.get("approved", True))
    reason = (data.get("reason") or "Motivo de prueba").strip()

    if not email:
        return jsonify({"ok": False, "error": "Falta email"}), 400

    # Usuario sintético para probar envío
    class U:
        def __init__(self, email):
            self.email = email
            self.nombres = "Prueba"
            self.apellidos = "Admin"

    result = notify_lawyer_status(U(email), approved=approved, reason=reason)
    status = 200 if result.get("ok") else 500
    return jsonify(result), status


# ---------------------------------------------------------------------
# Endpoint de PRUEBA RAW (sin template) para descartar problemas de plantilla
# ---------------------------------------------------------------------
@admin_bp.route("/api/admin/test-email-raw", methods=["POST"])
@jwt_required()
def admin_test_email_raw():
    if not _require_admin():
        return jsonify({"message": "Acceso no autorizado"}), 403

    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip()
    subject = (data.get("subject") or "Prueba RAW AbogApp").strip()
    text = data.get("text")
    html = data.get("html")

    if not email:
        return jsonify({"ok": False, "error": "Falta email"}), 400

    try:
        resp = send_raw(email, subject, text=text, html=html, tags=["debug_raw"])
        return jsonify({"ok": True, "resp": resp}), 200
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500


# ---------------------------------------------------------------------
# Debug de configuración Brevo + ping a /v3/account
# ---------------------------------------------------------------------
@admin_bp.route("/api/admin/brevo/debug", methods=["GET"])
@jwt_required()
def admin_brevo_debug():
    if not _require_admin():
        return jsonify({"message": "Acceso no autorizado"}), 403

    summary = brevo_debug_summary()
    try:
        account = brevo_account()
    except Exception as e:
        account = {"ok": False, "error": str(e)}

    return jsonify({"summary": summary, "account": account}), 200