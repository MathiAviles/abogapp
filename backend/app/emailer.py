# backend/app/emailer.py
import os
import json
import requests
from typing import Optional, Dict, Any
from flask import current_app

# --- Config ---
BREVO_API_KEY = os.environ.get("BREVO_API_KEY")
BREVO_API_URL_SEND = "https://api.brevo.com/v3/smtp/email"
BREVO_API_URL_ACCOUNT = "https://api.brevo.com/v3/account"

SENDER = {
    "name": os.environ.get("APP_NAME", "AbogApp"),
    "email": os.environ.get("SENDER_EMAIL", "no-reply@myabogapp.com"),
}

TMPL_APPROVED = int(os.environ.get("BREVO_TMPL_LAWYER_APPROVED", "0") or 0)
TMPL_REJECTED = int(os.environ.get("BREVO_TMPL_LAWYER_REJECTED", "0") or 0)


# --- Utils de logging/seguridad ---
def _log(level: str, msg: str, *args):
    try:
        logger = current_app.logger
        getattr(logger, level, logger.info)(msg, *args)
    except Exception:
        # En caso de que no haya app context/log
        pass


def _mask(s: Optional[str], visible: int = 4) -> str:
    if not s:
        return ""
    if len(s) <= visible:
        return "*" * len(s)
    return s[:visible] + "…" + "*" * (len(s) - visible)


# --- HTTP helpers ---
def _headers_json() -> Dict[str, str]:
    if not BREVO_API_KEY:
        raise RuntimeError("BREVO_API_KEY no configurada")
    return {
        "accept": "application/json",
        "content-type": "application/json",
        "api-key": BREVO_API_KEY,
    }


def _post(url: str, payload: Dict[str, Any], timeout: int = 12) -> Dict[str, Any]:
    _log("info", "Brevo POST %s payload=%s", url, json.dumps(payload, ensure_ascii=False))
    try:
        r = requests.post(url, json=payload, headers=_headers_json(), timeout=timeout)
    except Exception as e:
        _log("exception", "Brevo request error: %s", e)
        raise

    if not r.ok:
        _log("error", "Brevo HTTP %s :: %s", r.status_code, r.text)
        r.raise_for_status()

    try:
        data = r.json()
    except Exception:
        data = {"ok": True, "raw": r.text}

    _log("info", "Brevo OK resp=%s", json.dumps(data, ensure_ascii=False))
    return data


def _get(url: str, timeout: int = 12) -> Dict[str, Any]:
    _log("info", "Brevo GET %s", url)
    try:
        r = requests.get(url, headers=_headers_json(), timeout=timeout)
    except Exception as e:
        _log("exception", "Brevo GET error: %s", e)
        raise

    if not r.ok:
        _log("error", "Brevo GET %s :: %s", r.status_code, r.text)
        r.raise_for_status()

    try:
        data = r.json()
    except Exception:
        data = {"ok": True, "raw": r.text}

    _log("info", "Brevo GET OK resp=%s", json.dumps(data, ensure_ascii=False))
    return data


# --- Envíos ---
def send_template(template_id: int, to_email: str, to_name: str, params: dict, tags=None):
    body = {
        "sender": SENDER,
        "to": [{"email": to_email, "name": to_name}],
        "templateId": int(template_id),
        "params": params or {},
    }
    if tags:
        body["tags"] = tags
    return _post(BREVO_API_URL_SEND, body)


def send_raw(to_email: str, subject: str, text: Optional[str] = None, html: Optional[str] = None, tags=None):
    """
    Envia un correo sin template (útil para depurar).
    """
    body = {
        "sender": SENDER,
        "to": [{"email": to_email}],
        "subject": subject or "(Sin asunto)",
    }
    if text:
        body["textContent"] = text
    if html:
        body["htmlContent"] = html
    if tags:
        body["tags"] = tags
    return _post(BREVO_API_URL_SEND, body)


def notify_lawyer_status(user, approved: bool, reason: Optional[str] = None) -> Dict[str, Any]:
    template_id = TMPL_APPROVED if approved else TMPL_REJECTED
    if not template_id:
        _log("error", "TemplateId inválido (0). Revisa BREVO_TMPL_* en env.")
        return {"ok": False, "error": "template_id_missing"}

    first_name = (getattr(user, "nombres", "") or "").split(" ")[0] if getattr(user, "nombres", None) else ""
    params = {
        "firstName": first_name or "abogado/a",
        "fullName": f"{(getattr(user, 'nombres', '') or '').strip()} {(getattr(user, 'apellidos', '') or '').strip()}".strip(),
        "status": "aprobada" if approved else "rechazada",
        "reason": reason or "",
        "dashboardUrl": os.environ.get("APP_DASHBOARD_URL", "https://abogapp.co/inicio"),
    }

    try:
        resp = send_template(template_id, getattr(user, "email"), getattr(user, "nombres", "") or "", params, tags=["lawyer_status"])
        return {"ok": True, "resp": resp}
    except Exception as e:
        return {"ok": False, "error": str(e)}


# --- Comprobaciones ---
def brevo_account() -> Dict[str, Any]:
    """
    Llama al endpoint /v3/account para validar que la API Key funciona
    y ver datos básicos de la cuenta.
    """
    return _get(BREVO_API_URL_ACCOUNT)


def brevo_debug_summary() -> Dict[str, Any]:
    return {
        "sender": SENDER,
        "BREVO_API_KEY_set": bool(BREVO_API_KEY),
        "BREVO_API_KEY_masked": _mask(BREVO_API_KEY, 6),
        "TMPL_APPROVED": TMPL_APPROVED,
        "TMPL_REJECTED": TMPL_REJECTED,
        "APP_DASHBOARD_URL": os.environ.get("APP_DASHBOARD_URL"),
    }