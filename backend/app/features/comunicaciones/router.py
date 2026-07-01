"""
Router de la feature 'comunicaciones' (RF-16, RF-17, RF-18, RN-10, ADR-0003).

Endpoints (bajo el prefijo /api/v1 definido en main.py):
  POST /casos/{caso_id}/actualizacion          → genera borrador vía n8n WF-01 (200/401/403/404/503)
  GET  /internal/casos/{caso_id}/contexto      → herramienta interna del AI Agent (200/401/404)

Seguridad (checklist seguridad-endpoint — task 5.3):

  POST /casos/{caso_id}/actualizacion:
    ✅ JWT cookie HttpOnly (get_current_user via require_roles)
    ✅ CSRF double-submit (heredado del CSRFMiddleware para POST de navegador)
    ✅ RBAC ABOGADO / SOCIO (require_roles)
    ✅ Rate limiting 10/minute (limiter)
    ✅ Validación Pydantic en respuesta (ActualizacionResponse)
    ✅ Humano en el bucle: solo persiste el borrador; NO envía nada (RN-10)

  GET /internal/casos/{caso_id}/contexto:
    ✅ Secreto compartido X-Internal-Secret (verify_internal_secret)
    ✅ Sin cookie JWT / sin get_current_user (llamada server-to-server)
    ✅ Exento de CSRF (prefijo /internal en CSRFMiddleware + es GET)
    ✅ Datos minimizados: sin DNI/CUIL, sin montos ni plazos (ADR-0004, D5)
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, require_roles
from app.core.rate_limit import limiter
from app.features.auth.models import Usuario
from app.features.comunicaciones.dependencies import verify_internal_secret
from app.features.comunicaciones.schemas import ActualizacionResponse, ContextoCasoResponse
from app.features.comunicaciones.service import (
    CasoNoEncontrado,
    ServicioIANoDisponible,
    disparar_actualizacion,
    obtener_contexto_caso,
)
from app.shared.enums import RolUsuario

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
