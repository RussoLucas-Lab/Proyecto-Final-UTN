"""
Router de gestión de clientes (RF-05, RF-06, RF-07, RN-03, UC-02).

Endpoints (todos bajo el prefijo /api/v1 definido en main.py):
  GET    /clientes          → lista paginada, búsqueda por nombre/DNI (RF-07)
  GET    /clientes/{id}     → consulta de cliente por id (RF-06)
  POST   /clientes          → alta de cliente con DNI único (RF-05)
  PUT    /clientes/{id}     → edición de cliente (RF-06)

Seguridad por endpoint (checklist task 3.8):
  GET /clientes:     JWT cookie (get_current_user), rate limit 100/min — sin CSRF (GET seguro)
  GET /clientes/{id}: JWT cookie (get_current_user), rate limit 100/min — sin CSRF
  POST /clientes:    JWT cookie (require_roles ABOGADO+SOCIO, D4), CSRF double-submit
                     (CSRFMiddleware), rate limit 100/min, validación Pydantic (ClienteCreate)
  PUT /clientes/{id}: JWT cookie (require_roles ABOGADO+SOCIO), CSRF double-submit,
                     rate limit 100/min, validación Pydantic (ClienteUpdate)
  Lectura amplia: todo usuario autenticado puede leer (RN-08).
  Mutaciones: ABOGADO y SOCIO (D4 — a diferencia de usuarios, ABOGADO también muta).
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_db, require_roles
from app.core.rate_limit import limiter
from app.features.auth.models import Usuario
from app.features.clientes.dependencies import get_cliente_o_404
from app.features.clientes.models import Cliente
from app.features.clientes.schemas import ClienteCreate, ClienteResponse, ClienteUpdate
from app.features.clientes.service import (
    ClienteNoEncontrado,
    DniDuplicado,
    crear_cliente,
    editar_cliente,
    listar_clientes,
    obtener_cliente,
)
from app.shared.enums import RolUsuario

router = APIRouter(prefix="/clientes", tags=["clientes"])
logger = logging.getLogger("iuris.clientes")

# Guard de rol para mutaciones: ABOGADO y SOCIO (D4)
_require_abogado_o_socio = require_roles(RolUsuario.ABOGADO, RolUsuario.SOCIO)


@router.get("", response_model=list[ClienteResponse], status_code=status.HTTP_200_OK)
@limiter.limit("100/minute")
async def get_clientes(
    request: Request,
    search: str | None = Query(default=None, description="Buscar por nombre (parcial) o DNI"),
    page: int = Query(default=1, ge=1, description="Número de página (base 1)"),
    db: Session = Depends(get_db),
    _current_user: Usuario = Depends(get_current_user),
) -> list[Cliente]:
    """Lista paginada de clientes con búsqueda opcional por nombre o DNI.

    - 200: lista de ClienteResponse (puede ser vacía)
    - 401: sin sesión activa
    - 429: rate limit excedido

    Acceso amplio: cualquier usuario autenticado puede leer (RN-08, D4).
    CSRF no aplica: GET es un método seguro, exento por middleware.
    """
    return listar_clientes(db, search=search, page=page)


@router.get("/{id}", response_model=ClienteResponse, status_code=status.HTTP_200_OK)
@limiter.limit("100/minute")
async def get_cliente(
    request: Request,
    cliente: Cliente = Depends(get_cliente_o_404),
    _current_user: Usuario = Depends(get_current_user),
) -> Cliente:
    """Consulta un cliente por id.

    - 200: ClienteResponse
    - 401: sin sesión activa
    - 404: cliente no encontrado
    - 429: rate limit excedido

    Acceso amplio: cualquier usuario autenticado puede leer (RN-08).
    """
    return cliente


@router.post("", response_model=ClienteResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("100/minute")
async def post_clientes(
    request: Request,
    datos: ClienteCreate,
    db: Session = Depends(get_db),
    _current_user: Usuario = Depends(_require_abogado_o_socio),
) -> Cliente:
    """Crea un cliente nuevo (admisión).

    - 201: ClienteResponse con datos del cliente creado
    - 401: sin sesión activa
    - 403: el actor no es ABOGADO ni SOCIO
    - 409: DNI ya registrado en el estudio (RN-03)
    - 422: payload inválido (Pydantic)

    CSRF: validado por CSRFMiddleware (double-submit cookie).
    Solo ABOGADO y SOCIO pueden crear clientes (D4, RF-05).
    """
    try:
        return crear_cliente(db, datos)
    except DniDuplicado:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El DNI ya está registrado en el estudio",
        )


@router.put("/{id}", response_model=ClienteResponse, status_code=status.HTTP_200_OK)
@limiter.limit("100/minute")
async def put_cliente(
    request: Request,
    id: int,
    datos: ClienteUpdate,
    db: Session = Depends(get_db),
    _current_user: Usuario = Depends(_require_abogado_o_socio),
) -> Cliente:
    """Edita los datos de un cliente.

    - 200: ClienteResponse actualizado
    - 401: sin sesión activa
    - 403: el actor no es ABOGADO ni SOCIO
    - 404: cliente no encontrado
    - 409: el nuevo DNI ya está registrado para otro cliente
    - 422: payload inválido (Pydantic)

    CSRF: validado por CSRFMiddleware.
    """
    try:
        return editar_cliente(db, id, datos)
    except ClienteNoEncontrado:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cliente no encontrado",
        )
    except DniDuplicado:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El DNI ya está registrado para otro cliente",
        )
