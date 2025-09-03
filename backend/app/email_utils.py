# backend/app/email_utils.py
import os
import sib_api_v3_sdk
from sib_api_v3_sdk.rest import ApiException

def send_email_via_brevo(to_email: str, subject: str, html: str, sender_email=None, sender_name=None):
    api_key = os.getenv("BREVO_API_KEY")
    if not api_key:
        raise RuntimeError("BREVO_API_KEY no está configurada")

    configuration = sib_api_v3_sdk.Configuration()
    configuration.api_key['api-key'] = api_key

    api_instance = sib_api_v3_sdk.TransactionalEmailsApi(sib_api_v3_sdk.ApiClient(configuration))

    sender = {
        "email": sender_email or os.getenv("SENDER_EMAIL", "no-reply@abogapp.local"),
        "name": sender_name or os.getenv("APP_NAME", "AbogApp")
    }

    email = sib_api_v3_sdk.SendSmtpEmail(
        sender=sender,
        to=[{"email": to_email}],
        subject=subject,
        html_content=html
    )

    try:
        api_instance.send_transac_email(email)
        return True
    except ApiException as e:
        # Loguea e y retorna False para manejar en rutas
        print(f"[Brevo] Error enviando email: {e}")
        return False
