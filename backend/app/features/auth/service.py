"""
Servicio de autenticación.

Funciones:
  autenticar    → verifica credenciales contra DB (email + bcrypt hash + activo)
  emitir_sesion → emite access + refresh + csrf tokens; persiste refresh hasheado en DB
  renovar       → valida refresh, lo rota y emite nuevo access token
  revocar       → revoca el refresh token (logout); idempotente
"""

import logging
from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import (
    create_access_token,
    generate_csrf_token,
    generate_refresh_token,
    hash_refresh_token,
    verify_password,
)
from app.features.auth.models import RefreshToken, Usuario

logger = logging.getLogger("iuris.auth")


# ── Excepciones del dominio ────────────────────────────────────────────────────


class CredencialesInvalidas(Exception):
    """Credenciales inválidas o cuenta inactiva."""


class SesionInvalida(Exception):
    """Refresh token vencido, revocado o ausente."""


# ── Lógica de autenticación ────────────────────────────────────────────────────


def autenticar(db: Session, *, email: str, password: str) -> Usuario:
    """Verifica credenciales y retorna el usuario si son válidas.

    Lanza CredencialesInvalidas con el mismo mensaje genérico tanto para email
    inexistente, contraseña incorrecta, como cuenta inactiva — para no revelar
    cuál de los tres falló (evitar enumeración de usuarios).
    """
    user = db.scalar(select(Usuario).where(Usuario.email == email))
    if user is None or not verify_password(password, user.password_hash):
        raise CredencialesInvalidas
    if not user.activo:
        raise CredencialesInvalidas
    return user


def emitir_sesion(
    db: Session, *, usuario: Usuario
) -> tuple[str, str, str]:
    """Emite access + refresh + csrf tokens y persiste el refresh hasheado.

    Retorna: (access_token, refresh_token_raw, csrf_token)
    El access token es un JWT; los otros dos son tokens opacos aleatorios.
    Solo el hash del refresh token se almacena en DB, nunca el valor en claro.
    """
    access_token = create_access_token({
        "sub": str(usuario.id),
        "rol": usuario.rol.value,
    })

    refresh_token_raw = generate_refresh_token()
    refresh_hash = hash_refresh_token(refresh_token_raw)
    expires_at = datetime.utcnow() + timedelta(days=settings.JWT_REFRESH_EXPIRE_DAYS)

    db_token = RefreshToken(
        usuario_id=usuario.id,
        token=refresh_hash,
        expires_at=expires_at,
        revoked=False,
    )
    db.add(db_token)
    db.commit()

    csrf_token = generate_csrf_token()

    logger.info("Sesión emitida | usuario_id=%s", usuario.id)
    return access_token, refresh_token_raw, csrf_token


def renovar(
    db: Session, *, refresh_token_raw: str
) -> tuple[str, str, str, Usuario]:
    """Rota el refresh token y emite un nuevo access token.

    - Verifica que el refresh exista en DB, no esté revocado y no haya vencido.
    - Revoca el refresh actual y persiste uno nuevo (rotación).
    - Lanza SesionInvalida si cualquier verificación falla.

    Retorna: (nuevo_access_token, nuevo_refresh_token_raw, nuevo_csrf_token, usuario)
    """
    token_hash = hash_refresh_token(refresh_token_raw)
    now = datetime.utcnow()

    db_token = db.scalar(
        select(RefreshToken).where(RefreshToken.token == token_hash)
    )

    if db_token is None or db_token.revoked:
        raise SesionInvalida("Token revocado o inexistente")

    if db_token.expires_at < now:
        raise SesionInvalida("Token vencido")

    usuario = db.get(Usuario, db_token.usuario_id)
    if usuario is None or not usuario.activo:
        raise SesionInvalida("Usuario inactivo o inexistente")

    # Revocar el refresh actual
    db_token.revoked = True

    # Emitir nuevo access token
    new_access = create_access_token({
        "sub": str(usuario.id),
        "rol": usuario.rol.value,
    })

    # Emitir y persistir nuevo refresh token
    new_refresh_raw = generate_refresh_token()
    new_refresh_hash = hash_refresh_token(new_refresh_raw)
    new_expires_at = datetime.utcnow() + timedelta(days=settings.JWT_REFRESH_EXPIRE_DAYS)

    new_db_token = RefreshToken(
        usuario_id=usuario.id,
        token=new_refresh_hash,
        expires_at=new_expires_at,
        revoked=False,
    )
    db.add(new_db_token)
    db.commit()

    new_csrf = generate_csrf_token()
    logger.info("Sesión renovada | usuario_id=%s", usuario.id)
    return new_access, new_refresh_raw, new_csrf, usuario


def revocar(db: Session, *, refresh_token_raw: str | None) -> None:
    """Revoca el refresh token (logout). Idempotente: no falla si está revocado o ausente."""
    if refresh_token_raw is None:
        return

    token_hash = hash_refresh_token(refresh_token_raw)
    db_token = db.scalar(
        select(RefreshToken).where(RefreshToken.token == token_hash)
    )

    if db_token is not None and not db_token.revoked:
        db_token.revoked = True
        db.commit()
        logger.info("Refresh token revocado | usuario_id=%s", db_token.usuario_id)
