"""
Tests unitarios para features/comunicaciones/service.py.

Cubre:
  disparar_actualizacion:
    - éxito → Comunicacion con tipo=MANUAL, estado=PENDIENTE_REVISION
    - n8n caído/timeout → ServicioIANoDisponible, sin persistencia
    - caso inexistente → CasoNoEncontrado
  obtener_contexto_caso:
    - forma correcta del resultado
    - ultimas_novedades=[] cuando no hay vencimientos
    - el contexto NO incluye campos sensibles (DNI, CUIL, montos, etc.)

  Batch (WF-05, RF-26):
  calcular_casos_pendientes:
    - caso activo sin actualizaciones previas, fecha_inicio >=15 días → pendiente
    - caso activo sin actualizaciones previas, fecha_inicio <15 días → no pendiente
    - caso en etapa terminal → nunca pendiente (RN-20)
    - caso con borrador automático PENDIENTE_REVISION → no pendiente (RN-22, idempotencia)
    - última ACTUALIZACION_AUTOMATICA APROBADO hace >=15 días → pendiente
    - última ACTUALIZACION_AUTOMATICA APROBADO hace <15 días → no pendiente
    - fecha_inicio NULL → usa creado_en como fallback (RN-21)
    - una comunicación MANUAL aprobada no cuenta para la cadencia (solo automáticas)
  persistir_borrador_automatico:
    - éxito → Comunicacion(tipo=ACTUALIZACION_AUTOMATICA, estado=PENDIENTE_REVISION)
    - caso inexistente → CasoNoEncontrado
    - idempotencia → BorradorAutomaticoDuplicado
  listar_comunicaciones:
    - sin filtro devuelve todos, ordenados generado_en DESC
    - con filtro por estado
    - preview/cliente/area/etapa correctos, sin campos sensibles
  revisar_comunicacion:
    - aprobar → estado APROBADO, aprobado_por/aprobado_en seteados
    - descartar → estado DESCARTADO, sin aprobado_por/aprobado_en
    - comunicación inexistente → ComunicacionNoEncontrada
    - ya revisada → ComunicacionNoPendiente
    - aprobar reinicia la ventana de cadencia (D4)
"""

from datetime import datetime, timedelta

import pytest

from app.features.comunicaciones.service import (
    BorradorAutomaticoDuplicado,
    CasoNoEncontrado,
    ComunicacionNoEncontrada,
    ComunicacionNoPendiente,
    ServicioIANoDisponible,
    calcular_casos_pendientes,
    disparar_actualizacion,
    listar_comunicaciones,
    obtener_contexto_caso,
    persistir_borrador_automatico,
    revisar_comunicacion,
)
from app.shared.enums import EstadoComunicacion, TipoComunicacion

pytestmark = pytest.mark.integration


# ── disparar_actualizacion ────────────────────────────────────────────────────


async def test_disparar_actualizacion_exito(db_session, caso_fixture, mock_n8n_ok):
    """Éxito: crea Comunicacion con tipo=MANUAL, estado=PENDIENTE_REVISION."""
    resultado = await disparar_actualizacion(caso_fixture.id, db_session)

    assert resultado.id is not None
    assert resultado.tipo == TipoComunicacion.MANUAL
    assert resultado.estado == EstadoComunicacion.PENDIENTE_REVISION
    assert resultado.caso_id == caso_fixture.id
    assert resultado.contenido == "Estimado cliente, su caso ha avanzado."
    assert resultado.generado_en is not None
    assert resultado.aprobado_por is None
    assert resultado.aprobado_en is None


async def test_disparar_actualizacion_no_persiste_si_n8n_down(
    db_session, caso_fixture, mock_n8n_down
):
    """n8n caído → ServicioIANoDisponible; no persiste ninguna Comunicacion."""
    from sqlalchemy import select

    from app.features.comunicaciones.models import Comunicacion

    count_antes = (
        db_session.execute(select(Comunicacion).where(Comunicacion.caso_id == caso_fixture.id))
        .scalars()
        .all()
    )

    with pytest.raises(ServicioIANoDisponible):
        await disparar_actualizacion(caso_fixture.id, db_session)

    count_despues = (
        db_session.execute(select(Comunicacion).where(Comunicacion.caso_id == caso_fixture.id))
        .scalars()
        .all()
    )

    assert len(count_despues) == len(count_antes)


async def test_disparar_actualizacion_caso_inexistente(db_session, mock_n8n_ok):
    """caso_id que no existe → CasoNoEncontrado (no dispara el webhook)."""
    with pytest.raises(CasoNoEncontrado):
        await disparar_actualizacion(99999, db_session)

    mock_n8n_ok.assert_not_called()


async def test_disparar_actualizacion_n8n_sin_texto(db_session, caso_fixture):
    """n8n responde 200 pero sin texto utilizable → ServicioIANoDisponible."""
    from unittest.mock import MagicMock, patch

    from tests.features.comunicaciones.conftest import _fake_async_client

    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {}
    mock_response.raise_for_status = MagicMock()

    fake_client = _fake_async_client(post_return=mock_response)
    with patch("app.features.comunicaciones.service.httpx.AsyncClient", return_value=fake_client):
        with pytest.raises(ServicioIANoDisponible):
            await disparar_actualizacion(caso_fixture.id, db_session)


# ── obtener_contexto_caso ─────────────────────────────────────────────────────


def test_obtener_contexto_caso_forma_correcta(db_session, caso_fixture, etapa_fixture):
    """Resultado tiene la forma correcta con los campos esperados."""
    resultado = obtener_contexto_caso(caso_fixture.id, db_session)

    assert resultado.cliente == "González, Mario"
    assert resultado.etapa == etapa_fixture.nombre
    assert isinstance(resultado.ultimas_novedades, list)


def test_obtener_contexto_caso_sin_novedades(db_session, caso_fixture):
    """Sin vencimientos pendientes → ultimas_novedades es lista vacía."""
    resultado = obtener_contexto_caso(caso_fixture.id, db_session)

    assert resultado.ultimas_novedades == []


def test_obtener_contexto_caso_con_vencimientos(db_session, caso_fixture, usuario_abogado):
    """Con vencimientos pendientes → aparecen en ultimas_novedades."""
    import datetime

    from app.features.vencimientos.models import Vencimiento

    v = Vencimiento(
        caso_id=caso_fixture.id,
        descripcion="Presentar demanda",
        fecha=datetime.date(2026, 7, 15),
        completado=False,
        creado_por=usuario_abogado.id,
    )
    db_session.add(v)
    db_session.commit()

    resultado = obtener_contexto_caso(caso_fixture.id, db_session)

    assert len(resultado.ultimas_novedades) == 1
    assert "Presentar demanda" in resultado.ultimas_novedades[0]


def test_obtener_contexto_caso_no_incluye_campos_sensibles(db_session, caso_fixture):
    """El contexto NO incluye DNI, CUIL, montos ni plazos (ADR-0004, D5)."""
    resultado = obtener_contexto_caso(caso_fixture.id, db_session)

    resultado_dict = resultado.model_dump()
    claves = set(resultado_dict.keys())

    campos_sensibles = {
        "dni",
        "cuil",
        "remuneracion",
        "telefono",
        "email",
        "domicilio_real",
        "domicilio_real_cp",
    }
    assert campos_sensibles.isdisjoint(claves), (
        f"El contexto no debe incluir campos sensibles. Encontrados: "
        f"{campos_sensibles & claves}"
    )


def test_obtener_contexto_caso_inexistente(db_session):
    """caso_id que no existe → CasoNoEncontrado."""
    with pytest.raises(CasoNoEncontrado):
        obtener_contexto_caso(99999, db_session)


# ── calcular_casos_pendientes (WF-05, RF-26.1) ────────────────────────────────


def test_calcular_pendientes_caso_activo_fecha_inicio_vencida(
    db_session, etapa_fixture, caso_factory
):
    """Caso activo, sin actualizaciones previas, fecha_inicio hace >=15 días → pendiente."""
    hace_20_dias = (datetime.utcnow() - timedelta(days=20)).date()
    caso = caso_factory(etapa_fixture, fecha_inicio=hace_20_dias)

    pendientes = calcular_casos_pendientes(db_session)

    assert caso.id in pendientes


def test_calcular_pendientes_caso_activo_fecha_inicio_reciente(
    db_session, etapa_fixture, caso_factory
):
    """Caso activo con fecha_inicio hace <15 días → no pendiente."""
    hace_5_dias = (datetime.utcnow() - timedelta(days=5)).date()
    caso = caso_factory(etapa_fixture, fecha_inicio=hace_5_dias)

    pendientes = calcular_casos_pendientes(db_session)

    assert caso.id not in pendientes


def test_calcular_pendientes_excluye_etapa_terminal(
    db_session, etapa_terminal_fixture, caso_factory
):
    """Caso en etapa terminal nunca es pendiente, aunque cumpla cadencia (RN-20)."""
    hace_20_dias = (datetime.utcnow() - timedelta(days=20)).date()
    caso = caso_factory(etapa_terminal_fixture, fecha_inicio=hace_20_dias)

    pendientes = calcular_casos_pendientes(db_session)

    assert caso.id not in pendientes


def test_calcular_pendientes_excluye_borrador_automatico_pendiente(
    db_session, etapa_fixture, caso_factory, comunicacion_factory
):
    """Caso con un ACTUALIZACION_AUTOMATICA PENDIENTE_REVISION ya existente → no pendiente (RN-22)."""
    hace_20_dias = (datetime.utcnow() - timedelta(days=20)).date()
    caso = caso_factory(etapa_fixture, fecha_inicio=hace_20_dias)
    comunicacion_factory(
        caso.id,
        tipo=TipoComunicacion.ACTUALIZACION_AUTOMATICA,
        estado=EstadoComunicacion.PENDIENTE_REVISION,
    )

    pendientes = calcular_casos_pendientes(db_session)

    assert caso.id not in pendientes


def test_calcular_pendientes_ultima_aprobada_vencida(
    db_session, etapa_fixture, caso_factory, comunicacion_factory
):
    """Última ACTUALIZACION_AUTOMATICA APROBADO hace >=15 días → pendiente."""
    caso = caso_factory(
        etapa_fixture, fecha_inicio=(datetime.utcnow() - timedelta(days=100)).date()
    )
    comunicacion_factory(
        caso.id,
        tipo=TipoComunicacion.ACTUALIZACION_AUTOMATICA,
        estado=EstadoComunicacion.APROBADO,
        aprobado_en=datetime.utcnow() - timedelta(days=16),
    )

    pendientes = calcular_casos_pendientes(db_session)

    assert caso.id in pendientes


def test_calcular_pendientes_ultima_aprobada_reciente(
    db_session, etapa_fixture, caso_factory, comunicacion_factory
):
    """Última ACTUALIZACION_AUTOMATICA APROBADO hace <15 días → no pendiente."""
    caso = caso_factory(
        etapa_fixture, fecha_inicio=(datetime.utcnow() - timedelta(days=100)).date()
    )
    comunicacion_factory(
        caso.id,
        tipo=TipoComunicacion.ACTUALIZACION_AUTOMATICA,
        estado=EstadoComunicacion.APROBADO,
        aprobado_en=datetime.utcnow() - timedelta(days=3),
    )

    pendientes = calcular_casos_pendientes(db_session)

    assert caso.id not in pendientes


def test_calcular_pendientes_fecha_inicio_null_usa_creado_en(
    db_session, etapa_fixture, caso_factory
):
    """fecha_inicio NULL → usa caso.creado_en como fallback (RN-21)."""
    hace_20_dias = datetime.utcnow() - timedelta(days=20)
    caso = caso_factory(etapa_fixture, fecha_inicio=None, creado_en=hace_20_dias)

    pendientes = calcular_casos_pendientes(db_session)

    assert caso.id in pendientes


def test_calcular_pendientes_ignora_comunicacion_manual(
    db_session, etapa_fixture, caso_factory, comunicacion_factory
):
    """Una comunicación MANUAL aprobada no cuenta para la cadencia (solo ACTUALIZACION_AUTOMATICA)."""
    caso = caso_factory(etapa_fixture, fecha_inicio=(datetime.utcnow() - timedelta(days=20)).date())
    comunicacion_factory(
        caso.id,
        tipo=TipoComunicacion.MANUAL,
        estado=EstadoComunicacion.APROBADO,
        aprobado_en=datetime.utcnow() - timedelta(days=1),
    )

    pendientes = calcular_casos_pendientes(db_session)

    # La última MANUAL aprobada es reciente, pero no es ACTUALIZACION_AUTOMATICA:
    # la referencia sigue siendo fecha_inicio (hace 20 días) → pendiente.
    assert caso.id in pendientes


# ── persistir_borrador_automatico (WF-05, RF-26.2) ────────────────────────────


def test_persistir_borrador_automatico_exito(db_session, caso_fixture):
    """Éxito: crea Comunicacion(tipo=ACTUALIZACION_AUTOMATICA, estado=PENDIENTE_REVISION)."""
    resultado = persistir_borrador_automatico(db_session, caso_fixture.id, "Su caso avanzó.")

    assert resultado.id is not None
    assert resultado.caso_id == caso_fixture.id
    assert resultado.tipo == TipoComunicacion.ACTUALIZACION_AUTOMATICA
    assert resultado.estado == EstadoComunicacion.PENDIENTE_REVISION
    assert resultado.contenido == "Su caso avanzó."
    assert resultado.aprobado_por is None
    assert resultado.aprobado_en is None


def test_persistir_borrador_automatico_caso_inexistente(db_session):
    """caso_id que no existe → CasoNoEncontrado."""
    with pytest.raises(CasoNoEncontrado):
        persistir_borrador_automatico(db_session, 99999, "Contenido.")


def test_persistir_borrador_automatico_idempotencia(db_session, caso_fixture, comunicacion_factory):
    """Ya existe un ACTUALIZACION_AUTOMATICA PENDIENTE_REVISION → BorradorAutomaticoDuplicado."""
    comunicacion_factory(
        caso_fixture.id,
        tipo=TipoComunicacion.ACTUALIZACION_AUTOMATICA,
        estado=EstadoComunicacion.PENDIENTE_REVISION,
    )

    with pytest.raises(BorradorAutomaticoDuplicado):
        persistir_borrador_automatico(db_session, caso_fixture.id, "Otro contenido.")


# ── listar_comunicaciones (RF-26.4) ───────────────────────────────────────────


def test_listar_comunicaciones_sin_filtro(db_session, caso_fixture, comunicacion_factory):
    """Sin filtro devuelve todos los borradores del caso."""
    comunicacion_factory(caso_fixture.id, estado=EstadoComunicacion.PENDIENTE_REVISION)
    comunicacion_factory(caso_fixture.id, estado=EstadoComunicacion.APROBADO)

    resultado = listar_comunicaciones(db_session)

    assert len(resultado) == 2


def test_listar_comunicaciones_filtra_por_estado(db_session, caso_fixture, comunicacion_factory):
    """Filtra correctamente por estado."""
    comunicacion_factory(caso_fixture.id, estado=EstadoComunicacion.PENDIENTE_REVISION)
    comunicacion_factory(caso_fixture.id, estado=EstadoComunicacion.APROBADO)

    resultado = listar_comunicaciones(db_session, estado=EstadoComunicacion.PENDIENTE_REVISION)

    assert len(resultado) == 1
    assert resultado[0].estado == EstadoComunicacion.PENDIENTE_REVISION


def test_listar_comunicaciones_forma_enriquecida(
    db_session, caso_fixture, etapa_fixture, comunicacion_factory
):
    """El resultado trae cliente/area/etapa/preview y NO campos sensibles (ADR-0004, D7)."""
    com = comunicacion_factory(
        caso_fixture.id,
        estado=EstadoComunicacion.PENDIENTE_REVISION,
        contenido="Estimado cliente, su caso avanzó.",
    )

    resultado = listar_comunicaciones(db_session, estado=EstadoComunicacion.PENDIENTE_REVISION)

    item = next(i for i in resultado if i.id == com.id)
    assert item.caso_id == caso_fixture.id
    assert item.cliente == "González, Mario"
    assert item.area == "LABORAL"
    assert item.etapa == etapa_fixture.nombre
    assert item.preview == "Estimado cliente, su caso avanzó."

    campos = set(item.model_dump().keys())
    assert {"dni", "cuil", "remuneracion"}.isdisjoint(campos)


# ── revisar_comunicacion (D4, RF-26.4) ────────────────────────────────────────


def test_revisar_comunicacion_aprobar(
    db_session, comunicacion_factory, caso_fixture, usuario_abogado
):
    """Aprobar setea estado=APROBADO, aprobado_por y aprobado_en."""
    com = comunicacion_factory(caso_fixture.id, estado=EstadoComunicacion.PENDIENTE_REVISION)

    resultado = revisar_comunicacion(
        db_session, com.id, EstadoComunicacion.APROBADO, usuario_abogado.id
    )

    assert resultado.estado == EstadoComunicacion.APROBADO
    assert resultado.aprobado_por == usuario_abogado.id
    assert resultado.aprobado_en is not None


def test_revisar_comunicacion_descartar(
    db_session, comunicacion_factory, caso_fixture, usuario_abogado
):
    """Descartar solo cambia el estado; no setea aprobado_por/aprobado_en."""
    com = comunicacion_factory(caso_fixture.id, estado=EstadoComunicacion.PENDIENTE_REVISION)

    resultado = revisar_comunicacion(
        db_session, com.id, EstadoComunicacion.DESCARTADO, usuario_abogado.id
    )

    assert resultado.estado == EstadoComunicacion.DESCARTADO
    assert resultado.aprobado_por is None
    assert resultado.aprobado_en is None


def test_revisar_comunicacion_inexistente(db_session, usuario_abogado):
    """comunicacion_id que no existe → ComunicacionNoEncontrada."""
    with pytest.raises(ComunicacionNoEncontrada):
        revisar_comunicacion(db_session, 99999, EstadoComunicacion.APROBADO, usuario_abogado.id)


def test_revisar_comunicacion_ya_revisada(
    db_session, comunicacion_factory, caso_fixture, usuario_abogado
):
    """Comunicación ya en APROBADO/DESCARTADO → ComunicacionNoPendiente."""
    com = comunicacion_factory(caso_fixture.id, estado=EstadoComunicacion.APROBADO)

    with pytest.raises(ComunicacionNoPendiente):
        revisar_comunicacion(db_session, com.id, EstadoComunicacion.DESCARTADO, usuario_abogado.id)


def test_aprobar_reinicia_ventana_de_cadencia(
    db_session, etapa_fixture, caso_factory, comunicacion_factory, usuario_abogado
):
    """Tras aprobar un borrador, el caso NO reaparece en pendientes hasta +15 días (D4)."""
    caso = caso_factory(
        etapa_fixture, fecha_inicio=(datetime.utcnow() - timedelta(days=100)).date()
    )
    com = comunicacion_factory(caso.id, estado=EstadoComunicacion.PENDIENTE_REVISION)

    # Antes de aprobar: no aparece como pendiente (tiene un automático PENDIENTE_REVISION, RN-22)
    assert caso.id not in calcular_casos_pendientes(db_session)

    revisar_comunicacion(db_session, com.id, EstadoComunicacion.APROBADO, usuario_abogado.id)

    # Recién aprobado: la ventana se reinicia, no vence hasta dentro de 15 días
    assert caso.id not in calcular_casos_pendientes(db_session)
