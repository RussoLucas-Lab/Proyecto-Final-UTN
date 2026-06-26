"""
Servicio de gestión de usuarios (RF-03, RN-07, UC-13).

Funciones:
  listar_usuarios    → todos los usuarios; la serialización excluye password_hash
  crear_usuario      → alta con contraseña hasheada, validación rol/área
  editar_usuario     → edita nombre/rol/area/matricula; no toca password ni email
  cambiar_activacion → baja/alta lógica; impide autodesactivación (D5)
"""

import logging

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.features.auth.models import Usuario
from app.features.usuarios.schemas import UsuarioCreate, UsuarioUpdate
from app.shared.enums import RolUsuario

logger = logging.getLogger("iuris.usuarios")


# ── Excepciones del dominio ────────────────────────────────────────────────────


class EmailDuplicado(Exception):
    """El email ya existe en la tabla usuario."""


class AutodesactivacionProhibida(Exception):
    """Un usuario no puede desactivarse a sí mismo (D5)."""


class UsuarioNoEncontrado(Exception):
    """El usuario buscado no existe en la DB."""


class CoherenciaRolAreaInvalida(Exception):
    """ABOGADO requiere área; incoherencia de rol/área detectada (D6)."""


# ── Helpers internos ───────────────────────────────────────────────────────────


def _validar_coherencia_rol_area(rol: RolUsuario, area) -> None:
    """Valida coherencia rol/área según D6.

    Regla: ABOGADO requiere área (LABORAL o ART); SOCIO la permite nula.
    Lanza CoherenciaRolAreaInvalida si la regla se viola.
    """
    if rol == RolUsuario.ABOGADO and area is None:
        raise CoherenciaRolAreaInvalida(
            "El rol ABOGADO requiere área (LABORAL o ART)"
        )


# ── Lógica de negocio ──────────────────────────────────────────────────────────


def listar_usuarios(db: Session) -> list[Usuario]:
    """Retorna todos los usuarios ordenados por id.

    La serialización a UsuarioResponse (en el router) garantiza que
    password_hash nunca se exponga en ninguna respuesta.
    """
    return list(db.scalars(select(Usuario).order_by(Usuario.id)))


def crear_usuario(db: Session, datos: UsuarioCreate) -> Usuario:
    """Crea un usuario nuevo con contraseña hasheada y activo=True.

    - Valida coherencia rol/área (D6).
    - Hashea datos.password con hash_password (bcrypt; nunca texto plano).
    - Traduce IntegrityError de email duplicado a EmailDuplicado → 409.
    """
    _validar_coherencia_rol_area(datos.rol, datos.area)

    user = Usuario(
        email=datos.email,
        password_hash=hash_password(datos.password),
        nombre=datos.nombre,
        rol=datos.rol,
        area=datos.area,
        matricula=datos.matricula,
        activo=True,
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise EmailDuplicado(f"El email '{datos.email}' ya está registrado")

    db.refresh(user)
    logger.info(
        "Usuario creado | usuario_id=%s email=%s rol=%s",
        user.id,
        user.email,
        user.rol,
    )
    return user


def editar_usuario(db: Session, id: int, datos: UsuarioUpdate) -> Usuario:
    """Actualiza nombre, rol, area y matricula. No modifica password ni email.

    - Lanza UsuarioNoEncontrado si el id no existe.
    - Valida coherencia rol/área (D6) tras aplicar los nuevos valores.
    """
    user = db.get(Usuario, id)
    if user is None:
        raise UsuarioNoEncontrado(f"Usuario {id} no encontrado")

    _validar_coherencia_rol_area(datos.rol, datos.area)

    user.nombre = datos.nombre
    user.rol = datos.rol
    user.area = datos.area
    user.matricula = datos.matricula

    db.commit()
    db.refresh(user)
    logger.info("Usuario editado | usuario_id=%s", user.id)
    return user


def cambiar_activacion(
    db: Session, id: int, activo: bool, actor: Usuario
) -> Usuario:
    """Activa o desactiva un usuario (baja lógica; sin borrado físico).

    - Lanza UsuarioNoEncontrado si el id no existe.
    - Lanza AutodesactivacionProhibida si activo=False y id == actor.id (D5).
    """
    user = db.get(Usuario, id)
    if user is None:
        raise UsuarioNoEncontrado(f"Usuario {id} no encontrado")

    if not activo and id == actor.id:
        raise AutodesactivacionProhibida(
            "No podés desactivar tu propia cuenta"
        )

    user.activo = activo
    db.commit()
    db.refresh(user)
    logger.info(
        "Activación cambiada | usuario_id=%s activo=%s actor_id=%s",
        user.id,
        activo,
        actor.id,
    )
    return user
