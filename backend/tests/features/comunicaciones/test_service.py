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
"""

import pytest

from app.features.comunicaciones.service import (
    CasoNoEncontrado,
    ServicioIANoDisponible,
    disparar_actualizacion,
    obtener_contexto_caso,
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


async def test_disparar_actualizacion_no_persiste_si_n8n_down(db_session, caso_fixture, mock_n8n_down):
    """n8n caído → ServicioIANoDisponible; no persiste ninguna Comunicacion."""
    from sqlalchemy import select
    from app.features.comunicaciones.models import Comunicacion

    count_antes = db_session.execute(
        select(Comunicacion).where(Comunicacion.caso_id == caso_fixture.id)
    ).scalars().all()

    with pytest.raises(ServicioIANoDisponible):
        await disparar_actualizacion(caso_fixture.id, db_session)

    count_despues = db_session.execute(
        select(Comunicacion).where(Comunicacion.caso_id == caso_fixture.id)
    ).scalars().all()

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

    campos_sensibles = {"dni", "cuil", "remuneracion", "telefono", "email",
                        "domicilio_real", "domicilio_real_cp"}
    assert campos_sensibles.isdisjoint(claves), (
        f"El contexto no debe incluir campos sensibles. Encontrados: "
        f"{campos_sensibles & claves}"
    )


def test_obtener_contexto_caso_inexistente(db_session):
    """caso_id que no existe → CasoNoEncontrado."""
    with pytest.raises(CasoNoEncontrado):
        obtener_contexto_caso(99999, db_session)
