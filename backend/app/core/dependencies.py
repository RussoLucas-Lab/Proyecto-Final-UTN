"""
Dependencias FastAPI transversales: sesión de DB, usuario autenticado y RBAC.

Expone:
  get_db            → sesión SQLAlchemy por request (re-exportada de database.py)
  get_current_user  → usuario activo a partir del access token cookie (401 si inválido)
  require_roles     → factory de dependencia que exige uno de los roles dados (403 si no)
  require_socio     → atajo para require_roles(RolUsuario.SOCIO)
"""

import logging
from collections.abc import Generator

import jwt
from fastapi import Cookie, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db as _get_db
from app.core.security import decode_access_token
from app.features.auth.models import Usuario
from app.shared.enums import RolUsuario

security_logger = logging.getLogger("iuris.security")


# ── DB ─────────────────────────────────────────────────────────────────────────


def get_db() -> Generator[Session, None, None]:
    """Dependencia FastAPI: sesión de DB por request.

    Re-exportada desde core/database.py para centralizar las importaciones
    en los routers (from app.core.dependencies import get_db).
    """
    yield from _get_db()


# ── Sesión de usuario ──────────────────────────────────────────────────────────


def get_current_user(
    access_token: str | None = Cookie(default=None),
    db: Session = Depends(get_db),
) -> Usuario:
    """Resuelve el usuario autenticado a partir del access token cookie.

    Retorna el Usuario activo.
    Lanza HTTP 401 si el token falta, es inválido, está vencido o el usuario está inactivo.
    """
    if access_token is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No autenticado",
        )

    try:
        payload = decode_access_token(access_token)
        user_id: int = int(payload["sub"])
    except (jwt.InvalidTokenError, KeyError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sesión inválida o vencida",
        )

    user = db.get(Usuario, user_id)
    if user is None or not user.activo:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sesión inválida o vencida",
        )

    return user


# ── RBAC ───────────────────────────────────────────────────────────────────────


def require_roles(*roles: RolUsuario):
    """Factory: retorna una dependencia que exige que el usuario tenga uno de los roles.

    Uso como dependencia tipada:
        def endpoint(user: Annotated[Usuario, Depends(require_roles(RolUsuario.SOCIO))]):
            ...

    Uso como dependencia de ruta:
        @router.get("/...", dependencies=[Depends(require_roles(RolUsuario.SOCIO))])
    """

    def _check(current_user: Usuario = Depends(get_current_user)) -> Usuario:
        if current_user.rol not in roles:
            security_logger.warning(
                "Acceso denegado | usuario_id=%s rol=%s requiere=%s",
                current_user.id,
                current_user.rol,
                [r.value for r in roles],
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Sin permiso para esta operación",
            )
        return current_user

    return _check


# Atajo para operaciones exclusivas de SOCIO (p. ej. gestión de usuarios)
require_socio = require_roles(RolUsuario.SOCIO)
