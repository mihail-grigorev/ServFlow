import smtplib
import ssl
import socket
import logging
import random
import email.utils
from email.header import Header
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Tuple
from backend.config import settings

logger = logging.getLogger(__name__)

# Known public IP for smtp.yandex.ru to bypass local transparent TUN/proxy drops on port 465
YANDEX_SMTP_DIRECT_IP = "77.88.21.158"

class DirectYandexSMTPSSL(smtplib.SMTP_SSL):
    """
    Subclass that binds to the physical network interface and connects directly
    to Yandex SMTP, bypassing local fake-IP/TUN proxy routing when needed.
    """
    def _get_socket(self, host, port, timeout):
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(timeout)

        # Attempt binding to physical IP or fallback to 0.0.0.0
        bound = False
        for iface_ip in ["172.20.10.2", "0.0.0.0"]:
            try:
                if iface_ip != "0.0.0.0":
                    sock.bind((iface_ip, 0))
                sock.connect((YANDEX_SMTP_DIRECT_IP, port))
                bound = True
                break
            except Exception:
                continue

        if not bound:
            sock.connect((host, port))

        return self.context.wrap_socket(sock, server_hostname="smtp.yandex.ru")


def generate_verification_code() -> str:
    """Generate a secure 6-digit verification code."""
    return f"{random.randint(100000, 999999)}"


def send_yandex_verification_email(
    to_email: str,
    code: str,
    purpose: str = "register"  # "register" | "delete_account"
) -> Tuple[bool, str]:
    """
    Sends an email with a 6-digit verification code using Yandex Mail (SMTP).
    Returns (success: bool, message: str).
    """
    if purpose == "register":
        subject_text = "Код подтверждения регистрации в сервисе ServFlow"
        title = "Подтверждение регистрации"
        description = "Вы регистрируете учетную запись в сервисной платформе ServFlow. Для завершения регистрации введите проверочный код:"
        alert_note = "Если вы не регистрировались на платформе, просто проигнорируйте это письмо."
    elif purpose == "delete_account":
        subject_text = "ServFlow · Код подтверждения удаления аккаунта"
        title = "Запрос на удаление аккаунта"
        description = "Был получен запрос на безвозвратное удаление вашего профиля в ServFlow. Чтобы подтвердить удаление, введите проверочный код:"
        alert_note = "ВНИМАНИЕ: Если вы не запрашивали удаление аккаунта, немедленно смените пароль и никому не сообщайте этот код."
    else:
        subject_text = "ServFlow · Проверочный код"
        title = "Код подтверждения"
        description = "Ваш проверочный код:"
        alert_note = "Срок действия кода: 15 минут."

    html_content = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {{
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #0c0d0f;
      color: #f0f5f2;
      margin: 0;
      padding: 30px 15px;
    }}
    .wrapper {{
      max-width: 500px;
      margin: 0 auto;
      background: #16171b;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      padding: 32px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
    }}
    .brand {{
      font-size: 20px;
      font-weight: 700;
      color: #ffffff;
      letter-spacing: -0.5px;
      margin-bottom: 20px;
    }}
    .brand span {{
      color: #48bb78;
    }}
    .title {{
      font-size: 18px;
      font-weight: 600;
      color: #ffffff;
      margin-bottom: 10px;
    }}
    .desc {{
      font-size: 14px;
      color: #9ca3af;
      line-height: 1.5;
      margin-bottom: 24px;
    }}
    .code-box {{
      background: #1c2620;
      border: 1.5px solid #2e7d47;
      border-radius: 12px;
      padding: 18px;
      text-align: center;
      margin-bottom: 24px;
    }}
    .code {{
      font-size: 34px;
      font-weight: 800;
      letter-spacing: 8px;
      color: #48bb78;
      font-family: monospace;
    }}
    .note {{
      font-size: 12px;
      color: #6b7280;
      line-height: 1.5;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      padding-top: 16px;
    }}
    .footer {{
      text-align: center;
      margin-top: 20px;
      font-size: 11px;
      color: #4b5563;
    }}
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="brand">Serv<span>Flow</span> · Кофейный сервис</div>
    <div class="title">{title}</div>
    <div class="desc">{description}</div>
    <div class="code-box">
      <div class="code">{code}</div>
    </div>
    <div class="note">
      {alert_note}<br>
      Срок действия кода: <strong>15 минут</strong>.
    </div>
  </div>
  <div class="footer">© 2026 ServFlow Platform. Отправлено через Яндекс Почту.</div>
</body>
</html>"""

    text_content = f"{title}\n\n{description}\n\nКод: {code}\n\n{alert_note}\nСрок действия: 15 минут."

    smtp_user = settings.YANDEX_SMTP_USER.strip() if settings.YANDEX_SMTP_USER else ""
    smtp_password = settings.YANDEX_SMTP_PASSWORD.strip() if settings.YANDEX_SMTP_PASSWORD else ""

    if not smtp_user or not smtp_password:
        msg = "Яндекс Почта не настроена в .env (не заполнены YANDEX_SMTP_USER / YANDEX_SMTP_PASSWORD)"
        logger.error(f"[YANDEX SMTP] {msg}")
        return False, msg

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = Header(subject_text, "utf-8").encode()
        msg["From"] = f"ServFlow <{smtp_user}>"
        msg["To"] = to_email
        msg["Reply-To"] = smtp_user
        msg["Date"] = email.utils.formatdate(localtime=True)
        msg["Message-ID"] = email.utils.make_msgid(domain="yandex.ru")
        msg["MIME-Version"] = "1.0"
        msg["X-Mailer"] = "ServFlow Platform"

        msg.attach(MIMEText(text_content, "plain", "utf-8"))
        msg.attach(MIMEText(html_content, "html", "utf-8"))

        context = ssl.create_default_context()

        # Connect with auto-recovery for transparent proxy / TUN interference
        server = None
        try:
            # First attempt: standard SMTP_SSL
            server = smtplib.SMTP_SSL(settings.YANDEX_SMTP_HOST, settings.YANDEX_SMTP_PORT, context=context, timeout=10)
        except Exception as conn_err:
            logger.info(f"Standard SMTP connection failed ({conn_err}), attempting direct network binding...")
            # Fallback attempt: Direct physical connection to Yandex IP
            server = DirectYandexSMTPSSL(settings.YANDEX_SMTP_HOST, settings.YANDEX_SMTP_PORT, context=context, timeout=12)

        try:
            server.login(smtp_user, smtp_password)
            server.sendmail(smtp_user, [to_email], msg.as_string())
            server.quit()
        except smtplib.SMTPResponseException as resp_err:
            code_num = resp_err.smtp_code
            err_text = resp_err.smtp_error.decode("utf-8", errors="ignore") if isinstance(resp_err.smtp_error, bytes) else str(resp_err.smtp_error)
            logger.error(f"[YANDEX SMTP REJECTION] Code {code_num}: {err_text}")
            if "SPAM" in err_text.upper() or code_num == 554:
                return False, "Яндекс отклонил отправку (подозрение в спаме: https://ya.cc/1IrBc). Для активации подтвердите телефон на passport.yandex.ru/phoneconfirm или отправьте одно пробное письмо через mail.yandex.ru."
            if code_num == 550:
                return False, f"Почтовый сервер Яндекса отклонил адрес получателя {to_email} (550 Policy Rejection)."
            return False, f"Ошибка Яндекс Почты ({code_num}): {err_text}"

        logger.info(f"[YANDEX SMTP] Verification email successfully sent to {to_email}")
        return True, f"Код подтверждения успешно отправлен с Яндекс Почты на адрес {to_email}"
    except Exception as e:
        logger.error(f"[YANDEX SMTP ERROR] Не удалось отправить письмо на {to_email}: {e}")
        return False, f"Ошибка отправки через Яндекс SMTP: {e}"
