"""
Servicio de gestión de clientes (RF-05, RF-06, RF-07, RN-03, UC-02).

Funciones:
  crear_cliente    → alta; DNI único (RN-03) → DniDuplicado → 409
  obtener_cliente  → consulta por id → ClienteNoEncontrado → 404
  editar_cliente   → edición; colisión de DNI con otro cliente → 409
  listar_clientes  → listado paginado con búsqueda ILIKE por nombre o DNI
"""

import logging

from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.features.clientes.models import Cliente
from app.features.clientes.schemas import ClienteCreate, ClienteUpdate

logger = logging.getLogger("iuris.clientes")

# ── Constantes de paginación ───────────────────────────────────────────────────

PAGE_SIZE = 20


# ── Excepciones del dominio ────────────────────────────────────────────────────


class DniDuplicado(Exception):
    """El DNI ya está registrado para otro cliente del estudio (RN-03)."""


class ClienteNoEncontrado(Exception):
    """El cliente buscado no existe en la DB."""


# ── Lógica de negocio ──────────────────────────────────────────────────────────


def crear_cliente(db: Session, datos: ClienteCreate) -> Cliente:
    """Crea un cliente nuevo.

    - Inserta el registro en la tabla `cliente`.
    - Captura IntegrityError de colisión de DNI único y lo traduce a
      DniDuplicado → el router lo mapea a 409 (D3, RN-03).
    """
    cliente = Cliente(
        nombre=datos.nombre,
        dni=datos.dni,
        cuil=datos.cuil,
        telefono=datos.telefono,
        email=datos.email,
        domicilio_real=datos.domicilio_real,
        domicilio_real_cp=datos.domicilio_real_cp,
        domicilio_real_localidad=datos.domicilio_real_localidad,
        domicilio_real_provincia=datos.domicilio_real_provincia,
        domicilio_coincide_dni=datos.domicilio_coincide_dni,
    )
    db.add(cliente)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise DniDuplicado(f"El DNI '{datos.dni}' ya está registrado en el estudio")

    db.refresh(cliente)
    logger.info("Cliente creado | cliente_id=%s dni=<oculto>", cliente.id)
    return cliente


def obtener_cliente(db: Session, id: int) -> Cliente:
    """Retorna el cliente o lanza ClienteNoEncontrado → 404."""
    cliente = db.get(Cliente, id)
    if cliente is None:
        raise ClienteNoEncontrado(f"Cliente {id} no encontrado")
    return cliente


def editar_cliente(db: Session, id: int, datos: ClienteUpdate) -> Cliente:
    """Actualiza los datos de un cliente.

    - Lanza ClienteNoEncontrado si el id no existe → 404.
    - Si el nuevo DNI colisiona con OTRO cliente → DniDuplicado → 409 (D3).
    """
    cliente = db.get(Cliente, id)
    if cliente is None:
        raise ClienteNoEncontrado(f"Cliente {id} no encontrado")

    cliente.nombre = datos.nombre
    cliente.dni = datos.dni
    cliente.cuil = datos.cuil
    cliente.telefono = datos.telefono
    cliente.email = datos.email
    cliente.domicilio_real = datos.domicilio_real
    cliente.domicilio_real_cp = datos.domicilio_real_cp
    cliente.domicilio_real_localidad = datos.domicilio_real_localidad
    cliente.domicilio_real_provincia = datos.domicilio_real_provincia
    cliente.domicilio_coincide_dni = datos.domicilio_coincide_dni

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise DniDuplicado(f"El DNI '{datos.dni}' ya está registrado para otro cliente")

    db.refresh(cliente)
    logger.info("Cliente editado | cliente_id=%s", id)
    return cliente


def listar_clientes(
    db: Session,
    search: str | None = None,
    page: int = 1,
) -> list[Cliente]:
    """Retorna la lista paginada de clientes.

    Si hay `search`, filtra por `nombre ILIKE %search%` OR coincidencia de `dni`.
    Sin `search`, devuelve la página completa.
    Paginación: tamaño fijo PAGE_SIZE, offset = (page - 1) * PAGE_SIZE (D6).
    SQL parametrizado vía SQLAlchemy (nunca concatenación).
    """
    page = max(1, page)
    offset = (page - 1) * PAGE_SIZE

    stmt = select(Cliente).order_by(Cliente.id)

    if search:
        pattern = f"%{search}%"
        stmt = stmt.where(
            or_(
                Cliente.nombre.ilike(pattern),
                Cliente.dni.ilike(pattern),
            )
        )

    stmt = stmt.offset(offset).limit(PAGE_SIZE)
    return list(db.scalars(stmt))
