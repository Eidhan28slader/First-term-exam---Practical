import base64
import hashlib
import hmac
import json
import secrets
from datetime import datetime, timedelta, timezone

from app.config import JWT_SECRET


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    hashed = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 310_000)
    return f"{base64.urlsafe_b64encode(salt).decode()}${base64.urlsafe_b64encode(hashed).decode()}"


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        salt_text, hash_text = stored_hash.split("$", maxsplit=1)
        salt = base64.urlsafe_b64decode(salt_text)
        expected = base64.urlsafe_b64decode(hash_text)
        actual = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 310_000)
        return hmac.compare_digest(actual, expected)
    except (ValueError, TypeError):
        return False


def _encode_part(value: dict) -> str:
    return base64.urlsafe_b64encode(json.dumps(value, separators=(",", ":")).encode()).decode().rstrip("=")


def create_token(user_id: int) -> str:
    header = _encode_part({"alg": "HS256", "typ": "JWT"})
    payload = _encode_part({
        "sub": str(user_id),
        "exp": int((datetime.now(timezone.utc) + timedelta(days=7)).timestamp()),
    })
    message = f"{header}.{payload}"
    signature = hmac.new(JWT_SECRET.encode(), message.encode(), hashlib.sha256).digest()
    encoded_signature = base64.urlsafe_b64encode(signature).decode().rstrip("=")
    return f"{message}.{encoded_signature}"
