"""
Router de la feature 'telegramas' (RN-15, RN-16).

Endpoints (todos bajo el prefijo /api/v1 definido en main.py):
  GET   /casos/{caso_id}/telegramas   → listar telegramas del caso (200)
  POST  /casos/{caso_id}/telegramas   → registrar un telegrama nuevo (201)
  PATCH /telegramas/{telegrama_id}    → actualizar resultado (200)

Seguridad por endpoint:
  GET  /casos/{caso_id}/telegramas:  JWT cookie (get_current_user), rate 100/min. Sin CSRF.
  POST /casos/{caso_id}/telegramas:  JWT + require_roles(ABOGADO, SOCIO), CSRF, rate 100/min.
  PATCH /telegramas/{telegrama_id}:  JWT + require_roles(ABOGADO, SOCIO), CSRF, rate 100/min.

Lectura amplia: todo usuario autenticado puede leer (RN-08).
Mutaciones: ABOGADO y SOCIO.
CSRF: heredado automáticamente del CSRFMiddleware para POST/PATCH.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_db, require_roles
from app.core.rate_limit import limiter
from app.features.auth.models import Usuario
from app.features.telegramas.schemas import (
    ResultadoUpdateRequest,
    TelegramaCreate,
    TelegramaResponse,
)
from app.features.telegramas.service import (
    CasoNoEncontrado,
    CasoNoEsLaboral,
    LimiteTelegramasAlcanzado,
    NumeroTelegramaDuplicado,
    ResultadoInvalido,
    TelegramaNoEncontrado,
    actualizar_resultado,
    get_telegramas_caso,
    registrar_telegrama,
    upsert_resultado_telegrama,
)
from app.shared.enums import RolUsuario

router = APIRouter(tags=["telegramas"])
logger = logging.getLogger("iuris.telegramas")

_require_abogado_o_socio = require_roles(RolUsuario.ABOGADO, RolUsuario.SOCIO)


# ── GET /casos/{caso_id}/telegramas ───────────────────────────────────────────


@router.get(
    "/casos/{caso_id}/telegramas",
    response_model=list[TelegramaResponse],
    status_code=status.HTTP_200_OK,
)
@limiter.limit("100/minute")
async def get_telegramas(
    request: Request,
    caso_id: int,
    db: Session = Depends(get_db),
    _current_user: Usuario = Depends(get_current_user),
) -> list:
    """Lista los telegramas del caso ordenados por número (RN-16).

    - 200: lista de TelegramaResponse (puede ser vacía)
    - 401: sin sesión activa
    - 429: rate limit excedido

    Lectura amplia: todo usuario autenticado puede listar (RN-08).
    """
    return get_telegramas_caso(db, caso_id)


# ── POST /casos/{caso_id}/telegramas ──────────────────────────────────────────


@router.post(
    "/casos/{caso_id}/telegramas",
    response_model=TelegramaResponse,
    status_code=status.HTTP_201_CREATED,
)
@limiter.limit("100/minute")
async def post_telegrama(
    request: Request,
    caso_id: int,
    datos: TelegramaCreate,
    db: Session = Depends(get_db),
    _current_user: Usuario = Depends(_require_abogado_o_socio),
) -> object:
    """Registra un telegrama nuevo para el caso (RN-15, RN-16).

    - 201: TelegramaResponse con el telegrama creado
    - 401: sin sesión activa
    - 403: el actor no es ABOGADO ni SOCIO
    - 404: caso no encontrado
    - 409: límite de 3 telegramas alcanzado, o número duplicado en el caso
    - 422: caso no es de área LABORAL, o payload inválido (Pydantic)

    CSRF: validado por CSRFMiddleware (double-submit cookie).
    """
    try:
        return registrar_telegrama(db, caso_id, datos)
    except CasoNoEncontrado as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        )
    except CasoNoEsLaboral as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        )
    except LimiteTelegramasAlcanzado as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        )
    except NumeroTelegramaDuplicado as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        )


# ── PUT /casos/{caso_id}/telegramas/{numero}/resultado ───────────────────────


@router.put(
    "/casos/{caso_id}/telegramas/{numero}/resultado",
    response_model=TelegramaResponse,
    status_code=status.HTTP_200_OK,
)
@limiter.limit("100/minute")
async def put_resultado_telegrama(
    request: Request,
    caso_id: int,
    numero: int,
    datos: ResultadoUpdateRequest,
    db: Session = Depends(get_db),
    _current_user: Usuario = Depends(_require_abogado_o_socio),
) -> object:
    """Crea o actualiza el resultado del telegrama N del caso (upsert).

    - 200: TelegramaResponse con el resultado guardado
    - 401: sin sesión activa
    - 403: el actor no es ABOGADO ni SOCIO
    - 404: caso no encontrado
    - 422: caso no es LABORAL, resultado PENDIENTE no permitido, o numero fuera de rango

    CSRF: validado por CSRFMiddleware.
    """
    if numero not in (1, 2, 3):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="El número de telegrama debe ser 1, 2 o 3",
        )
    try:
        return upsert_resultado_telegrama(db, caso_id, numero, datos.resultado)
    except CasoNoEncontrado as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except CasoNoEsLaboral as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))
    except ResultadoInvalido as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))


# ── PATCH /telegramas/{telegrama_id} ─────────────────────────────────────────


@router.patch(
    "/telegramas/{telegrama_id}",
    response_model=TelegramaResponse,
    status_code=status.HTTP_200_OK,
)
@limiter.limit("100/minute")
async def patch_resultado(
    request: Request,
    telegrama_id: int,
    datos: ResultadoUpdateRequest,
    db: Session = Depends(get_db),
    _current_user: Usuario = Depends(_require_abogado_o_socio),
) -> object:
    """Actualiza el resultado de un telegrama existente.

    - 200: TelegramaResponse con el resultado actualizado
    - 401: sin sesión activa
    - 403: el actor no es ABOGADO ni SOCIO
    - 404: telegrama no encontrado
    - 422: resultado PENDIENTE no permitido manualmente

    CSRF: validado por CSRFMiddleware (double-submit cookie).
    """
    try:
        return actualizar_resultado(db, telegrama_id, datos.resultado)
    except TelegramaNoEncontrado as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        )
    except ResultadoInvalido as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        )
