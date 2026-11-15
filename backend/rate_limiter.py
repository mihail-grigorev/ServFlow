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

LOGIN_FAILURE_LIMIT = 5
LOGIN_BLOCK_SECONDS = 15 * 60  # 15 minutes
CODE_COOLDOWN_SECONDS = 60    # 60 seconds
AI_RATE_LIMIT = 20            # 20 requests
AI_WINDOW_SECONDS = 60        # per minute

def check_failed_login_limit(ip: str, email: str) -> bool:
    """Returns True if the login attempt is allowed, False if blocked by rate limit."""
    now = time.time()
    key = (ip.strip(), email.strip().lower())
    with _lock:
        timestamps = _failed_logins.get(key, [])
        # Keep only failures within the block window
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
