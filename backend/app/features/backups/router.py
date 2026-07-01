"""
Router de la feature 'backups' (RF-21, RF-22, ADR-0003).

Endpoints (bajo el prefijo /api/v1 definido en main.py):

  GET  /backups               → historial de respaldos (200/401/403)
  POST /backups               → disparar respaldo manual vía n8n WF-02 (202/401/403/503)
  POST /internal/backups      → registrar resultado de n8n (201/401/422)

Seguridad (checklist seguridad-endpoint):

  GET /backups:
    ✅ JWT cookie HttpOnly (get_current_user via require_roles)
    ✅ RBAC SOCIO (require_roles) — historial operacional sensible (D6)
    ✅ Rate limiting 100/minute (limiter)
    ✅ CSRF: no aplica (GET, método seguro)

  POST /backups:
    ✅ JWT cookie HttpOnly (get_current_user via require_roles)
    ✅ CSRF double-submit (heredado del CSRFMiddleware para POST de navegador)
    ✅ RBAC SOCIO (require_roles)
    ✅ Rate limiting 20/minute (limiter)
    ✅ 503 claro si n8n no está disponible (D1)

  POST /internal/backups:
    ✅ Secreto compartido X-Internal-Secret (verify_internal_secret, reutilizado de comunicaciones — D5)
    ✅ Sin cookie JWT / sin get_current_user (llamada server-to-server)
    ✅ Exento de CSRF (prefijo /internal en CSRFMiddleware)
    ✅ Sin datos sensibles de clientes en la respuesta
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.dependencies import get_current_user, get_db, require_roles
from app.core.rate_limit import limiter
from app.features.auth.models import Usuario
from app.features.backups.schemas import (
    BackupRegistrarRequest,
    BackupResponse,
    BackupTriggerResponse,
)
from app.features.backups.service import (
    BackupN8nNoDisponible,
    listar_backups,
    registrar_backup,
    trigger_backup_manual,
)
from app.features.comunicaciones.dependencies import verify_internal_secret
from app.shared.enums import RolUsuario

router = APIRouter(tags=["backups"])
logger = logging.getLogger("iuris.backups")

_require_socio = require_roles(RolUsuario.SOCIO)


# ── GET /backups ───────────────────────────────────────────────────────────────


@router.get(
    "/backups",
    response_model=list[BackupResponse],
    status_code=status.HTTP_200_OK,
)
@limiter.limit("100/minute")
async def get_backups(
    request: Request,
    db: Session = Depends(get_db),
    _current_user: Usuario = Depends(_require_socio),
) -> list[BackupResponse]:
    """Historial de respaldos ordenado por fecha DESC (RF-22).

    Solo accesible por SOCIO: información operacional sensible (D6).

    - 200: list[BackupResponse]
    - 401: sin sesión activa
    - 403: sin rol SOCIO

    Auth: cookie JWT (require_roles(SOCIO)). CSRF: no aplica (GET).
    """
    return listar_backups(db)


# ── POST /backups ──────────────────────────────────────────────────────────────


@router.post(
    "/backups",
    response_model=BackupTriggerResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
@limiter.limit("20/minute")
async def post_backups(
    request: Request,
    _current_user: Usuario = Depends(_require_socio),
) -> BackupTriggerResponse:
    """Dispara un respaldo manual vía n8n WF-02 (RF-21, D1).

    No ejecuta el respaldo directamente: envía POST al webhook de WF-02 y
    devuelve 202 Accepted. n8n ejecuta el backup en background y al finalizar
    llama a POST /internal/backups para registrar el resultado.

    - 202: BackupTriggerResponse { mensaje }
    - 401: sin sesión activa
    - 403: sin rol SOCIO o CSRF inválido
    - 503: n8n no disponible (el respaldo NO se registra como fallido — nunca llegó)

    CSRF: validado por CSRFMiddleware (double-submit cookie, POST de navegador).
    """
    try:
        trigger_backup_manual(
            webhook_url=settings.N8N_WF02_WEBHOOK_URL,
            internal_secret=settings.N8N_INTERNAL_SECRET,
        )
    except BackupN8nNoDisponible:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "error": "Servicio de respaldo no disponible",
                "detail": "No se pudo conectar con n8n. Intentá nuevamente en unos minutos.",
            },
        )
    return BackupTriggerResponse(
        mensaje="Respaldo manual iniciado. El resultado quedará registrado en el historial."
    )


# ── POST /internal/backups ─────────────────────────────────────────────────────


@router.post(
    "/internal/backups",
    response_model=BackupResponse,
    status_code=status.HTTP_201_CREATED,
)
async def post_internal_backups(
    payload: BackupRegistrarRequest,
    db: Session = Depends(get_db),
    _: None = Depends(verify_internal_secret),
) -> BackupResponse:
    """Registra el resultado de un respaldo ejecutado por n8n WF-02 (D2).

    Llamado por n8n al finalizar el backup (exitoso o fallido). Crea el
    registro en la tabla `backup` con tipo, estado y ubicación del archivo.

    - 201: BackupResponse { id, fecha, tipo, estado, ubicacion }
    - 401: secreto X-Internal-Secret ausente o inválido
    - 422: payload inválido (tipo/estado fuera de enums)

    Auth: secreto compartido X-Internal-Secret (NO cookie JWT).
    CSRF: exento (prefijo /internal en CSRFMiddleware).
    """
    backup = registrar_backup(db, payload)
    return BackupResponse.model_validate(backup)
