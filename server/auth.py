import datetime as dt
import functools
import os
import secrets
from typing import Optional

import jwt
from flask import g, jsonify, request


JWT_SECRET = os.getenv("JWT_SECRET", "change-me-in-prod")
JWT_ALGORITHM = "HS256"
JWT_EXPIRES_MIN = int(os.getenv("JWT_EXPIRES_MIN", "120"))
DEMO_PASSWORD = os.getenv("AUTH_DEMO_PASSWORD", "12345678")


def _extract_bearer_token(header_value: Optional[str]) -> Optional[str]:
    if not header_value:
        return None

    if not header_value.lower().startswith("bearer "):
        return None

    token = header_value.split(" ", 1)[1].strip()
    return token or None


def generate_access_token(user_id: int, username: str, role: str = "user") -> str:
    """
    Generate a short-lived JWT for the authenticated user.
    """
    now = dt.datetime.utcnow()
    payload = {
        "sub": str(user_id),
        "username": username,
        "role": role,
        "iat": now,
        "exp": now + dt.timedelta(minutes=JWT_EXPIRES_MIN),
    }

    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> dict:
    return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])


def authenticate_demo_user(password: str) -> bool:
    """
    Basic demo authentication that uses a static password from environment.
    Username is validated against the database in the caller.
    """
    return secrets.compare_digest(password, DEMO_PASSWORD)


def token_required(view_func=None, *, allowed_roles: Optional[set[str]] = None):
    """
    Decorator that enforces JWT authentication for protected routes.
    """

    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            token = _extract_bearer_token(request.headers.get("Authorization"))
            if not token:
                return (
                    jsonify(
                        {
                            "status_code": "AUTH-401",
                            "error": "Authorization token is missing",
                        }
                    ),
                    401,
                )

            try:
                payload = decode_access_token(token)
            except jwt.ExpiredSignatureError:
                return (
                    jsonify({"status_code": "AUTH-401", "error": "Token expired"}),
                    401,
                )
            except jwt.InvalidTokenError:
                return (
                    jsonify({"status_code": "AUTH-401", "error": "Invalid token"}),
                    401,
                )

            role = payload.get("role", "user")
            if allowed_roles and role not in allowed_roles:
                return (
                    jsonify({"status_code": "AUTH-403", "error": "Insufficient role"}),
                    403,
                )

            try:
                g.user_id = int(payload.get("sub"))
            except (TypeError, ValueError):
                return (
                    jsonify(
                        {"status_code": "AUTH-401", "error": "Invalid token payload"}
                    ),
                    401,
                )

            g.username = payload.get("username")
            g.role = role
            return func(*args, **kwargs)

        return wrapper

    if view_func is not None:
        return decorator(view_func)
    return decorator


def admin_required(view_func):
    """
    Dedicated decorator for admin-only endpoints.
    """

    return token_required(view_func, allowed_roles={"admin"})
