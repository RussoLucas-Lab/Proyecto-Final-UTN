from datetime import date

from sqlalchemy.orm import Session

from app.features.casos.models import Caso
from app.features.clientes.models import Cliente
from app.features.vencimientos.models import Vencimiento
from app.features.vencimientos.schemas import VencimientoCreate


class CasoNoEncontrado(Exception):
    pass


class VencimientoNoEncontrado(Exception):
    pass


def _get_caso_or_raise(caso_id: int, db: Session) -> Caso:
    caso = db.get(Caso, caso_id)
    if not caso:
        raise CasoNoEncontrado
    return caso


def crear_vencimiento(
    caso_id: int, datos: VencimientoCreate, usuario_id: int, db: Session
) -> Vencimiento:
    _get_caso_or_raise(caso_id, db)
    vencimiento = Vencimiento(
        caso_id=caso_id,
        descripcion=datos.descripcion,
        fecha=datos.fecha,
        completado=False,
        creado_por=usuario_id,
    )
    db.add(vencimiento)
    db.commit()
    db.refresh(vencimiento)
    return vencimiento


def listar_vencimientos_caso(caso_id: int, db: Session) -> list[Vencimiento]:
    _get_caso_or_raise(caso_id, db)
    return (
        db.query(Vencimiento)
        .filter(Vencimiento.caso_id == caso_id)
        .order_by(Vencimiento.fecha.asc())
        .all()
    )


def listar_vencimientos_rango(
    desde: date, hasta: date, db: Session
) -> list[dict]:
    rows = (
        db.query(Vencimiento, Caso.area, Cliente.nombre)
        .join(Caso, Vencimiento.caso_id == Caso.id)
        .join(Cliente, Caso.cliente_id == Cliente.id)
        .filter(Vencimiento.fecha >= desde, Vencimiento.fecha <= hasta)
        .order_by(Vencimiento.fecha.asc())
        .all()
    )
    return [
        {
            "id": v.id,
            "caso_id": v.caso_id,
            "descripcion": v.descripcion,
            "fecha": v.fecha,
            "completado": v.completado,
            "creado_por": v.creado_por,
            "creado_en": v.creado_en,
            "area_caso": area.value,
            "cliente_nombre": cliente_nombre,
        }
        for v, area, cliente_nombre in rows
    ]


def completar_vencimiento(
    vencimiento_id: int, completado: bool, db: Session
) -> Vencimiento:
    vencimiento = db.get(Vencimiento, vencimiento_id)
    if not vencimiento:
        raise VencimientoNoEncontrado
    vencimiento.completado = completado
    db.commit()
    db.refresh(vencimiento)
    return vencimiento
