"""
Router de la feature 'comunicaciones' (RF-16..18, RF-26, RN-10, RN-19..23, ADR-0003).

Endpoints (bajo el prefijo /api/v1 definido en main.py):

  Flujo individual (WF-01):
    POST /casos/{caso_id}/actualizacion               → genera borrador vía n8n WF-01 (200/401/403/404/503)
    GET  /internal/casos/{caso_id}/contexto            → herramienta interna del AI Agent (200/401/404)

  Flujo batch (WF-05, RF-26):
    GET  /internal/casos/pendientes-actualizacion      → casos que vencen hoy (200/401)
    POST /internal/casos/{caso_id}/comunicaciones      → persiste borrador automático (201/401/404/409)
    GET  /comunicaciones                               → lista borradores para revisión (200/401/422)
    PATCH /comunicaciones/{comunicacion_id}             → aprobar/descartar (200/403/404/409/422)

Seguridad (checklist seguridad-endpoint):

  POST /casos/{caso_id}/actualizacion:
    ✅ JWT cookie HttpOnly (get_current_user via require_roles)
    ✅ CSRF double-submit (heredado del CSRFMiddleware para POST de navegador)
    ✅ RBAC ABOGADO / SOCIO (require_roles)
    ✅ Rate limiting 10/minute (limiter)
    ✅ Validación Pydantic en respuesta (ActualizacionResponse)
    ✅ Humano en el bucle: solo persiste el borrador; NO envía nada (RN-10)

  GET /internal/casos/{caso_id}/contexto:
  GET /internal/casos/pendientes-actualizacion:
  POST /internal/casos/{caso_id}/comunicaciones:
    ✅ Secreto compartido X-Internal-Secret (verify_internal_secret)
    ✅ Sin cookie JWT / sin get_current_user (llamada server-to-server, D3)
    ✅ Exento de CSRF (prefijo /internal en CSRFMiddleware)
    ✅ Datos minimizados: sin DNI/CUIL, sin montos ni plazos (ADR-0004, D5)
    ✅ El POST nunca dispara un envío al cliente (RN-19); idempotente (RN-22)

  GET /comunicaciones:
    ✅ JWT cookie HttpOnly (get_current_user) — lectura amplia, RN-08
    ✅ Rate limiting 30/minute (limiter)
    ✅ `estado` validado contra EstadoComunicacion (422 si inválido)
    ✅ Sin DNI/CUIL ni montos en la respuesta (ADR-0004, D7)

  PATCH /comunicaciones/{comunicacion_id}:
    ✅ JWT cookie HttpOnly + RBAC ABOGADO/SOCIO (require_roles)
    ✅ CSRF double-submit (heredado del CSRFMiddleware para mutaciones de navegador)
    ✅ Rate limiting 20/minute (limiter)
    ✅ `estado` restringido a APROBADO/DESCARTADO (ComunicacionPatchRequest)
    ✅ Nunca dispara un envío al cliente (RN-10/RN-19)
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_db, require_roles
from app.core.rate_limit import limiter
from app.features.auth.models import Usuario
from app.features.comunicaciones.dependencies import verify_internal_secret
from app.features.comunicaciones.schemas import (
    ActualizacionResponse,
    BorradorPendienteResponse,
    ComunicacionInternaResponse,
    ComunicacionPatchRequest,
    ComunicacionPatchResponse,
    ContextoCasoResponse,
    CrearComunicacionInternaRequest,
    PendientesActualizacionResponse,
)
from app.features.comunicaciones.service import (
    BorradorAutomaticoDuplicado,
    CasoNoEncontrado,
    ComunicacionNoEncontrada,
    ComunicacionNoPendiente,
    ServicioIANoDisponible,
    calcular_casos_pendientes,
    disparar_actualizacion,
    listar_comunicaciones,
    obtener_contexto_caso,
    persistir_borrador_automatico,
    revisar_comunicacion,
)
from app.shared.enums import EstadoComunicacion, RolUsuario

router = APIRouter(tags=["comunicaciones"])
logger = logging.getLogger("iuris.comunicaciones")

_require_abogado_o_socio = require_roles(RolUsuario.ABOGADO, RolUsuario.SOCIO)


# ── POST /casos/{caso_id}/actualizacion ───────────────────────────────────────


@router.post(
    "/casos/{caso_id}/actualizacion",
    response_model=ActualizacionResponse,
    status_code=status.HTTP_200_OK,
)
@limiter.limit("10/minute")
async def post_actualizacion(
    request: Request,
    caso_id: int,
    db: Session = Depends(get_db),
    _current_user: Usuario = Depends(_require_abogado_o_socio),
) -> object:
    """Genera un borrador de actualización para el caso usando n8n (WF-01).

    Dispara el webhook de WF-01, espera el texto generado por el AI Agent,
    persiste el borrador como comunicacion(tipo=MANUAL, estado=PENDIENTE_REVISION)
    y lo devuelve. No envía nada al cliente (RN-10).

    - 200: ActualizacionResponse { id, borrador, generado_en }
    - 401: sin sesión activa
    - 403: sin rol ABOGADO/SOCIO o CSRF inválido
    - 404: caso no encontrado
    - 503: n8n no disponible (timeout, conexión, 5xx, sin texto)

    CSRF: validado por CSRFMiddleware (double-submit cookie, POST de navegador).
    """
    try:
        return await disparar_actualizacion(caso_id, db)
    except CasoNoEncontrado:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Caso no encontrado",
        )
    except ServicioIANoDisponible:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "error": "Servicio de IA no disponible",
                "detail": "Reintentá o redactá el borrador manualmente.",
            },
        )


# ── GET /internal/casos/{caso_id}/contexto ────────────────────────────────────


@router.get(
    "/internal/casos/{caso_id}/contexto",
    response_model=ContextoCasoResponse,
    status_code=status.HTTP_200_OK,
)
async def get_contexto_caso(
    caso_id: int,
    db: Session = Depends(get_db),
    _: None = Depends(verify_internal_secret),
) -> ContextoCasoResponse:
    """Herramienta interna del AI Agent de n8n: contexto seguro del caso.

    Devuelve nombre del cliente, etapa actual y últimas novedades (vencimientos
    pendientes). Sin DNI/CUIL, montos ni datos de terceros (ADR-0004, D5).

    - 200: ContextoCasoResponse { cliente, etapa, ultimas_novedades }
    - 401: secreto ausente o inválido
    - 404: caso no encontrado

    Auth: secreto compartido X-Internal-Secret (NO cookie JWT de usuario).
    CSRF: exento (prefijo /internal en CSRFMiddleware + método GET).
    """
    try:
        return obtener_contexto_caso(caso_id, db)
    except CasoNoEncontrado:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Caso no encontrado",
        )


# ── GET /internal/casos/pendientes-actualizacion ──────────────────────────────


@router.get(
    "/internal/casos/pendientes-actualizacion",
    response_model=PendientesActualizacionResponse,
    status_code=status.HTTP_200_OK,
)
async def get_casos_pendientes_actualizacion(
    db: Session = Depends(get_db),
    _: None = Depends(verify_internal_secret),
) -> PendientesActualizacionResponse:
    """Casos activos que vencen hoy para actualización de 15 días (RF-26.1).

    La cadencia y la idempotencia se calculan en el backend (D1): etapa no
    terminal (RN-20) + sin borrador automático pendiente (RN-22) + >=15 días
    desde la última actualización aprobada o desde el inicio del caso (RN-21).

    - 200: PendientesActualizacionResponse { casos_pendientes: [caso_id, ...] }
    - 401: secreto ausente o inválido

    Auth: secreto compartido X-Internal-Secret (NO cookie JWT de usuario).
    CSRF: exento (prefijo /internal en CSRFMiddleware + método GET).
    """
    casos = calcular_casos_pendientes(db)
    return PendientesActualizacionResponse(casos_pendientes=casos)


# ── POST /internal/casos/{caso_id}/comunicaciones ─────────────────────────────


@router.post(
    "/internal/casos/{caso_id}/comunicaciones",
    response_model=ComunicacionInternaResponse,
    status_code=status.HTTP_201_CREATED,
)
async def post_comunicacion_interna(
    caso_id: int,
    payload: CrearComunicacionInternaRequest,
    db: Session = Depends(get_db),
    _: None = Depends(verify_internal_secret),
) -> object:
    """Persiste un borrador generado por el AI Agent de WF-05 (RF-26.2).

    Crea comunicacion(tipo=ACTUALIZACION_AUTOMATICA, estado=PENDIENTE_REVISION).
    No dispara ningún envío al cliente (RN-19).

    - 201: ComunicacionInternaResponse { id, estado, generado_en }
    - 401: secreto ausente o inválido
    - 404: caso no encontrado
    - 409: ya existe un borrador automático PENDIENTE_REVISION para el caso (RN-22)

    Auth: secreto compartido X-Internal-Secret (NO cookie JWT de usuario).
    CSRF: exento (prefijo /internal en CSRFMiddleware).
    """
    try:
        return persistir_borrador_automatico(db, caso_id, payload.contenido)
    except CasoNoEncontrado:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Caso no encontrado",
        )
    except BorradorAutomaticoDuplicado:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe un borrador automático pendiente de revisión para este caso",
        )


# ── GET /comunicaciones ────────────────────────────────────────────────────────


@router.get(
    "/comunicaciones",
    response_model=list[BorradorPendienteResponse],
    status_code=status.HTTP_200_OK,
)
@limiter.limit("30/minute")
async def get_comunicaciones(
    request: Request,
    estado: EstadoComunicacion | None = Query(default=None),
    db: Session = Depends(get_db),
    _current_user: Usuario = Depends(get_current_user),
) -> list[BorradorPendienteResponse]:
    """Lista borradores de comunicación para revisión (RF-26.4).

    Todo usuario autenticado puede leer (lectura amplia, RN-08). Devuelve, por
    borrador: id, caso_id, cliente, área, etapa, preview, estado, generado_en.
    Sin DNI/CUIL ni montos (ADR-0004, D7).

    - 200: list[BorradorPendienteResponse]
    - 401: sin sesión activa
    - 422: `estado` no pertenece a EstadoComunicacion

    Auth: cookie JWT (get_current_user). CSRF: no aplica (GET, método seguro).
    """
    return listar_comunicaciones(db, estado)


# ── PATCH /comunicaciones/{comunicacion_id} ───────────────────────────────────


@router.patch(
    "/comunicaciones/{comunicacion_id}",
    response_model=ComunicacionPatchResponse,
    status_code=status.HTTP_200_OK,
)
@limiter.limit("20/minute")
async def patch_comunicacion(
    request: Request,
    comunicacion_id: int,
    payload: ComunicacionPatchRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(_require_abogado_o_socio),
) -> object:
    """Aprueba o descarta un borrador (RF-26.4, D4).

    Aprobar registra aprobado_por/aprobado_en=now() y reinicia la ventana de
    cadencia de 15 días del caso. Nunca envía nada al cliente (RN-10/RN-19).

    - 200: ComunicacionPatchResponse { id, estado, aprobado_por, aprobado_en }
    - 403: sin rol ABOGADO/SOCIO o CSRF inválido
    - 404: comunicación no encontrada
    - 409: la comunicación ya fue revisada (no está en PENDIENTE_REVISION)
    - 422: `estado` fuera de {APROBADO, DESCARTADO}

    CSRF: validado por CSRFMiddleware (double-submit cookie, mutación de navegador).
    """
    try:
        return revisar_comunicacion(
            db, comunicacion_id, EstadoComunicacion(payload.estado), current_user.id
        )
    except ComunicacionNoEncontrada:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Comunicación no encontrada",
        )
    except ComunicacionNoPendiente:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="La comunicación ya fue revisada",
        )
