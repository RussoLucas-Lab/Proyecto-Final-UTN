"""
Router de gestión de usuarios (RF-03, RN-07, UC-13).

Endpoints (todos bajo el prefijo /api/v1 definido en main.py):
  GET    /usuarios      → lista todos los usuarios (cualquier usuario autenticado, RN-08)
  POST   /usuarios      → crea usuario con contraseña inicial (solo SOCIO)
  PUT    /usuarios/{id} → edita nombre/rol/area/matricula (solo SOCIO)
  PATCH  /usuarios/{id} → activa/desactiva usuario — baja lógica (solo SOCIO)

Seguridad por endpoint (checklist task 3.8):
  GET:   JWT cookie (get_current_user), rate limit 100/min — sin CSRF (GET seguro)
  POST:  JWT cookie (require_socio → solo SOCIO), CSRF double-submit (middleware),
         rate limit 100/min, validación Pydantic (UsuarioCreate)
  PUT:   JWT cookie (require_socio → solo SOCIO), CSRF double-submit (middleware),
         rate limit 100/min, validación Pydantic (UsuarioUpdate)
  PATCH: JWT cookie (require_socio → solo SOCIO + actor), CSRF double-submit (middleware),
         rate limit 100/min, validación Pydantic (UsuarioActivacion)
  Ningún response serializa password_hash (UsuarioResponse lo excluye explícitamente).
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_db, require_socio
from app.core.rate_limit import limiter
from app.features.auth.models import Usuario
from app.features.usuarios.schemas import (
    UsuarioActivacion,
    UsuarioCreate,
    UsuarioResponse,
    UsuarioUpdate,
)
from app.features.usuarios.service import (
    AutodesactivacionProhibida,
    CoherenciaRolAreaInvalida,
    EmailDuplicado,
    UsuarioNoEncontrado,
    cambiar_activacion,
    crear_usuario,
    editar_usuario,
    listar_usuarios,
)

router = APIRouter(prefix="/usuarios", tags=["usuarios"])
logger = logging.getLogger("iuris.usuarios")


@router.get("", response_model=list[UsuarioResponse], status_code=status.HTTP_200_OK)
@limiter.limit("100/minute")
async def get_usuarios(
    request: Request,
    db: Session = Depends(get_db),
    _current_user: Usuario = Depends(get_current_user),
) -> list[Usuario]:
    """Lista todos los usuarios del estudio.

    - 200: lista de usuarios (sin password_hash en ningún elemento)
    - 401: sin sesión activa (no autenticado)
    - 429: rate limit excedido

    Acceso amplio: cualquier usuario autenticado puede leer (RN-08).
    CSRF no aplica: GET es un método seguro, exento por middleware.
    """
    return listar_usuarios(db)


@router.post("", response_model=UsuarioResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("100/minute")
async def post_usuarios(
    request: Request,
    datos: UsuarioCreate,
    db: Session = Depends(get_db),
    _current_user: Usuario = Depends(require_socio),
) -> Usuario:
    """Crea un nuevo usuario con contraseña inicial provista por el SOCIO.

    - 201: usuario creado (sin password_hash en la respuesta)
    - 403: el actor no es SOCIO
    - 409: email ya registrado
    - 422: payload inválido (Pydantic) o incoherencia rol/área (ABOGADO sin área)

    CSRF: validado por CSRFMiddleware (double-submit cookie).
    Solo SOCIO puede crear usuarios (RN-07).
    """
    try:
        return crear_usuario(db, datos)
    except EmailDuplicado:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El email ya está registrado",
        )
    except CoherenciaRolAreaInvalida as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        )


@router.put("/{id}", response_model=UsuarioResponse, status_code=status.HTTP_200_OK)
@limiter.limit("100/minute")
async def put_usuario(
    request: Request,
    id: int,
    datos: UsuarioUpdate,
    db: Session = Depends(get_db),
    _current_user: Usuario = Depends(require_socio),
) -> Usuario:
    """Edita nombre, rol, área y matrícula de un usuario existente.

    No modifica email (inmutable en el MVP) ni contraseña.

    - 200: usuario actualizado
    - 403: el actor no es SOCIO
    - 404: usuario no encontrado
    - 422: incoherencia rol/área (ABOGADO sin área)

    CSRF: validado por CSRFMiddleware.
    """
    try:
        return editar_usuario(db, id, datos)
    except UsuarioNoEncontrado:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado",
        )
    except CoherenciaRolAreaInvalida as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        )


@router.patch("/{id}", response_model=UsuarioResponse, status_code=status.HTTP_200_OK)
@limiter.limit("100/minute")
async def patch_usuario_activacion(
    request: Request,
    id: int,
    datos: UsuarioActivacion,
    db: Session = Depends(get_db),
    actor: Usuario = Depends(require_socio),
) -> Usuario:
    """Activa o desactiva un usuario (baja lógica, sin borrado físico).

    Un SOCIO no puede desactivarse a sí mismo (D5).

    - 200: estado de activación cambiado; registro persiste en DB con activo=false
    - 403: el actor no es SOCIO
    - 404: usuario no encontrado
    - 409: intento de autodesactivación del actor

    CSRF: validado por CSRFMiddleware.
    """
    try:
        return cambiar_activacion(db, id, datos.activo, actor)
    except UsuarioNoEncontrado:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado",
        )
    except AutodesactivacionProhibida:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No podés desactivar tu propia cuenta",
        )
