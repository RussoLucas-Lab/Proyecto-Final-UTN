"""
Servicio de gestión de casos (RF-08 a RF-13, RN-01/04/05/06/08/09/11, ADR-0008).

Funciones públicas:
  crear_caso              → alta transaccional (etapa inicial por dato, ADR-0008)
  upsert_ficha_laboral    → crear o actualizar ficha 1:1
  avanzar_etapa           → validar transición + historial (RN-04, RN-05)
  retroceder_etapa        → confirmación en terminal + historial (RN-09, RN-05)
  obtener_detalle         → caso + etapa + ficha + transiciones_validas
  listar_casos            → filtros combinables paginados (RF-13)
  listar_historial        → historial cronológico, solo lectura (RN-06)

Regla ADR-0008 ("estados como datos"):
  La etapa inicial se resuelve por menor `orden` del área — NUNCA por nombre ni enum.
  El avance valida contra `transicion_etapa`.
  La terminalidad sale de `etapa.es_terminal`.
"""

import logging

from sqlalchemy import select
from sqlalchemy.orm import Session, aliased

from app.features.casos.models import Caso, Etapa, FichaLaboral, HistorialCaso, TransicionEtapa
from app.features.casos.schemas import (
    CasoCreate,
    CasoDetalleResponse,
    CasoResponse,
    EtapaResponse,
    FichaLaboralResponse,
    FichaLaboralUpsert,
)
from app.shared.enums import AreaDerecho

logger = logging.getLogger("iuris.casos")

# ── Constantes ────────────────────────────────────────────────────────────────

PAGE_SIZE = 20


# ── Excepciones del dominio ───────────────────────────────────────────────────


class CasoNoEncontrado(Exception):
    """El caso buscado no existe en la DB."""


class TransicionInvalida(Exception):
    """No existe transición permitida entre las etapas dadas, o destino de otra área."""


class RetrocesoSinConfirmar(Exception):
    """El caso está en etapa terminal; retroceso requiere confirmar=true (RN-09)."""


class ClienteOAbogadoInvalido(Exception):
    """El cliente o el abogado responsable no existen en la DB."""


class TipoReclamoInvalido(Exception):
    """tipo_reclamo no coincide con el área del caso."""


class CatalogoEtapasVacio(Exception):
    """No hay etapas sembradas para el área solicitada.

    Precondición operativa: correr el seed `backend/seeds/seed_etapas.sql`.
    """


# ── Funciones privadas ────────────────────────────────────────────────────────


def _etapa_inicial(db: Session, area: AreaDerecho) -> Etapa:
    """Resuelve la etapa inicial como DATO: menor `orden` del área (D2, ADR-0008).

    NUNCA busca por nombre ni usa un enum de etapas.
    Lanza CatalogoEtapasVacio si no hay etapas sembradas para el área.
    """
    etapa = db.scalar(
        select(Etapa)
        .where(Etapa.area == area)
        .order_by(Etapa.orden.asc())
        .limit(1)
    )
    if etapa is None:
        raise CatalogoEtapasVacio(
            f"No hay etapas sembradas para el área {area.value}. "
            "Correr: psql \"$DATABASE_URL\" -f backend/seeds/seed_etapas.sql"
        )
    return etapa


def _insertar_historial(
    db: Session,
    caso_id: int,
    etapa_anterior_id: int | None,
    etapa_nueva_id: int,
    evento: str,
    autor_id: int,
) -> HistorialCaso:
    """Inserta una fila de historial (append-only, RN-05, RN-06).

    Debe llamarse dentro de una transacción activa; el commit es responsabilidad
    del llamador. Nunca actualiza ni elimina filas de historial_caso.
    """
    entrada = HistorialCaso(
        caso_id=caso_id,
        etapa_anterior_id=etapa_anterior_id,
        etapa_nueva_id=etapa_nueva_id,
        evento=evento,
        autor_id=autor_id,
    )
    db.add(entrada)
    return entrada


def _aplicar_datos_ficha(ficha: FichaLaboral, datos: FichaLaboralUpsert) -> None:
    """Actualiza in-place los campos de una FichaLaboral con los datos del upsert."""
    ficha.empleador_nombre = datos.empleador_nombre
    ficha.ramo_actividad = datos.ramo_actividad
    ficha.direccion_trabajo = datos.direccion_trabajo
    ficha.direccion_trabajo_cp = datos.direccion_trabajo_cp
    ficha.direccion_trabajo_localidad = datos.direccion_trabajo_localidad
    ficha.direccion_trabajo_provincia = datos.direccion_trabajo_provincia
    ficha.razon_social = datos.razon_social
    ficha.motivo_cese = datos.motivo_cese
    ficha.fecha_inicio_laboral = datos.fecha_inicio_laboral
    ficha.jornada = datos.jornada
    ficha.tareas = datos.tareas
    ficha.remuneracion = datos.remuneracion
    ficha.cct_aplicable = datos.cct_aplicable
    ficha.registrado = datos.registrado
    ficha.fecha_alta = datos.fecha_alta
    ficha.sueldo_coincide_bono = datos.sueldo_coincide_bono
    ficha.jornada_coincide_bono = datos.jornada_coincide_bono
    ficha.estado_aportes = datos.estado_aportes
    ficha.accidentes = datos.accidentes
    ficha.enfermedades = datos.enfermedades
    ficha.notas = datos.notas


# ── Lógica de negocio ─────────────────────────────────────────────────────────


def crear_caso(db: Session, datos: CasoCreate, autor_id: int) -> Caso:
    """Crea un caso nuevo en una transacción (RF-08, RF-09, RN-01, RN-05, D6).

    Pasos:
    1. Valida que cliente y abogado existan.
    2. Resuelve la etapa inicial como dato (ADR-0008, D2).
    3. Inserta el Caso.
    4. Inserta FichaLaboral si viene anidada.
    5. Inserta la primera fila de historial_caso (etapa_anterior_id=NULL).
    Todo en la misma transacción (RN-05).
    """
    from app.features.auth.models import Usuario
    from app.features.clientes.models import Cliente

    # Validar cliente y abogado existentes (RN-01)
    cliente = db.get(Cliente, datos.cliente_id)
    abogado = db.get(Usuario, datos.abogado_responsable_id)
    if cliente is None or abogado is None:
        raise ClienteOAbogadoInvalido(
            f"Cliente {datos.cliente_id} o abogado {datos.abogado_responsable_id} no existen"
        )

    # Resolver etapa inicial como DATO (ADR-0008, D2)
    etapa_inicial = _etapa_inicial(db, datos.area)

    # Insertar caso
    caso = Caso(
        cliente_id=datos.cliente_id,
        abogado_responsable_id=datos.abogado_responsable_id,
        area=datos.area,
        tipo_reclamo=datos.tipo_reclamo,
        codigo_expediente=datos.codigo_expediente,
        etapa_actual_id=etapa_inicial.id,
        fecha_inicio=datos.fecha_inicio,
        observaciones=datos.observaciones,
    )
    db.add(caso)
    db.flush()  # genera caso.id sin commit

    # Insertar ficha laboral si viene anidada (RF-09, D6)
    if datos.ficha_laboral is not None:
        ficha = FichaLaboral(caso_id=caso.id)
        _aplicar_datos_ficha(ficha, datos.ficha_laboral)
        db.add(ficha)

    # Primera fila de historial (etapa_anterior_id=NULL, D5)
    _insertar_historial(
        db,
        caso_id=caso.id,
        etapa_anterior_id=None,
        etapa_nueva_id=etapa_inicial.id,
        evento="creación",
        autor_id=autor_id,
    )

    db.commit()
    db.refresh(caso)
    logger.info(
        "Caso creado | caso_id=%s area=%s etapa_inicial_id=%s",
        caso.id,
        datos.area.value,
        etapa_inicial.id,
    )
    return caso


def upsert_ficha_laboral(db: Session, caso_id: int, datos: FichaLaboralUpsert) -> FichaLaboral:
    """Crea o actualiza la ficha laboral del caso (RF-09).

    Lanza CasoNoEncontrado si el caso no existe → 404.
    Respeta el unique caso_id (1:1).
    """
    caso = db.get(Caso, caso_id)
    if caso is None:
        raise CasoNoEncontrado(f"Caso {caso_id} no encontrado")

    ficha = db.scalar(select(FichaLaboral).where(FichaLaboral.caso_id == caso_id))

    if ficha is None:
        ficha = FichaLaboral(caso_id=caso_id)
        db.add(ficha)

    _aplicar_datos_ficha(ficha, datos)
    db.commit()
    db.refresh(ficha)
    logger.info("Ficha laboral actualizada | caso_id=%s", caso_id)
    return ficha


def avanzar_etapa(db: Session, caso: Caso, etapa_destino_id: int, autor_id: int) -> Caso:
    """Avanza el caso a la etapa destino validando la transición (RF-10, RN-04, D3).

    Verifica que exista TransicionEtapa(origen=caso.etapa_actual_id, destino=etapa_destino_id).
    Si no existe → TransicionInvalida → 409.
    Actualiza etapa_actual_id e inserta historial en la misma transacción (RN-05, D5).
    La intra-área está garantizada por el seed (que solo define transiciones intra-área).
    """
    transicion = db.scalar(
        select(TransicionEtapa).where(
            TransicionEtapa.etapa_origen_id == caso.etapa_actual_id,
            TransicionEtapa.etapa_destino_id == etapa_destino_id,
        )
    )
    if transicion is None:
        raise TransicionInvalida(
            f"No existe transición permitida desde la etapa actual ({caso.etapa_actual_id}) "
            f"a la etapa destino ({etapa_destino_id})"
        )

    etapa_anterior_id = caso.etapa_actual_id
    caso.etapa_actual_id = etapa_destino_id

    _insertar_historial(
        db,
        caso_id=caso.id,
        etapa_anterior_id=etapa_anterior_id,
        etapa_nueva_id=etapa_destino_id,
        evento="avance",
        autor_id=autor_id,
    )

    db.commit()
    db.refresh(caso)
    logger.info("Etapa avanzada | caso_id=%s destino_id=%s", caso.id, etapa_destino_id)
    return caso


def retroceder_etapa(
    db: Session,
    caso: Caso,
    etapa_destino_id: int,
    confirmar: bool,
    autor_id: int,
) -> Caso:
    """Retrocede el caso a una etapa anterior (RF-11, RN-09, D4).

    Reglas:
    - El destino debe ser una etapa de la misma área del caso (RN-11).
    - Si la etapa actual es terminal y confirmar=False → RetrocesoSinConfirmar → 409.
    - NO consulta transicion_etapa (el retroceso es lógica de aplicación, D4).
    """
    # Validar que el destino sea de la misma área (RN-11)
    etapa_destino = db.get(Etapa, etapa_destino_id)
    if etapa_destino is None or etapa_destino.area != caso.area:
        raise TransicionInvalida(
            f"La etapa destino ({etapa_destino_id}) no existe o no pertenece "
            f"al área {caso.area.value} del caso"
        )

    # Si la etapa actual es terminal, exigir confirmación explícita (RN-09)
    etapa_actual = db.get(Etapa, caso.etapa_actual_id)
    if etapa_actual is not None and etapa_actual.es_terminal and not confirmar:
        raise RetrocesoSinConfirmar(
            "El caso está en etapa terminal. Se requiere confirmar=true para retroceder (RN-09)."
        )

    etapa_anterior_id = caso.etapa_actual_id
    caso.etapa_actual_id = etapa_destino_id

    _insertar_historial(
        db,
        caso_id=caso.id,
        etapa_anterior_id=etapa_anterior_id,
        etapa_nueva_id=etapa_destino_id,
        evento="retroceso",
        autor_id=autor_id,
    )

    db.commit()
    db.refresh(caso)
    logger.info("Etapa retrocedida | caso_id=%s destino_id=%s", caso.id, etapa_destino_id)
    return caso


def obtener_detalle(db: Session, caso: Caso) -> CasoDetalleResponse:
    """Arma el detalle completo del caso (RF-13, D3).

    Incluye la etapa_actual (objeto Etapa), la ficha laboral y las
    transiciones_validas (etapas destino con transición desde la etapa actual).
    Los nombres de etapa vienen del dato — nunca hardcodeados.
    """
    from app.features.clientes.models import Cliente

    etapa_actual_orm = db.get(Etapa, caso.etapa_actual_id)
    ficha_orm = db.scalar(select(FichaLaboral).where(FichaLaboral.caso_id == caso.id))
    cliente_orm = db.get(Cliente, caso.cliente_id)

    # Etapas destino alcanzables desde la etapa actual (transiciones_validas)
    transiciones_orm = list(
        db.scalars(
            select(Etapa)
            .join(TransicionEtapa, TransicionEtapa.etapa_destino_id == Etapa.id)
            .where(TransicionEtapa.etapa_origen_id == caso.etapa_actual_id)
            .order_by(Etapa.orden)
        )
    )

    return CasoDetalleResponse(
        id=caso.id,
        cliente_id=caso.cliente_id,
        cliente_nombre=cliente_orm.nombre if cliente_orm else None,
        abogado_responsable_id=caso.abogado_responsable_id,
        area=caso.area,
        tipo_reclamo=caso.tipo_reclamo,
        codigo_expediente=caso.codigo_expediente,
        etapa_actual_id=caso.etapa_actual_id,
        fecha_inicio=caso.fecha_inicio,
        observaciones=caso.observaciones,
        creado_en=caso.creado_en,
        etapa_actual=EtapaResponse.model_validate(etapa_actual_orm, from_attributes=True),
        ficha=(
            FichaLaboralResponse.model_validate(ficha_orm, from_attributes=True)
            if ficha_orm is not None
            else None
        ),
        transiciones_validas=[
            EtapaResponse.model_validate(e, from_attributes=True) for e in transiciones_orm
        ],
    )


def listar_casos(
    db: Session,
    area: AreaDerecho | None = None,
    etapa_id: int | None = None,
    abogado_id: int | None = None,
    cliente_id: int | None = None,
    page: int = 1,
) -> list[CasoResponse]:
    """Retorna la lista paginada de casos con filtros opcionales combinables (RF-13, D9).

    Todos los filtros son opcionales y se combinan con AND.
    SQL parametrizado via SQLAlchemy (nunca concatenación).
    Paginación: PAGE_SIZE fijo, offset = (page - 1) * PAGE_SIZE.
    Incluye cliente_nombre y etapa_actual_nombre via JOIN para evitar N+1.
    """
    from app.features.clientes.models import Cliente

    page = max(1, page)
    offset = (page - 1) * PAGE_SIZE

    stmt = (
        select(Caso, Cliente.nombre, Etapa.nombre)
        .join(Cliente, Caso.cliente_id == Cliente.id)
        .join(Etapa, Caso.etapa_actual_id == Etapa.id)
        .order_by(Caso.id.desc())
    )

    if area is not None:
        stmt = stmt.where(Caso.area == area)
    if etapa_id is not None:
        stmt = stmt.where(Caso.etapa_actual_id == etapa_id)
    if abogado_id is not None:
        stmt = stmt.where(Caso.abogado_responsable_id == abogado_id)
    if cliente_id is not None:
        stmt = stmt.where(Caso.cliente_id == cliente_id)

    stmt = stmt.offset(offset).limit(PAGE_SIZE)
    rows = db.execute(stmt).all()

    return [
        CasoResponse(
            id=caso.id,
            cliente_id=caso.cliente_id,
            cliente_nombre=nombre_cliente,
            abogado_responsable_id=caso.abogado_responsable_id,
            area=caso.area,
            tipo_reclamo=caso.tipo_reclamo,
            codigo_expediente=caso.codigo_expediente,
            etapa_actual_id=caso.etapa_actual_id,
            etapa_actual_nombre=nombre_etapa,
            fecha_inicio=caso.fecha_inicio,
            observaciones=caso.observaciones,
            creado_en=caso.creado_en,
        )
        for caso, nombre_cliente, nombre_etapa in rows
    ]


def listar_historial(db: Session, caso_id: int) -> list[dict]:
    """Retorna el historial cronológico del caso con nombres de etapa (RF-12, RN-06, D5).

    Solo lectura (append-only). Hace JOIN con etapa para incluir nombres legibles
    sin hardcodear — conforme ADR-0008.
    """
    EtapaAnterior = aliased(Etapa)
    EtapaNueva = aliased(Etapa)

    rows = db.execute(
        select(
            HistorialCaso.id,
            HistorialCaso.caso_id,
            HistorialCaso.etapa_anterior_id,
            EtapaAnterior.nombre.label("etapa_anterior_nombre"),
            HistorialCaso.etapa_nueva_id,
            EtapaNueva.nombre.label("etapa_nueva_nombre"),
            HistorialCaso.evento,
            HistorialCaso.autor_id,
            HistorialCaso.ocurrido_en,
        )
        .outerjoin(EtapaAnterior, HistorialCaso.etapa_anterior_id == EtapaAnterior.id)
        .join(EtapaNueva, HistorialCaso.etapa_nueva_id == EtapaNueva.id)
        .where(HistorialCaso.caso_id == caso_id)
        .order_by(HistorialCaso.ocurrido_en.asc(), HistorialCaso.id.asc())
    ).all()

    return [row._asdict() for row in rows]
