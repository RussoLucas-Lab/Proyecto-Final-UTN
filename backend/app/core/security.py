"""
Utilidades de seguridad transversales: hashing, JWT y cookies de sesión.

Expone:
  hash_password / verify_password  → bcrypt vía passlib
  hash_refresh_token               → HMAC-SHA256 con JWT_SECRET (rápido para tokens
                                     de alta entropía; bcrypt no aporta mejora aquí)
  create_access_token              → JWT firmado con claims sub + rol + exp
  decode_access_token              → JWT validado (lanza jwt.InvalidTokenError si inválido)
  generate_refresh_token           → token opaco aleatorio (urlsafe 32 bytes)
  generate_csrf_token              → token opaco aleatorio para CSRF double-submit
  set_session_cookies              → setea access + refresh + csrf en la Response
  clear_session_cookies            → elimina las cookies de sesión (logout)
"""

import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Response
from passlib.context import CryptContext

from app.core.config import settings

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ── Contraseñas ────────────────────────────────────────────────────────────────


def hash_password(password: str) -> str:
    """Retorna el hash bcrypt de la contraseña en claro."""
    return _pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    """Verifica que `plain` coincide con el hash bcrypt almacenado."""
    return _pwd_context.verify(plain, hashed)


# ── Refresh token ──────────────────────────────────────────────────────────────


def hash_refresh_token(token: str) -> str:
    """Retorna el hash HMAC-SHA256 del refresh token para persistir en DB.

    Se usa HMAC-SHA256 en lugar de bcrypt porque los refresh tokens son tokens
    opacos de alta entropía (32 bytes aleatorios); el costo adicional de bcrypt
    no aporta mejora de seguridad y añade latencia innecesaria en cada /auth/refresh.
    """
    return hmac.new(
        settings.JWT_SECRET.encode(),
        token.encode(),
        hashlib.sha256,
    ).hexdigest()


# ── JWT access token ───────────────────────────────────────────────────────────


def create_access_token(data: dict) -> str:
    """Emite un JWT access token con expiración de JWT_ACCESS_EXPIRE_MINUTES.

    Args:
        data: Claims adicionales a incluir (p. ej. {"sub": "1", "rol": "SOCIO"}).
    """
    payload = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.JWT_ACCESS_EXPIRE_MINUTES
    )
    payload["exp"] = expire
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> dict:
    """Decodifica y valida el JWT.

    Lanza `jwt.InvalidTokenError` (o subclase) si el token es inválido o ha vencido.
    """
    return jwt.decode(
        token,
        settings.JWT_SECRET,
        algorithms=[settings.JWT_ALGORITHM],
    )


# ── Generadores de tokens opacos ───────────────────────────────────────────────


def generate_refresh_token() -> str:
    """Genera un refresh token opaco de alta entropía (urlsafe base64, 32 bytes)."""
    return secrets.token_urlsafe(32)


def generate_csrf_token() -> str:
    """Genera un CSRF token opaco de alta entropía (urlsafe base64, 32 bytes)."""
    return secrets.token_urlsafe(32)


# ── Cookies de sesión ──────────────────────────────────────────────────────────


def set_session_cookies(
    response: Response,
    *,
    access_token: str,
    refresh_token: str,
    csrf_token: str,
) -> None:
    """Setea las tres cookies de sesión en la respuesta FastAPI.

    - access_token:  HttpOnly, ruta /, vida JWT_ACCESS_EXPIRE_MINUTES
    - refresh_token: HttpOnly, ruta /api/v1/auth (más restrictivo por seguridad)
    - csrf_token:    NO HttpOnly — el frontend lo lee para double-submit CSRF
    """
    access_max_age = settings.JWT_ACCESS_EXPIRE_MINUTES * 60
    refresh_max_age = settings.JWT_REFRESH_EXPIRE_DAYS * 24 * 60 * 60

    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,  # type: ignore[arg-type]
        max_age=access_max_age,
        path="/",
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,  # type: ignore[arg-type]
        max_age=refresh_max_age,
        path="/api/v1/auth",  # solo se envía en rutas de auth
    )
    # csrf_token: NO httponly — el frontend lo lee y lo reenvía en X-CSRF-Token
    response.set_cookie(
        key="csrf_token",
        value=csrf_token,
        httponly=False,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,  # type: ignore[arg-type]
        max_age=refresh_max_age,
        path="/",
    )


def clear_session_cookies(response: Response) -> None:
    """Elimina las cookies de sesión (logout)."""
    response.delete_cookie(key="access_token", path="/")
    response.delete_cookie(key="refresh_token", path="/api/v1/auth")
    response.delete_cookie(key="csrf_token", path="/")
