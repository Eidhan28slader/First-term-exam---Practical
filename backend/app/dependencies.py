import base64
import hashlib
import hmac
import json
from datetime import datetime, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.config import JWT_SECRET
from app.database import get_db
from app.models import User

bearer = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Inicia sesión para continuar",
    )
    if credentials is None:
        raise unauthorized
    try:
        header, payload, signature = credentials.credentials.split(".")
        message = f"{header}.{payload}"
        expected = hmac.new(JWT_SECRET.encode(), message.encode(), hashlib.sha256).digest()
        actual = base64.urlsafe_b64decode(signature + "=" * (-len(signature) % 4))
        if not hmac.compare_digest(actual, expected):
            raise unauthorized
        data = json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))
        if data.get("exp", 0) < datetime.now(timezone.utc).timestamp():
            raise unauthorized
        user = db.get(User, int(data["sub"]))
    except (ValueError, KeyError, TypeError, json.JSONDecodeError):
        raise unauthorized
    if user is None:
        raise unauthorized
    return user
