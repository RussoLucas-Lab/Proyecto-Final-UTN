"""
Router de gestión de casos (RF-08 a RF-13, RN-01/04/05/06/08/09/11, ADR-0008).

Endpoints (todos bajo el prefijo /api/v1 definido en main.py):
  POST   /casos                     → crear caso (201)
  GET    /casos                     → listar con filtros paginados (200)
  GET    /casos/{id}                → detalle con transiciones válidas (200/404)
  PUT    /casos/{id}/ficha-laboral  → upsert ficha laboral (200/404)
  POST   /casos/{id}/avanzar        → avanzar etapa (200/404/409)
  POST   /casos/{id}/retroceder     → retroceder etapa (200/404/409)
  GET    /casos/{id}/historial      → historial inmutable (200/404)

Seguridad por endpoint (checklist task 3.11 · skill seguridad-endpoint):
  GET  /casos:              JWT cookie (get_current_user), rate 100/min. Sin CSRF (GET seguro).
  GET  /casos/{id}:         JWT cookie (get_current_user), rate 100/min. Sin CSRF.
  GET  /casos/{id}/historial: JWT cookie, rate 100/min. Sin CSRF.
  POST /casos:              JWT + require_roles(ABOGADO, SOCIO), CSRF double-submit,
                            rate 100/min, validación Pydantic (CasoCreate).
  PUT  /casos/{id}/ficha-laboral: JWT + require_roles, CSRF, rate 100/min.
  POST /casos/{id}/avanzar: JWT + require_roles, CSRF, rate 100/min.
  POST /casos/{id}/retroceder: JWT + require_roles, CSRF, rate 100/min.

Lectura amplia: todo usuario autenticado puede leer (RN-08, D7).
Mutaciones: ABOGADO y SOCIO (D7 — a diferencia de usuarios, ABOGADO también muta).
CSRF: heredado automáticamente del CSRFMiddleware para POST/PUT (D8).
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_db, require_roles
from app.core.rate_limit import limiter
from app.features.auth.models import Usuario
from app.features.casos.dependencies import get_caso_o_404
from app.features.casos.models import Caso, HistorialCaso
from app.features.casos.schemas import (
    AvanzarRequest,
    CasoCreate,
    CasoDetalleResponse,
    CasoResponse,
    FichaLaboralResponse,
    FichaLaboralUpsert,
    HistorialItemResponse,
    RetrocederRequest,
)
from app.features.casos.service import (
    CasoNoEncontrado,
    CatalogoEtapasVacio,
    ClienteOAbogadoInvalido,
    RetrocesoSinConfirmar,
    TransicionInvalida,
    avanzar_etapa,
    crear_caso,
    listar_casos,
    listar_etapas,
    listar_historial,
    obtener_detalle,
    retroceder_etapa,
    upsert_ficha_laboral,
)
from app.shared.enums import AreaDerecho, RolUsuario

router = APIRouter(prefix="/casos", tags=["casos"])
logger = logging.getLogger("iuris.casos")

# Guard de rol para mutaciones: ABOGADO y SOCIO (D7)
_require_abogado_o_socio = require_roles(RolUsuario.ABOGADO, RolUsuario.SOCIO)


# ── POST /casos ────────────────────────────────────────────────────────────────


@router.post("", response_model=CasoResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("100/minute")
async def post_caso(
    request: Request,
    datos: CasoCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(_require_abogado_o_socio),
) -> Caso:
    """Crea un caso nuevo (RF-08, RF-09, RN-01, RN-05).

    - 201: CasoResponse con datos del caso creado
    - 401: sin sesión activa
    - 403: el actor no es ABOGADO ni SOCIO
    - 404: cliente o abogado inexistente (RN-01)
    - 422: payload inválido (area/tipo_reclamo inconsistente, Pydantic)
    - 500: catálogo de etapas no sembrado (precondición operativa)

    CSRF: validado por CSRFMiddleware (double-submit cookie, D8).
    """
    try:
        return crear_caso(db, datos, current_user.id)
    except ClienteOAbogadoInvalido as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        )
    except CatalogoEtapasVacio as exc:
        logger.error("Catálogo de etapas vacío: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="El catálogo de etapas no está sembrado. Contactar al administrador.",
        )


# ── GET /casos ─────────────────────────────────────────────────────────────────


@router.get("", response_model=list[CasoResponse], status_code=status.HTTP_200_OK)
@limiter.limit("100/minute")
async def get_casos(
    request: Request,
    area: AreaDerecho | None = Query(default=None, description="Filtrar por área (LABORAL/ART)"),
    etapa_id: int | None = Query(default=None, description="Filtrar por etapa_actual_id"),
    abogado_id: int | None = Query(default=None, description="Filtrar por abogado_responsable_id"),
    cliente_id: int | None = Query(default=None, description="Filtrar por cliente_id"),
    page: int = Query(default=1, ge=1, description="Número de página (base 1)"),
    db: Session = Depends(get_db),
    _current_user: Usuario = Depends(get_current_user),
) -> list[Caso]:
    """Lista paginada de casos con filtros opcionales combinables (RF-13, D9).

    - 200: lista de CasoResponse (puede ser vacía)
    - 401: sin sesión activa
    - 429: rate limit excedido

    Lectura amplia: todo usuario autenticado puede listar (RN-08, D7).
    """
    return listar_casos(
        db,
        area=area,
        etapa_id=etapa_id,
        abogado_id=abogado_id,
        cliente_id=cliente_id,
        page=page,
    )


# ── GET /casos/etapas ─────────────────────────────────────────────────────────


@router.get("/etapas", response_model=list[EtapaResponse], status_code=status.HTTP_200_OK)
@limiter.limit("100/minute")
async def get_etapas_catalogo(
    request: Request,
    area: AreaDerecho = Query(..., description="Área (LABORAL/ART)"),
    db: Session = Depends(get_db),
    _current_user: Usuario = Depends(get_current_user),
) -> list:
    """Catálogo de etapas del área ordenadas por orden (ADR-0008).

    Permite al frontend renderizar el stepper visual completo sin hardcodear
    nombres ni estructura.

    - 200: lista de EtapaResponse
    - 401: sin sesión activa
    """
    return listar_etapas(db, area)


# ── GET /casos/{id} ────────────────────────────────────────────────────────────


@router.get("/{id}", response_model=CasoDetalleResponse, status_code=status.HTTP_200_OK)
@limiter.limit("100/minute")
async def get_caso(
    request: Request,
    caso: Caso = Depends(get_caso_o_404),
    db: Session = Depends(get_db),
    _current_user: Usuario = Depends(get_current_user),
) -> CasoDetalleResponse:
    """Detalle del caso con etapa actual, ficha y transiciones válidas (RF-13, D3).

    - 200: CasoDetalleResponse (incluye transiciones_validas para el stepper)
    - 401: sin sesión activa
    - 404: caso no encontrado

    Las transiciones_validas permiten al frontend renderizar el stepper sin hardcodear etapas.
    """
    return obtener_detalle(db, caso)


# ── PUT /casos/{id}/ficha-laboral ─────────────────────────────────────────────


@router.put(
    "/{id}/ficha-laboral",
    response_model=FichaLaboralResponse,
    status_code=status.HTTP_200_OK,
)
@limiter.limit("100/minute")
async def put_ficha_laboral(
    request: Request,
    id: int,
    datos: FichaLaboralUpsert,
    db: Session = Depends(get_db),
    _current_user: Usuario = Depends(_require_abogado_o_socio),
) -> object:
    """Crea o actualiza la ficha laboral del caso (RF-09).

    - 200: FichaLaboralResponse actualizada/creada
    - 401: sin sesión activa
    - 403: el actor no es ABOGADO ni SOCIO
    - 404: caso no encontrado
    - 422: payload inválido (Pydantic)

    CSRF: validado por CSRFMiddleware.
    """
    try:
        return upsert_ficha_laboral(db, id, datos)
    except CasoNoEncontrado:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Caso no encontrado",
        )


# ── POST /casos/{id}/avanzar ───────────────────────────────────────────────────


@router.post(
    "/{id}/avanzar",
    response_model=CasoResponse,
    status_code=status.HTTP_200_OK,
)
@limiter.limit("100/minute")
async def post_avanzar(
    request: Request,
    datos: AvanzarRequest,
    caso: Caso = Depends(get_caso_o_404),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(_require_abogado_o_socio),
) -> Caso:
    """Avanza el caso a la etapa destino validando la transición (RF-10, RN-04, D3).

    - 200: CasoResponse con la nueva etapa_actual_id
    - 401: sin sesión
    - 403: sin rol
    - 404: caso o etapa destino inexistente
    - 409: transición no permitida (etapa_destino_id no es alcanzable desde la actual)

    CSRF: validado por CSRFMiddleware.
    """
    try:
        return avanzar_etapa(db, caso, datos.etapa_destino_id, current_user.id)
    except TransicionInvalida as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        )


# ── POST /casos/{id}/retroceder ───────────────────────────────────────────────


@router.post(
    "/{id}/retroceder",
    response_model=CasoResponse,
    status_code=status.HTTP_200_OK,
)
@limiter.limit("100/minute")
async def post_retroceder(
    request: Request,
    datos: RetrocederRequest,
    caso: Caso = Depends(get_caso_o_404),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(_require_abogado_o_socio),
) -> Caso:
    """Retrocede el caso de etapa con confirmación en terminal (RF-11, RN-09, D4).

    - 200: CasoResponse con la nueva etapa_actual_id
    - 401: sin sesión
    - 403: sin rol
    - 404: caso o etapa destino inexistente
    - 409: desde etapa terminal sin confirmar=true (RN-09), o destino de otra área (RN-11)

    CSRF: validado por CSRFMiddleware.
    """
    try:
        return retroceder_etapa(
            db,
            caso,
            datos.etapa_destino_id,
            datos.confirmar,
            current_user.id,
        )
    except RetrocesoSinConfirmar as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        )
    except TransicionInvalida as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        )


# ── GET /casos/{id}/historial ─────────────────────────────────────────────────


@router.get(
    "/{id}/historial",
    response_model=list[HistorialItemResponse],
    status_code=status.HTTP_200_OK,
)
@limiter.limit("100/minute")
async def get_historial(
    request: Request,
    caso: Caso = Depends(get_caso_o_404),
    db: Session = Depends(get_db),
    _current_user: Usuario = Depends(get_current_user),
) -> list[HistorialCaso]:
    """Historial cronológico e inmutable del caso (RF-12, RN-06, D5).

    - 200: lista de HistorialItemResponse en orden cronológico
    - 401: sin sesión
    - 404: caso no encontrado

    No existe endpoint de update ni delete de historial (RN-06 — append-only).
    """
    return listar_historial(db, caso.id)
