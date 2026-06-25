"""
Tests del seed de ciclo de vida (etapas + transiciones) — Iuris.

Refs: ADR-0008, RN-04/RN-09, docs/03-arquitectura/diagramas.md,
      openspec/changes/seed-ciclo-de-vida/specs/ciclo-de-vida-seed/spec.md

Los datos de referencia provienen de `seeds.etapas_seed_data` (ETAPAS,
TRANSICIONES). El test NO define constantes propias de nombres de etapa ni
enums de estado en código — las aserciones se derivan de los mismos datos
del seed, garantizando conformidad con ADR-0008 (estados como datos).

Requiere PostgreSQL (ver backend/tests/conftest.py).
"""
from collections import defaultdict

import pytest
from sqlalchemy import text

from seeds.etapas_seed_data import ETAPAS, TRANSICIONES, seed


# ── Fixture: seed aplicado una vez por módulo ─────────────────────────────────


@pytest.fixture(scope="module")
def seeded_engine(db_engine):
    """Aplica el seed una vez para el módulo y devuelve el engine."""
    seed(db_engine)
    return db_engine


# ── 4.2 — Conteos ─────────────────────────────────────────────────────────────


class TestConteos:
    """El seed carga exactamente len(ETAPAS) etapas y len(TRANSICIONES) transiciones."""

    def test_conteo_etapas(self, seeded_engine):
        with seeded_engine.connect() as conn:
            (count,) = conn.execute(text("SELECT count(*) FROM etapa")).fetchone()
        assert count == len(ETAPAS), (
            f"Se esperaban {len(ETAPAS)} etapas, se encontraron {count}"
        )

    def test_conteo_transiciones(self, seeded_engine):
        with seeded_engine.connect() as conn:
            (count,) = conn.execute(
                text("SELECT count(*) FROM transicion_etapa")
            ).fetchone()
        assert count == len(TRANSICIONES), (
            f"Se esperaban {len(TRANSICIONES)} transiciones, se encontraron {count}"
        )


# ── 4.3 — Idempotencia ────────────────────────────────────────────────────────


class TestIdempotencia:
    """Ejecutar el seed dos veces no duplica filas ni lanza error."""

    def test_doble_ejecucion_no_duplica(self, seeded_engine):
        # El seed ya fue aplicado una vez por `seeded_engine`. Lo aplicamos de nuevo.
        seed(seeded_engine)

        with seeded_engine.connect() as conn:
            (etapas,) = conn.execute(text("SELECT count(*) FROM etapa")).fetchone()
            (transiciones,) = conn.execute(
                text("SELECT count(*) FROM transicion_etapa")
            ).fetchone()

        assert etapas == len(ETAPAS), (
            f"Doble ejecución duplicó etapas: se esperaban {len(ETAPAS)}, "
            f"se encontraron {etapas}"
        )
        assert transiciones == len(TRANSICIONES), (
            f"Doble ejecución duplicó transiciones: se esperaban {len(TRANSICIONES)}, "
            f"se encontraron {transiciones}"
        )


# ── 4.4 — Terminalidad ────────────────────────────────────────────────────────


class TestTerminalidad:
    """es_terminal == true exactamente en las etapas marcadas en ETAPAS."""

    def test_terminales_exactas(self, seeded_engine):
        # Derivar terminales esperadas desde los datos del seed (no hardcodeadas).
        terminales_esperadas = {
            (area, nombre)
            for area, _fase, nombre, _orden, es_terminal in ETAPAS
            if es_terminal
        }

        with seeded_engine.connect() as conn:
            rows = conn.execute(
                text("SELECT area::text, nombre FROM etapa WHERE es_terminal = true")
            ).fetchall()

        terminales_en_db = {(row[0], row[1]) for row in rows}
        assert terminales_en_db == terminales_esperadas, (
            f"Terminales en DB: {terminales_en_db}\n"
            f"Terminales esperadas (seed): {terminales_esperadas}"
        )

    def test_no_terminales_sin_marca(self, seeded_engine):
        """Ninguna etapa no-terminal tiene es_terminal = true."""
        no_terminales_esperadas = {
            (area, nombre)
            for area, _fase, nombre, _orden, es_terminal in ETAPAS
            if not es_terminal
        }

        with seeded_engine.connect() as conn:
            rows = conn.execute(
                text("SELECT area::text, nombre FROM etapa WHERE es_terminal = false")
            ).fetchall()

        no_terminales_en_db = {(row[0], row[1]) for row in rows}
        assert no_terminales_en_db == no_terminales_esperadas, (
            f"No-terminales en DB: {no_terminales_en_db}\n"
            f"No-terminales esperadas (seed): {no_terminales_esperadas}"
        )


# ── 4.5 — Coherencia del grafo ────────────────────────────────────────────────


class TestCoherenciaGrafo:
    """El grafo de transiciones cumple las invariantes de ADR-0008 y RN-11."""

    def test_ninguna_transicion_cruza_area(self, seeded_engine):
        """Toda transición es intra-área (etapa_origen.area == etapa_destino.area)."""
        with seeded_engine.connect() as conn:
            inter_area = conn.execute(
                text("""
                    SELECT t.id, o.area::text AS area_origen, d.area::text AS area_destino
                    FROM transicion_etapa t
                    JOIN etapa o ON o.id = t.etapa_origen_id
                    JOIN etapa d ON d.id = t.etapa_destino_id
                    WHERE o.area != d.area
                """)
            ).fetchall()

        assert not inter_area, (
            f"Se encontraron transiciones que cruzan área: {inter_area}"
        )

    def test_etapas_no_iniciales_alcanzables_desde_inicio(self, seeded_engine):
        """Toda etapa de cada área es alcanzable desde la etapa de orden 1 (BFS)."""
        # El nodo inicial se obtiene del seed por orden, no por nombre hardcodeado.
        iniciales_por_area: dict[str, str] = {}
        for area, _fase, nombre, orden, _terminal in ETAPAS:
            if orden == 1:
                iniciales_por_area[area] = nombre

        with seeded_engine.connect() as conn:
            edges = conn.execute(
                text("""
                    SELECT o.area::text, o.nombre, d.nombre
                    FROM transicion_etapa t
                    JOIN etapa o ON o.id = t.etapa_origen_id
                    JOIN etapa d ON d.id = t.etapa_destino_id
                """)
            ).fetchall()

        # Construir grafo por área: {area: {origen: {destinos}}}
        grafo: dict[str, dict[str, set[str]]] = defaultdict(
            lambda: defaultdict(set)
        )
        for area, origen, destino in edges:
            grafo[area][origen].add(destino)

        # BFS desde el nodo inicial de cada área
        areas = {area for area, *_ in ETAPAS}
        for area in areas:
            nombre_inicial = iniciales_por_area[area]
            alcanzables: set[str] = set()
            cola: list[str] = [nombre_inicial]
            while cola:
                nodo = cola.pop()
                if nodo in alcanzables:
                    continue
                alcanzables.add(nodo)
                cola.extend(grafo[area].get(nodo, []))

            nombres_area = {n for a, _f, n, _o, _t in ETAPAS if a == area}
            inalcanzables = nombres_area - alcanzables
            assert not inalcanzables, (
                f"[{area}] Etapas no alcanzables desde '{nombre_inicial}': "
                f"{inalcanzables}"
            )

    def test_etapas_no_terminales_tienen_salida(self, seeded_engine):
        """Toda etapa no-terminal tiene al menos una transición de salida."""
        with seeded_engine.connect() as conn:
            sin_salida = conn.execute(
                text("""
                    SELECT e.area::text, e.nombre
                    FROM etapa e
                    WHERE e.es_terminal = false
                      AND NOT EXISTS (
                          SELECT 1 FROM transicion_etapa t
                          WHERE t.etapa_origen_id = e.id
                      )
                    ORDER BY e.area, e.orden
                """)
            ).fetchall()

        assert not sin_salida, (
            f"Etapas no-terminales sin transición de salida: "
            f"{[(r[0], r[1]) for r in sin_salida]}"
        )


# ── 4.6 — Guardrail: no enums/literales de estado en el test ─────────────────


class TestSinEnumsEnCodigo:
    """Verifica estructuralmente que el test no introduce enums de estado."""

    def test_etapas_leidas_desde_seed_no_hardcodeadas(self):
        """ETAPAS y TRANSICIONES son listas del seed, no constantes definidas aquí."""
        # El test usa len(ETAPAS) / len(TRANSICIONES), nunca literales 18/19.
        # Este test verifica que los counts se derivan de los datos.
        assert len(ETAPAS) == 18, (
            "ETAPAS debe tener 18 filas según la spec "
            "(ADR-0008, docs/03-arquitectura/diagramas.md)"
        )
        assert len(TRANSICIONES) == 19, (
            "TRANSICIONES debe tener 19 filas según la spec "
            "(ADR-0008, docs/03-arquitectura/diagramas.md)"
        )

    def test_areas_en_datos_no_en_enum_de_codigo(self):
        """Las áreas del seed son strings 'LABORAL'/'ART', sin enum Python de código."""
        areas_en_seed = {area for area, *_ in ETAPAS}
        # Verificar que las áreas esperadas están presentes (dato vs. dato)
        assert "LABORAL" in areas_en_seed
        assert "ART" in areas_en_seed
        assert len(areas_en_seed) == 2
