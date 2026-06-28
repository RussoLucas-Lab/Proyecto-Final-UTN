"""
Servicio de la feature 'telegramas' (RN-15, RN-16).

Funciones públicas:
  get_telegramas_caso   → listar telegramas del caso ordenados por numero
  registrar_telegrama   → registrar un telegrama nuevo (validaciones de dominio)
  actualizar_resultado  → actualizar el resultado de un telegrama existente

Reglas:
  RN-15: telegramas solo en casos de área LABORAL.
  RN-16: máximo 3 telegramas por caso; numero único por caso.
"""

import logging

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.features.telegramas.models import Telegrama
from app.features.telegramas.schemas import TelegramaCreate
from app.shared.enums import AreaDerecho, ResultadoTelegrama

logger = logging.getLogger("iuris.telegramas")

# ── Excepciones del dominio ───────────────────────────────────────────────────


class CasoNoEncontrado(Exception):
    """El caso buscado no existe en la DB."""


class CasoNoEsLaboral(Exception):
    """Los telegramas solo aplican a casos del área LABORAL (RN-15)."""


class LimiteTelegramasAlcanzado(Exception):
    """El caso ya tiene 3 telegramas registrados (RN-16)."""


class NumeroTelegramaDuplicado(Exception):
    """Ya existe un telegrama con ese número en el caso (unique caso_id/numero)."""


class TelegramaNoEncontrado(Exception):
    """El telegrama buscado no existe en la DB."""


class ResultadoInvalido(Exception):
    """El resultado PENDIENTE es el estado inicial; no puede asignarse manualmente."""


# ── Funciones públicas ────────────────────────────────────────────────────────


def get_telegramas_caso(db: Session, caso_id: int) -> list[Telegrama]:
    """Retorna los telegramas del caso ordenados por numero (RN-16).

    No valida existencia del caso: si caso_id no existe, retorna lista vacía.
    Lectura amplia — no requiere verificación de área (RN-08).
    """
    return list(
        db.scalars(
            select(Telegrama)
            .where(Telegrama.caso_id == caso_id)
            .order_by(Telegrama.numero.asc())
        )
    )


def registrar_telegrama(db: Session, caso_id: int, data: TelegramaCreate) -> Telegrama:
    """Registra un telegrama nuevo para el caso (RN-15, RN-16).

    Validaciones en orden:
    1. Caso existe.
    2. Caso es de área LABORAL (RN-15).
    3. El caso tiene menos de 3 telegramas (RN-16).
    4. El numero no está duplicado en el caso (unique caso_id/numero).

    Lanza:
      CasoNoEncontrado           si el caso no existe → 404
      CasoNoEsLaboral            si el área no es LABORAL → 422
      LimiteTelegramasAlcanzado  si ya hay 3 telegramas → 409
      NumeroTelegramaDuplicado   si el numero ya existe en el caso → 409
    """
    from app.features.casos.models import Caso

    caso = db.get(Caso, caso_id)
    if caso is None:
        raise CasoNoEncontrado(f"Caso {caso_id} no encontrado")

    if caso.area != AreaDerecho.LABORAL:
        raise CasoNoEsLaboral(
            f"Los telegramas solo aplican a casos de área LABORAL. "
            f"El caso {caso_id} es de área {caso.area.value} (RN-15)"
        )

    total = db.scalar(
        select(func.count()).select_from(Telegrama).where(Telegrama.caso_id == caso_id)
    )
    if total is not None and total >= 3:
        raise LimiteTelegramasAlcanzado(
            f"El caso {caso_id} ya tiene 3 telegramas registrados (RN-16)"
        )

    duplicado = db.scalar(
        select(Telegrama).where(
            Telegrama.caso_id == caso_id,
            Telegrama.numero == data.numero,
        )
    )
    if duplicado is not None:
        raise NumeroTelegramaDuplicado(
            f"El caso {caso_id} ya tiene un telegrama con número {data.numero}"
        )

    telegrama = Telegrama(
        caso_id=caso_id,
        numero=data.numero,
        tipo_comunicacion=data.tipo_comunicacion,
        destinatario=data.destinatario,
        domicilio_destino=data.domicilio_destino,
        cuerpo=data.cuerpo,
    )
    db.add(telegrama)
    db.commit()
    db.refresh(telegrama)
    logger.info(
        "Telegrama registrado | caso_id=%s numero=%s id=%s",
        caso_id,
        data.numero,
        telegrama.id,
    )
    return telegrama


def upsert_resultado_telegrama(
    db: Session, caso_id: int, numero: int, resultado: ResultadoTelegrama
) -> Telegrama:
    """Crea o actualiza el resultado del telegrama N para el caso (upsert por caso_id/numero).

    Usado cuando el usuario selecciona el resultado desde la pantalla del caso,
    sin necesidad de haber registrado el telegrama previamente.

    Lanza:
      CasoNoEncontrado  si el caso no existe → 404
      CasoNoEsLaboral   si el área no es LABORAL → 422
      ResultadoInvalido si resultado == PENDIENTE → 422
    """
    from app.features.casos.models import Caso

    if resultado == ResultadoTelegrama.PENDIENTE:
        raise ResultadoInvalido(
            "El resultado PENDIENTE es el estado inicial y no puede asignarse manualmente"
        )

    caso = db.get(Caso, caso_id)
    if caso is None:
        raise CasoNoEncontrado(f"Caso {caso_id} no encontrado")

    if caso.area != AreaDerecho.LABORAL:
        raise CasoNoEsLaboral(
            f"Los telegramas solo aplican a casos de área LABORAL (RN-15)"
        )

    telegrama = db.scalar(
        select(Telegrama).where(
            Telegrama.caso_id == caso_id,
            Telegrama.numero == numero,
        )
    )
    if telegrama is None:
        telegrama = Telegrama(caso_id=caso_id, numero=numero)
        db.add(telegrama)

    telegrama.resultado = resultado
    db.commit()
    db.refresh(telegrama)
    logger.info(
        "Resultado upsert | caso_id=%s numero=%s resultado=%s id=%s",
        caso_id,
        numero,
        resultado.value,
        telegrama.id,
    )
    return telegrama


def actualizar_resultado(
    db: Session, telegrama_id: int, resultado: ResultadoTelegrama
) -> Telegrama:
    """Actualiza el resultado de un telegrama existente.

    Lanza:
      TelegramaNoEncontrado  si el telegrama no existe → 404
      ResultadoInvalido      si resultado == PENDIENTE → 422
    """
    if resultado == ResultadoTelegrama.PENDIENTE:
        raise ResultadoInvalido(
            "El resultado PENDIENTE es el estado inicial y no puede asignarse manualmente"
        )

    telegrama = db.get(Telegrama, telegrama_id)
    if telegrama is None:
        raise TelegramaNoEncontrado(f"Telegrama {telegrama_id} no encontrado")

    telegrama.resultado = resultado
    db.commit()
    db.refresh(telegrama)
    logger.info(
        "Resultado de telegrama actualizado | telegrama_id=%s resultado=%s",
        telegrama_id,
        resultado.value,
    )
    return telegrama
