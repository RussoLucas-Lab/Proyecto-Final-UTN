"""
Servicio de la feature 'comunicaciones' (RF-16..18, RF-26, RN-10, RN-19..23, ADR-0003).

Funciones públicas:
  disparar_actualizacion       → dispara WF-01 en n8n, persiste el borrador (flujo individual).
  obtener_contexto_caso        → datos seguros del caso para el AI Agent de n8n.
  calcular_casos_pendientes    → casos que vencen hoy para actualización (WF-05, RN-20..22).
  persistir_borrador_automatico → persiste un borrador generado por WF-05 (RN-19, RN-22).
  listar_comunicaciones        → borradores para revisión, enriquecidos (D7).
  revisar_comunicacion         → aprobar/descartar un borrador (D4, RN-10, RN-19).

Regla ADR-0003 ("IA solo en n8n"):
  Este módulo NO contiene LLM, claves de OpenAI ni prompts.
  Solo dispara webhooks HTTP hacia n8n y expone datos de solo lectura/escritura
  de estado. La inteligencia artificial vive íntegramente en el AI Agent de n8n
  (WF-01 y WF-05, que reutiliza el mismo agente).
"""

import logging
from datetime import datetime, timedelta, timezone

import httpx
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.features.casos.models import Caso, Etapa
from app.features.clientes.models import Cliente
from app.features.comunicaciones.models import Comunicacion
from app.features.comunicaciones.schemas import BorradorPendienteResponse, ContextoCasoResponse
from app.features.vencimientos.models import Vencimiento
from app.shared.enums import EstadoComunicacion, TipoComunicacion

logger = logging.getLogger("iuris.comunicaciones")

# Cadencia de actualización del batch (RF-26, RN-21).
CADENCIA_DIAS = 15


# ── Excepciones del dominio ───────────────────────────────────────────────────


class CasoNoEncontrado(Exception):
    """El caso buscado no existe en la DB."""


class ServicioIANoDisponible(Exception):
    """El webhook de n8n no respondió o devolvió un error."""


class BorradorAutomaticoDuplicado(Exception):
    """Ya existe un borrador ACTUALIZACION_AUTOMATICA PENDIENTE_REVISION para el caso (RN-22)."""


class ComunicacionNoEncontrada(Exception):
    """La comunicación buscada no existe en la DB."""


class ComunicacionNoPendiente(Exception):
    """La comunicación ya fue revisada (no está en PENDIENTE_REVISION)."""


# ── Funciones de servicio ─────────────────────────────────────────────────────


async def disparar_actualizacion(caso_id: int, db: Session) -> Comunicacion:
    """Dispara WF-01 en n8n y persiste el borrador como Comunicacion.

    - Valida que el caso exista (CasoNoEncontrado si no).
    - Llama al webhook N8N_WF01_WEBHOOK_URL con { "caso_id": caso_id }.
    - Si n8n no responde, timeout, devuelve 5xx o respuesta sin texto
      utilizable → lanza ServicioIANoDisponible (sin persistir nada).
    - Con respuesta válida persiste Comunicacion(tipo=MANUAL, estado=PENDIENTE_REVISION)
      y la retorna. No envía nada al cliente (RN-10).

    Usa httpx.AsyncClient (no el cliente síncrono): el AI Agent de n8n le hace
    un callback a este mismo backend (GET /internal/casos/{id}/contexto)
    mientras esta función espera su respuesta. Con una llamada síncrona se
    bloquea el único event loop de Uvicorn y ese callback queda esperando
    a que el propio request que lo generó termine (autocontención ~1 min).
    """
    caso = db.get(Caso, caso_id)
    if caso is None:
        raise CasoNoEncontrado(f"caso {caso_id} no encontrado")

    try:
        async with httpx.AsyncClient(timeout=settings.N8N_WEBHOOK_TIMEOUT_SECONDS) as client:
            resp = await client.post(
                settings.N8N_WF01_WEBHOOK_URL,
                json={"caso_id": caso_id},
            )
        resp.raise_for_status()
        data = resp.json()
        texto: str = data.get("borrador") or data.get("text") or data.get("output") or ""
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

    novedades = [f"{v.descripcion} ({v.fecha.isoformat()})" for v in vencimientos]

    return ContextoCasoResponse(
        cliente=cliente.nombre if cliente else f"Cliente #{caso.cliente_id}",
        etapa=etapa.nombre if etapa else f"Etapa #{caso.etapa_actual_id}",
        ultimas_novedades=novedades,
    )


# ── Batch de actualizaciones (WF-05, RF-26) ───────────────────────────────────


def calcular_casos_pendientes(db: Session) -> list[int]:
    """Devuelve los `caso_id` activos que vencen hoy para actualización (RF-26.1).

    La cadencia y la idempotencia se calculan en el backend (D1), no en n8n.
    Un caso vence cuando se cumplen TODAS las condiciones:
      (a) su etapa actual NO es terminal (`Etapa.es_terminal == False`, RN-20);
      (b) no tiene ya un borrador `ACTUALIZACION_AUTOMATICA` `PENDIENTE_REVISION`
          (idempotencia, RN-22);
      (c) pasaron >=15 días desde su última `ACTUALIZACION_AUTOMATICA` `APROBADO`
          (por `aprobado_en`), o desde `caso.fecha_inicio` si nunca hubo una
          aprobada, o desde `caso.creado_en` si `fecha_inicio` es NULL (RN-21).

    Solo lecturas; consultas parametrizadas vía SQLAlchemy Core.
    """
    limite = datetime.utcnow() - timedelta(days=CADENCIA_DIAS)

    ultima_aprobada = (
        select(
            Comunicacion.caso_id.label("caso_id"),
            func.max(Comunicacion.aprobado_en).label("ultima_aprobada_en"),
        )
        .where(Comunicacion.tipo == TipoComunicacion.ACTUALIZACION_AUTOMATICA)
        .where(Comunicacion.estado == EstadoComunicacion.APROBADO)
        .group_by(Comunicacion.caso_id)
        .subquery()
    )

    pendientes_actuales = (
        select(Comunicacion.caso_id)
        .where(Comunicacion.tipo == TipoComunicacion.ACTUALIZACION_AUTOMATICA)
        .where(Comunicacion.estado == EstadoComunicacion.PENDIENTE_REVISION)
    )

    filas = db.execute(
        select(
            Caso.id,
            Caso.fecha_inicio,
            Caso.creado_en,
            ultima_aprobada.c.ultima_aprobada_en,
        )
        .join(Etapa, Caso.etapa_actual_id == Etapa.id)
        .outerjoin(ultima_aprobada, ultima_aprobada.c.caso_id == Caso.id)
        .where(Etapa.es_terminal == False)  # noqa: E712
        .where(Caso.id.not_in(pendientes_actuales))
    ).all()

    pendientes: list[int] = []
    for caso_id, fecha_inicio, creado_en, ultima_aprobada_en in filas:
        if ultima_aprobada_en is not None:
            referencia = ultima_aprobada_en
        elif fecha_inicio is not None:
            referencia = datetime.combine(fecha_inicio, datetime.min.time())
        else:
            referencia = creado_en

        if referencia is not None and referencia <= limite:
            pendientes.append(caso_id)

    return pendientes


def persistir_borrador_automatico(db: Session, caso_id: int, contenido: str) -> Comunicacion:
    """Persiste un borrador generado por el AI Agent de WF-05 (RF-26.2).

    - Valida que el caso exista (`CasoNoEncontrado` si no).
    - Idempotencia (RN-22): si ya existe un borrador `ACTUALIZACION_AUTOMATICA`
      `PENDIENTE_REVISION` para el caso, no crea un segundo
      (`BorradorAutomaticoDuplicado`).
    - Crea `Comunicacion(tipo=ACTUALIZACION_AUTOMATICA, estado=PENDIENTE_REVISION)`.
    - No dispara ningún envío al cliente (RN-19).
    """
    caso = db.get(Caso, caso_id)
    if caso is None:
        raise CasoNoEncontrado(f"caso {caso_id} no encontrado")

    ya_existe = db.execute(
        select(Comunicacion.id)
        .where(Comunicacion.caso_id == caso_id)
        .where(Comunicacion.tipo == TipoComunicacion.ACTUALIZACION_AUTOMATICA)
        .where(Comunicacion.estado == EstadoComunicacion.PENDIENTE_REVISION)
    ).first()
    if ya_existe is not None:
        raise BorradorAutomaticoDuplicado(
            f"caso {caso_id} ya tiene un borrador automático pendiente de revisión"
        )

    comunicacion = Comunicacion(
        caso_id=caso_id,
        contenido=contenido,
        tipo=TipoComunicacion.ACTUALIZACION_AUTOMATICA,
        estado=EstadoComunicacion.PENDIENTE_REVISION,
    )
    db.add(comunicacion)
    db.commit()
    db.refresh(comunicacion)
    return comunicacion


def listar_comunicaciones(
    db: Session, estado: EstadoComunicacion | None = None
) -> list[BorradorPendienteResponse]:
    """Lista borradores para revisión, resolviendo caso -> cliente/etapa (D7, RF-26.4).

    Sin DNI/CUIL ni montos (ADR-0004). Orden: `generado_en` DESC.
    """
    query = (
        select(Comunicacion, Cliente.nombre, Caso.area, Etapa.nombre, Caso.id)
        .join(Caso, Comunicacion.caso_id == Caso.id)
        .join(Cliente, Caso.cliente_id == Cliente.id)
        .join(Etapa, Caso.etapa_actual_id == Etapa.id)
        .order_by(Comunicacion.generado_en.desc())
    )
    if estado is not None:
        query = query.where(Comunicacion.estado == estado)

    filas = db.execute(query).all()
    return [
        BorradorPendienteResponse(
            id=com.id,
            caso_id=caso_id,
            cliente=cliente_nombre,
            area=area.value,
            etapa=etapa_nombre,
            preview=com.contenido,
            estado=com.estado,
            generado_en=com.generado_en,
        )
        for com, cliente_nombre, area, etapa_nombre, caso_id in filas
    ]


def revisar_comunicacion(
    db: Session, comunicacion_id: int, estado: EstadoComunicacion, usuario_id: int
) -> Comunicacion:
    """Aprueba o descarta un borrador (D4, RF-26.4, RN-10, RN-19).

    - Valida que la comunicación exista (`ComunicacionNoEncontrada` si no) y que
      esté en `PENDIENTE_REVISION` (`ComunicacionNoPendiente` si no).
    - `APROBADO`: setea `aprobado_por`/`aprobado_en=now()`, lo que reinicia la
      ventana de cadencia de 15 días del caso (la próxima detección usa este
      `aprobado_en` como referencia, ver `calcular_casos_pendientes`).
    - `DESCARTADO`: solo cambia el estado.
    - Nunca dispara un envío al cliente (RN-10/RN-19).
    """
    comunicacion = db.get(Comunicacion, comunicacion_id)
    if comunicacion is None:
        raise ComunicacionNoEncontrada(f"comunicacion {comunicacion_id} no encontrada")

    if comunicacion.estado != EstadoComunicacion.PENDIENTE_REVISION:
        raise ComunicacionNoPendiente(
            f"comunicacion {comunicacion_id} ya fue revisada (estado={comunicacion.estado})"
        )

    comunicacion.estado = estado
    if estado == EstadoComunicacion.APROBADO:
        comunicacion.aprobado_por = usuario_id
        comunicacion.aprobado_en = datetime.utcnow()

    db.commit()
    db.refresh(comunicacion)
    return comunicacion
