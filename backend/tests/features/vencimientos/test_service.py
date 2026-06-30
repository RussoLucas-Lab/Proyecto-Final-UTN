"""Tests unitarios del service de vencimientos (sin DB real — MagicMock)."""

from datetime import date
from unittest.mock import MagicMock, patch

import pytest

from app.features.vencimientos.schemas import VencimientoCreate
from app.features.vencimientos.service import (
    CasoNoEncontrado,
    VencimientoNoEncontrado,
    completar_vencimiento,
    crear_vencimiento,
    listar_vencimientos_caso,
    listar_vencimientos_rango,
)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_db(caso_exists=True, vencimiento=None):
    db = MagicMock()
    from app.features.casos.models import Caso
    from app.features.vencimientos.models import Vencimiento

    db.get.side_effect = lambda cls, pk: (
        MagicMock(spec=Caso) if cls is Caso and caso_exists
        else (vencimiento if cls is Vencimiento and vencimiento is not None else None)
    )
    return db


# ── crear_vencimiento ─────────────────────────────────────────────────────────


class TestCrearVencimiento:
    def test_crea_con_completado_false(self):
        db = _make_db(caso_exists=True)
        datos = VencimientoCreate(descripcion="Presentar demanda", fecha=date(2026, 7, 15))

        result = crear_vencimiento(1, datos, usuario_id=42, db=db)

        db.add.assert_called_once()
        db.commit.assert_called_once()
        added = db.add.call_args[0][0]
        assert added.completado is False
        assert added.creado_por == 42
        assert added.descripcion == "Presentar demanda"
        assert added.fecha == date(2026, 7, 15)

    def test_caso_inexistente_lanza_excepcion(self):
        db = _make_db(caso_exists=False)
        datos = VencimientoCreate(descripcion="Audiencia", fecha=date(2026, 8, 1))

        with pytest.raises(CasoNoEncontrado):
            crear_vencimiento(999, datos, usuario_id=1, db=db)

    def test_triangulacion_otro_usuario(self):
        db = _make_db(caso_exists=True)
        datos = VencimientoCreate(descripcion="Notificación", fecha=date(2026, 9, 10))

        crear_vencimiento(2, datos, usuario_id=7, db=db)

        added = db.add.call_args[0][0]
        assert added.creado_por == 7
        assert added.caso_id == 2


# ── listar_vencimientos_caso ──────────────────────────────────────────────────


class TestListarVencimientosCaso:
    def test_retorna_lista_vacia(self):
        db = _make_db(caso_exists=True)
        db.query.return_value.filter.return_value.order_by.return_value.all.return_value = []

        result = listar_vencimientos_caso(1, db)

        assert result == []

    def test_caso_inexistente_lanza_excepcion(self):
        db = _make_db(caso_exists=False)

        with pytest.raises(CasoNoEncontrado):
            listar_vencimientos_caso(999, db)


# ── listar_vencimientos_rango ─────────────────────────────────────────────────


class TestListarVencimientosRango:
    def test_retorna_vencimientos_en_rango(self):
        mock_v = MagicMock()
        db = MagicMock()
        db.query.return_value.filter.return_value.order_by.return_value.all.return_value = [mock_v]

        result = listar_vencimientos_rango(date(2026, 7, 1), date(2026, 7, 31), db)

        assert result == [mock_v]

    def test_retorna_lista_vacia_fuera_de_rango(self):
        db = MagicMock()
        db.query.return_value.filter.return_value.order_by.return_value.all.return_value = []

        result = listar_vencimientos_rango(date(2025, 1, 1), date(2025, 1, 31), db)

        assert result == []


# ── completar_vencimiento ─────────────────────────────────────────────────────


class TestCompletarVencimiento:
    def test_actualiza_completado(self):
        from app.features.vencimientos.models import Vencimiento
        mock_v = MagicMock(spec=Vencimiento)
        mock_v.completado = False
        db = _make_db(vencimiento=mock_v)

        result = completar_vencimiento(1, True, db)

        assert mock_v.completado is True
        db.commit.assert_called_once()

    def test_vencimiento_inexistente_lanza_excepcion(self):
        db = _make_db(caso_exists=False, vencimiento=None)

        with pytest.raises(VencimientoNoEncontrado):
            completar_vencimiento(999, True, db)
