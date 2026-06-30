"""
Router de gestión documental (RF-14, RF-15, RN-02, RN-12, ADR-0007).

Endpoints (todos bajo el prefijo /api/v1 definido en main.py):
  POST   /casos/{caso_id}/documentos:init   → URL prefirmada de subida (200)
  POST   /casos/{caso_id}/documentos        → registrar metadata tras la subida (201)
  GET    /casos/{caso_id}/documentos        → listar documentos del caso (200)
  GET    /documentos/{documento_id}/url     → URL prefirmada de descarga (200)

Seguridad:
  POST/GET con auth  : get_current_user (401 si sin sesión)
  POST (mutaciones)  : require_roles(ABOGADO, SOCIO) — el cliente nunca sube (RN-12)
  GET /documentos/url: require_roles(ABOGADO, SOCIO)
  GET /casos/{id}/documentos: lectura amplia para todo usuario autenticado (RN-08)
  CSRF               : heredado del CSRFMiddleware para POST
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_db, require_roles
from app.core.rate_limit import limiter
from app.core.storage import StorageClient, get_storage_client
from app.features.auth.models import Usuario
from app.features.documentos.schemas import (
    DocumentoDownloadResponse,
    DocumentoInitRequest,
    DocumentoInitResponse,
    DocumentoRegisterRequest,
    DocumentoResponse,
)
from app.features.documentos.service import (
    CasoNoEncontrado,
    DocumentoNoEncontrado,
    get_download_url,
    init_upload,
    list_documentos,
    register_documento,
)
from app.shared.enums import RolUsuario

router = APIRouter(tags=["documentos"])
logger = logging.getLogger("iuris.documentos")

_require_abogado_o_socio = require_roles(RolUsuario.ABOGADO, RolUsuario.SOCIO)


# ── POST /casos/{caso_id}/documentos:init ─────────────────────────────────────


@router.post(
    "/casos/{caso_id}/documentos:init",
    response_model=DocumentoInitResponse,
    status_code=status.HTTP_200_OK,
)
@limiter.limit("100/minute")
async def post_documentos_init(
    request: Request,
    caso_id: int,
    datos: DocumentoInitRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(_require_abogado_o_socio),
    storage: StorageClient = Depends(get_storage_client),
) -> DocumentoInitResponse:
    """Genera URL prefirmada de subida (PUT S3) para un archivo del caso (RF-14).

    - 200: DocumentoInitResponse con upload_url, object_key y expires_in
    - 401: sin sesión activa
    - 403: sin rol ABOGADO/SOCIO (RN-12)
    - 404: caso no encontrado
    - 422: payload inválido (formato no permitido)

    CSRF: validado por CSRFMiddleware.
    """
    try:
        return init_upload(caso_id, datos, storage, db)
    except CasoNoEncontrado:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Caso no encontrado")


# ── POST /casos/{caso_id}/documentos ─────────────────────────────────────────


@router.post(
    "/casos/{caso_id}/documentos",
    response_model=DocumentoResponse,
    status_code=status.HTTP_201_CREATED,
)
@limiter.limit("100/minute")
async def post_documentos(
    request: Request,
    caso_id: int,
    datos: DocumentoRegisterRequest,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(_require_abogado_o_socio),
) -> object:
    """Registra la metadata de un documento en DB tras la subida directa al storage (RF-14).

    - 201: DocumentoResponse con los datos del documento registrado
    - 401: sin sesión activa
    - 403: sin rol ABOGADO/SOCIO o falta CSRF
    - 404: caso no encontrado

    CSRF: validado por CSRFMiddleware.
    """
    try:
        return register_documento(caso_id, datos, current_user.id, db)
    except CasoNoEncontrado:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Caso no encontrado")


# ── GET /casos/{caso_id}/documentos ──────────────────────────────────────────


@router.get(
    "/casos/{caso_id}/documentos",
    response_model=list[DocumentoResponse],
    status_code=status.HTTP_200_OK,
)
@limiter.limit("100/minute")
async def get_documentos(
    request: Request,
    caso_id: int,
    db: Session = Depends(get_db),
    _current_user: Usuario = Depends(get_current_user),
) -> list:
    """Lista los documentos de un caso, ordenados por fecha de subida desc (RF-15, RN-08).

    - 200: lista de DocumentoResponse (vacía si no hay documentos)
    - 401: sin sesión activa
    - 404: caso no encontrado

    Lectura amplia: todo usuario autenticado puede listar (RN-08).
    """
    try:
        return list_documentos(caso_id, db)
    except CasoNoEncontrado:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Caso no encontrado")


# ── GET /documentos/{documento_id}/url ───────────────────────────────────────


@router.get(
    "/documentos/{documento_id}/url",
    response_model=DocumentoDownloadResponse,
    status_code=status.HTTP_200_OK,
)
@limiter.limit("100/minute")
async def get_documento_url(
    request: Request,
    documento_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(_require_abogado_o_socio),
    storage: StorageClient = Depends(get_storage_client),
) -> DocumentoDownloadResponse:
    """Genera URL prefirmada de descarga (GET S3) para un documento (RF-15).

    - 200: DocumentoDownloadResponse con download_url y expires_in
    - 401: sin sesión activa
    - 403: sin rol ABOGADO/SOCIO
    - 404: documento no encontrado
    """
    try:
        return get_download_url(documento_id, storage, db)
    except DocumentoNoEncontrado:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Documento no encontrado")
