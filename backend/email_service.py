import smtplib
import ssl
import socket
import logging
import secrets
import hmac
import hashlib
import email.utils
from email.header import Header
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Tuple, List, Optional
from backend.config import settings

logger = logging.getLogger(__name__)

# Known public IPs for smtp.yandex.ru to bypass local transparent TUN/proxy drops on port 465/587
YANDEX_SMTP_KNOWN_IPS = ["77.88.21.158", "213.180.204.158"]


def get_candidate_bind_ips() -> List[Optional[str]]:
    """
    Discovers active physical network IPv4 addresses to bypass local fake-IP/TUN
    routing (e.g. Clash, Mihomo, v2ray, etc.) that intercepts and terminates SMTP traffic.
    Returns a list of local IP strings, ending with None (default routing fallback).
    """
    candidate_ips: List[str] = []

    # 1. Inspect physical interfaces via psutil if available
    try:
        import psutil
        for iface_name, addrs in psutil.net_if_addrs().items():
            lname = iface_name.lower()
            if any(bad in lname for bad in ["meta", "clash", "sing-box", "tun", "tap", "vethernet", "wsl", "loopback", "bluetooth"]):
                continue
            for addr in addrs:
                if addr.family == socket.AF_INET:
                    ip = addr.address
                    if not (ip.startswith("127.") or ip.startswith("169.254.") or ip.startswith("198.18.") or ip.startswith("198.19.")):
                        if ip not in candidate_ips:
                            candidate_ips.append(ip)
    except Exception as e:
        logger.debug(f"psutil adapter inspection skipped: {e}")

    # 2. Inspect host addrinfo as additional source
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            ip = info[4][0]
            if not (ip.startswith("127.") or ip.startswith("169.254.") or ip.startswith("198.18.") or ip.startswith("198.19.")):
                if ip not in candidate_ips:
                    candidate_ips.append(ip)
    except Exception:
        pass

    # 3. Always include None as fallback (default system routing)
    res: List[Optional[str]] = list(candidate_ips)
    res.append(None)
    return res


def create_smtp_connection(timeout: int = 8):
    """
    Establishes an SMTP connection to Yandex, automatically trying:
    - Candidate physical interfaces (bypassing TUN/proxy drops)
    - Port 465 (SSL) and Port 587 (STARTTLS)
    - Direct public IP and hostname
    """
    bind_ips = get_candidate_bind_ips()

    configured_host = (settings.YANDEX_SMTP_HOST or "smtp.yandex.ru").strip()
    dest_hosts = [configured_host]
    for ip in YANDEX_SMTP_KNOWN_IPS:
        if ip not in dest_hosts:
            dest_hosts.append(ip)

    context = ssl.create_default_context()
    last_exception = None

    # Priority 1: Port 465 (SMTPS / direct SSL)
    for bind_ip in bind_ips:
        for host in dest_hosts:
            sock = None
            try:
                sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                sock.settimeout(timeout)
                if bind_ip:
                    sock.bind((bind_ip, 0))
                sock.connect((host, 465))
                ssock = context.wrap_socket(sock, server_hostname="smtp.yandex.ru")
                server = smtplib.SMTP_SSL()
                server.sock = ssock
                server.file = ssock.makefile("rb")
                server.getreply()
                server.ehlo("servflow.local")
                logger.info(f"[YANDEX SMTP] Connected via 465 (SSL) to {host} [bind: {bind_ip or 'default'}]")
                return server
            except Exception as e:
                last_exception = e
                if sock:
                    try:
                        sock.close()
                    except Exception:
                        pass
                continue

    # Priority 2: Port 587 (STARTTLS)
    for bind_ip in bind_ips:
        for host in dest_hosts:
            sock = None
            try:
                sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                sock.settimeout(timeout)
                if bind_ip:
                    sock.bind((bind_ip, 0))
                sock.connect((host, 587))
                server = smtplib.SMTP()
                server._host = "smtp.yandex.ru"
                server.sock = sock
                server.file = sock.makefile("rb")
                server.getreply()
                server.ehlo("servflow.local")
                server.starttls(context=context)
                server.ehlo("servflow.local")
                logger.info(f"[YANDEX SMTP] Connected via 587 (STARTTLS) to {host} [bind: {bind_ip or 'default'}]")
                return server
            except Exception as e:
                last_exception = e
                if sock:
                    try:
                        sock.close()
                    except Exception:
                        pass
                continue

    if last_exception:
        raise last_exception
    raise ConnectionError("Не удалось установить соединение с сервером Яндекс Почты (порты 465 и 587 недоступны)")


def generate_verification_code() -> str:
    """Generate a cryptographically secure 6-digit verification code."""
    return f"{secrets.randbelow(900000) + 100000}"


def hash_verification_code(email: str, code: str) -> str:
    """
    Computes HMAC-SHA256 hash of the verification code bound to the email address.
    """
    key = settings.JWT_SECRET.encode("utf-8")
    msg = f"{email.strip().lower()}:{code.strip()}".encode("utf-8")
    return hmac.new(key, msg, hashlib.sha256).hexdigest()


def verify_code_hash(email: str, input_code: str, stored_hash: Optional[str], raw_code: Optional[str] = None) -> bool:
    """
    Validates the verification code using constant-time comparison to prevent timing attacks.
    """
    if stored_hash:
        expected = hash_verification_code(email, input_code)
        return hmac.compare_digest(expected, stored_hash)
    if raw_code:
        return hmac.compare_digest(input_code.strip(), raw_code.strip())
    return False


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

        # Connect using smart adapter detection & auto-fallback (465 SSL / 587 STARTTLS)
        server = create_smtp_connection(timeout=8)

        try:
            server.login(smtp_user, smtp_password)
            server.sendmail(smtp_user, [to_email], msg.as_string())
            try:
                server.quit()
            except Exception:
                pass
        except smtplib.SMTPResponseException as resp_err:
            code_num = resp_err.smtp_code
            err_text = resp_err.smtp_error.decode("utf-8", errors="ignore") if isinstance(resp_err.smtp_error, bytes) else str(resp_err.smtp_error)
            logger.error(f"[YANDEX SMTP REJECTION] Code {code_num}: {err_text}")
            return False, "Не удалось доставить письмо с кодом подтверждения. Пожалуйста, попробуйте позже."

        logger.info(f"[YANDEX SMTP] Verification email successfully sent to {to_email}")
        return True, "Код подтверждения успешно отправлен на указанный email адрес."
    except Exception as e:
        logger.error(f"[YANDEX SMTP ERROR] Не удалось отправить письмо на {to_email}: {e}")
        return False, "Не удалось доставить письмо с кодом подтверждения. Пожалуйста, попробуйте позже."
