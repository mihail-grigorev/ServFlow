import time
import threading
from typing import Dict, List, Tuple

_lock = threading.Lock()

# Key: (ip, email.lower()) -> list of failure timestamps
_failed_logins: Dict[Tuple[str, str], List[float]] = {}

# Key: (email.lower(), purpose) -> float timestamp of last code sent
_last_code_sent: Dict[Tuple[str, str], float] = {}

# Key: user_id -> list of timestamps
_ai_requests: Dict[int, List[float]] = {}

# Anti-spam for audience in demo mode (Section 3 point 4)
# Key: company_id -> list of message timestamps (max 10 per minute)
_company_messages: Dict[str, List[float]] = {}

# Key: company_id -> list of thread creation timestamps (max 30 per hour)
_company_threads: Dict[str, List[float]] = {}

LOGIN_FAILURE_LIMIT = 5
LOGIN_BLOCK_SECONDS = 15 * 60  # 15 minutes
CODE_COOLDOWN_SECONDS = 60    # 60 seconds
AI_RATE_LIMIT = 20            # 20 requests per minute
AI_WINDOW_SECONDS = 60

COMPANY_MSG_LIMIT = 10         # 10 messages per minute
COMPANY_MSG_WINDOW = 60
COMPANY_THREAD_LIMIT = 30      # 30 threads per hour
COMPANY_THREAD_WINDOW = 3600

def check_failed_login_limit(ip: str, email: str) -> bool:
    """Returns True if the login attempt is allowed, False if blocked by rate limit."""
    now = time.time()
    key = (ip.strip(), email.strip().lower())
    with _lock:
        timestamps = _failed_logins.get(key, [])
        valid = [t for t in timestamps if now - t < LOGIN_BLOCK_SECONDS]
        _failed_logins[key] = valid
        return len(valid) < LOGIN_FAILURE_LIMIT

def record_failed_login(ip: str, email: str):
    """Records a failed login attempt."""
    now = time.time()
    key = (ip.strip(), email.strip().lower())
    with _lock:
        timestamps = _failed_logins.get(key, [])
        timestamps.append(now)
        _failed_logins[key] = timestamps

def clear_failed_login(ip: str, email: str):
    """Clears failed login counter upon successful authentication."""
    key = (ip.strip(), email.strip().lower())
    with _lock:
        _failed_logins.pop(key, None)

def check_code_request_cooldown(email: str, purpose: str) -> Tuple[bool, int]:
    """
    Checks if 60s have passed since last code request.
    Returns (can_send: bool, remaining_seconds: int).
    """
    now = time.time()
    key = (email.strip().lower(), purpose.strip())
    with _lock:
        last_time = _last_code_sent.get(key, 0.0)
        elapsed = now - last_time
        if elapsed < CODE_COOLDOWN_SECONDS:
            remaining = int(CODE_COOLDOWN_SECONDS - elapsed) + 1
            return False, remaining
        return True, 0

def record_code_request(email: str, purpose: str):
    """Records code send timestamp."""
    now = time.time()
    key = (email.strip().lower(), purpose.strip())
    with _lock:
        _last_code_sent[key] = now

def check_ai_rate_limit(user_id: int) -> bool:
    """Returns True if user is within the 20 req/min AI limit, False if rate limited."""
    now = time.time()
    with _lock:
        timestamps = _ai_requests.get(user_id, [])
        valid = [t for t in timestamps if now - t < AI_WINDOW_SECONDS]
        if len(valid) >= AI_RATE_LIMIT:
            _ai_requests[user_id] = valid
            return False
        valid.append(now)
        _ai_requests[user_id] = valid
        return True

def check_company_message_limit(company_id: str) -> bool:
    """
    Security check Section 3: Audience anti-spam.
    Limits company to max 10 messages per minute.
    """
    if not company_id:
        return True
    now = time.time()
    with _lock:
        timestamps = _company_messages.get(company_id, [])
        valid = [t for t in timestamps if now - t < COMPANY_MSG_WINDOW]
        if len(valid) >= COMPANY_MSG_LIMIT:
            _company_messages[company_id] = valid
            return False
        valid.append(now)
        _company_messages[company_id] = valid
        return True

def check_company_thread_limit(company_id: str) -> bool:
    """
    Security check Section 3: Audience anti-spam.
    Limits company to max 30 threads per hour.
    """
    if not company_id:
        return True
    now = time.time()
    with _lock:
        timestamps = _company_threads.get(company_id, [])
        valid = [t for t in timestamps if now - t < COMPANY_THREAD_WINDOW]
        if len(valid) >= COMPANY_THREAD_LIMIT:
            _company_threads[company_id] = valid
            return False
        valid.append(now)
        _company_threads[company_id] = valid
        return True
