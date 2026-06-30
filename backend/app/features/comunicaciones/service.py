"""
Servicio de la feature 'comunicaciones' (RF-16, RF-17, RF-18, RN-10, ADR-0003).

Funciones públicas:
  disparar_actualizacion  → dispara WF-01 en n8n, persiste el borrador.
  obtener_contexto_caso   → datos seguros del caso para el AI Agent de n8n.

Regla ADR-0003 ("IA solo en n8n"):
  Este módulo NO contiene LLM, claves de OpenAI ni prompts.
  Solo dispara un webhook HTTP hacia n8n y expone datos de solo lectura.
  La inteligencia artificial vive íntegramente en el nodo AI Agent de n8n (WF-01).
"""

import logging
from datetime import datetime, timezone

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.features.casos.models import Caso, Etapa
from app.features.clientes.models import Cliente
from app.features.comunicaciones.models import Comunicacion
from app.features.comunicaciones.schemas import ContextoCasoResponse
from app.features.vencimientos.models import Vencimiento
from app.shared.enums import EstadoComunicacion, TipoComunicacion

logger = logging.getLogger("iuris.comunicaciones")

_WEBHOOK_TIMEOUT = 20.0  # segundos; configurable en .env si hace falta


# ── Excepciones del dominio ───────────────────────────────────────────────────


class CasoNoEncontrado(Exception):
    """El caso buscado no existe en la DB."""


class ServicioIANoDisponible(Exception):
    """El webhook de n8n no respondió o devolvió un error."""


# ── Funciones de servicio ─────────────────────────────────────────────────────


def disparar_actualizacion(caso_id: int, db: Session) -> Comunicacion:
    """Dispara WF-01 en n8n y persiste el borrador como Comunicacion.

    - Valida que el caso exista (CasoNoEncontrado si no).
    - Llama al webhook N8N_WF01_WEBHOOK_URL con { "caso_id": caso_id }.
    - Si n8n no responde, timeout, devuelve 5xx o respuesta sin texto
      utilizable → lanza ServicioIANoDisponible (sin persistir nada).
    - Con respuesta válida persiste Comunicacion(tipo=MANUAL, estado=PENDIENTE_REVISION)
      y la retorna. No envía nada al cliente (RN-10).
    """
    caso = db.get(Caso, caso_id)
    if caso is None:
        raise CasoNoEncontrado(f"caso {caso_id} no encontrado")

    try:
        resp = httpx.post(
            settings.N8N_WF01_WEBHOOK_URL,
            json={"caso_id": caso_id},
            timeout=_WEBHOOK_TIMEOUT,
        )
        resp.raise_for_status()
        data = resp.json()
        texto: str = (
            data.get("borrador")
            or data.get("text")
            or data.get("output")
            or ""
        )
        if not texto or not isinstance(texto, str):
            raise ServicioIANoDisponible("n8n no devolvió texto utilizable")
    except ServicioIANoDisponible:
        raise
    except Exception as exc:
        logger.warning("Webhook n8n no disponible | caso_id=%s error=%s", caso_id, exc)
        raise ServicioIANoDisponible(str(exc))

    comunicacion = Comunicacion(
        caso_id=caso_id,
        contenido=texto,
        tipo=TipoComunicacion.MANUAL,
        estado=EstadoComunicacion.PENDIENTE_REVISION,
        generado_en=datetime.now(tz=timezone.utc),
    )
    db.add(comunicacion)
    db.commit()
    db.refresh(comunicacion)
    return comunicacion


def obtener_contexto_caso(caso_id: int, db: Session) -> ContextoCasoResponse:
    """Devuelve contexto seguro del caso para el AI Agent de n8n.

    Datos incluidos: nombre del cliente, nombre de la etapa actual,
    y hasta 3 vencimientos pendientes próximos como 'últimas novedades'.
    Sin DNI/CUIL, montos ni datos de terceros (ADR-0004, D5).
    ultimas_novedades = [] si no hay vencimientos pendientes.
    """
    caso = db.get(Caso, caso_id)
    if caso is None:
        raise CasoNoEncontrado(f"caso {caso_id} no encontrado")

    cliente = db.get(Cliente, caso.cliente_id)
    etapa = db.get(Etapa, caso.etapa_actual_id)

    vencimientos = (
        db.execute(
            select(Vencimiento)
            .where(Vencimiento.caso_id == caso_id)
            .where(Vencimiento.completado == False)  # noqa: E712
            .order_by(Vencimiento.fecha.asc())
            .limit(3)
        )
        .scalars()
        .all()
    )

    novedades = [
        f"{v.descripcion} ({v.fecha.isoformat()})"
        for v in vencimientos
    ]

    return ContextoCasoResponse(
        cliente=cliente.nombre if cliente else f"Cliente #{caso.cliente_id}",
        etapa=etapa.nombre if etapa else f"Etapa #{caso.etapa_actual_id}",
        ultimas_novedades=novedades,
    )
