"""
Router de agenda de vencimientos (RF-19, RF-20, UC-11).

Endpoints (todos bajo el prefijo /api/v1 definido en main.py):
  POST  /casos/{caso_id}/vencimientos  → crear vencimiento (201)
  GET   /casos/{caso_id}/vencimientos  → listar por caso (200)
  GET   /vencimientos?desde=&hasta=    → vista calendario del estudio (200)
  PATCH /vencimientos/{id}             → marcar completado (200)

Seguridad:
  GET   : get_current_user (lectura amplia — RN-08)
  POST/PATCH: require_roles(ABOGADO, SOCIO) + CSRF (CSRFMiddleware)
"""

import logging
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_db, require_roles
from app.core.rate_limit import limiter
from app.features.auth.models import Usuario
from app.features.vencimientos.schemas import (
    VencimientoAgendaResponse,
    VencimientoCompletar,
    VencimientoCreate,
    VencimientoResponse,
)
from app.features.vencimientos.service import (
    CasoNoEncontrado,
    VencimientoNoEncontrado,
    completar_vencimiento,
    crear_vencimiento,
    listar_vencimientos_caso,
    listar_vencimientos_rango,
)
from app.shared.enums import RolUsuario

router = APIRouter(tags=["vencimientos"])
logger = logging.getLogger("iuris.vencimientos")

_require_abogado_o_socio = require_roles(RolUsuario.ABOGADO, RolUsuario.SOCIO)


@router.post(
    "/casos/{caso_id}/vencimientos",
    response_model=VencimientoResponse,
    status_code=status.HTTP_201_CREATED,
)
@limiter.limit("100/minute")
async def post_vencimiento(
    request: Request,
    caso_id: int,
    datos: VencimientoCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(_require_abogado_o_socio),
) -> object:
    """Registra un movimiento/vencimiento en un caso (RF-19).

    - 201: vencimiento creado
    - 401: sin sesión activa
    - 403: sin rol ABOGADO/SOCIO
    - 404: caso no encontrado
    - 422: payload inválido
    """
    try:
        return crear_vencimiento(caso_id, datos, current_user.id, db)
    except CasoNoEncontrado:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Caso no encontrado")


@router.get(
    "/casos/{caso_id}/vencimientos",
    response_model=list[VencimientoResponse],
    status_code=status.HTTP_200_OK,
)
@limiter.limit("100/minute")
async def get_vencimientos_caso(
    request: Request,
    caso_id: int,
    db: Session = Depends(get_db),
    _current_user: Usuario = Depends(get_current_user),
) -> list:
    """Lista los vencimientos de un caso ordenados por fecha ASC (RF-19, RN-08).

    - 200: lista (vacía si no hay vencimientos)
    - 401: sin sesión activa
    - 404: caso no encontrado
    """
    try:
        return listar_vencimientos_caso(caso_id, db)
    except CasoNoEncontrado:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Caso no encontrado")


@router.get(
    "/vencimientos",
    response_model=list[VencimientoAgendaResponse],
    status_code=status.HTTP_200_OK,
)
@limiter.limit("100/minute")
async def get_vencimientos_rango(
    request: Request,
    desde: date = Query(..., description="Fecha inicio del rango (YYYY-MM-DD)"),
    hasta: date = Query(..., description="Fecha fin del rango (YYYY-MM-DD)"),
    db: Session = Depends(get_db),
    _current_user: Usuario = Depends(get_current_user),
) -> list:
    """Vista calendario del estudio: vencimientos en un rango de fechas (RF-20, UC-11).

    - 200: lista de vencimientos de todo el estudio en el rango
    - 401: sin sesión activa
    - 422: `desde` o `hasta` ausentes o con formato inválido
    """
    return listar_vencimientos_rango(desde, hasta, db)


@router.patch(
    "/vencimientos/{vencimiento_id}",
    response_model=VencimientoResponse,
    status_code=status.HTTP_200_OK,
)
@limiter.limit("100/minute")
async def patch_vencimiento(
    request: Request,
    vencimiento_id: int,
    datos: VencimientoCompletar,
    db: Session = Depends(get_db),
    _current_user: Usuario = Depends(_require_abogado_o_socio),
) -> object:
    """Marca un vencimiento como completado (o lo desmarca). Idempotente (RF-19).

    - 200: vencimiento actualizado
    - 401: sin sesión activa
    - 403: sin rol ABOGADO/SOCIO
    - 404: vencimiento no encontrado
    """
    try:
        return completar_vencimiento(vencimiento_id, datos.completado, db)
    except VencimientoNoEncontrado:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vencimiento no encontrado")
