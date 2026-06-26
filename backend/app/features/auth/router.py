"""
Router de autenticación.

Endpoints (todos bajo el prefijo /api/v1 definido en main.py):
  POST /auth/login   → login con credenciales; emite cookies + perfil (rate limit 5/min)
  POST /auth/refresh → rota refresh y emite nuevo access token (CSRF requerido)
  POST /auth/logout  → revoca refresh, limpia cookies (CSRF requerido; idempotente)

Seguridad aplicada por endpoint (checklist task 3.7):
  login:   sin auth previa, exento de CSRF (middleware), rate limit ~5/min, validación Pydantic
  refresh: sin auth JWT (usa refresh cookie), CSRF validado por middleware, sin RBAC
  logout:  sin auth JWT requerida (idempotente), CSRF validado por middleware, sin RBAC
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_db
from app.core.rate_limit import limiter
from app.core.security import clear_session_cookies, set_session_cookies
from app.features.auth.dependencies import get_refresh_cookie
from app.features.auth.schemas import LoginRequest, PerfilResponse
from app.features.auth.service import (
    CredencialesInvalidas,
    SesionInvalida,
    autenticar,
    emitir_sesion,
    renovar,
    revocar,
)

router = APIRouter(prefix="/auth", tags=["auth"])
logger = logging.getLogger("iuris.auth")


@router.post("/login", response_model=PerfilResponse, status_code=status.HTTP_200_OK)
@limiter.limit("5/minute")
async def login(
    request: Request,  # requerido por SlowAPI para leer la IP del cliente
    credentials: LoginRequest,
    response: Response,
    db: Session = Depends(get_db),
) -> PerfilResponse:
    """Autentica al usuario y emite tokens de sesión en cookies seguras.

    - 200: login exitoso; cookies seteadas + perfil devuelto en el body
    - 401: credenciales inválidas o cuenta inactiva (mensaje genérico)
    - 422: payload inválido (Pydantic)
    - 429: demasiados intentos de login (rate limit ~5/min por IP)

    Nota: este endpoint está exento de CSRF (ver CSRFMiddleware) porque
    en el primer login no existe aún cookie csrf_token.
    """
    try:
        usuario = autenticar(db, email=credentials.email, password=credentials.password)
    except CredencialesInvalidas:
        # Mensaje genérico: no revelar si el email existe o no
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales inválidas",
        )

    access_token, refresh_token_raw, csrf_token = emitir_sesion(db, usuario=usuario)
    set_session_cookies(
        response,
        access_token=access_token,
        refresh_token=refresh_token_raw,
        csrf_token=csrf_token,
    )

    return PerfilResponse(rol=usuario.rol, nombre=usuario.nombre)


@router.post("/refresh", response_model=PerfilResponse, status_code=status.HTTP_200_OK)
async def refresh(
    response: Response,
    refresh_token_raw: str | None = Depends(get_refresh_cookie),
    db: Session = Depends(get_db),
) -> PerfilResponse:
    """Rota el refresh token y emite un nuevo access token.

    - 200: renovación exitosa; nuevas cookies seteadas + perfil en body
    - 401: refresh ausente, revocado o vencido

    CSRF: validado por CSRFMiddleware (el frontend debe reenviar X-CSRF-Token).
    """
    if refresh_token_raw is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sesión no encontrada",
        )

    try:
        new_access, new_refresh, new_csrf, usuario = renovar(
            db, refresh_token_raw=refresh_token_raw
        )
    except SesionInvalida:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sesión inválida o vencida",
        )

    set_session_cookies(
        response,
        access_token=new_access,
        refresh_token=new_refresh,
        csrf_token=new_csrf,
    )

    return PerfilResponse(rol=usuario.rol, nombre=usuario.nombre)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    response: Response,
    refresh_token_raw: str | None = Depends(get_refresh_cookie),
    db: Session = Depends(get_db),
) -> None:
    """Cierra la sesión: revoca el refresh token y limpia las cookies.

    Idempotente: si no hay sesión activa o el refresh ya fue revocado,
    igual limpia las cookies y responde 204 sin error.

    CSRF: validado por CSRFMiddleware (el frontend debe reenviar X-CSRF-Token).
    """
    revocar(db, refresh_token_raw=refresh_token_raw)
    clear_session_cookies(response)
    logger.info("Logout | refresh_presente=%s", refresh_token_raw is not None)
