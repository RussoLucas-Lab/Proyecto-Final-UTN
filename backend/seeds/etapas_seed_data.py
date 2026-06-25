"""
Seed del ciclo de vida de los casos (etapas + transiciones) para Iuris.

Fuente: ADR-0008, RN-04/RN-09, docs/03-arquitectura/diagramas.md.
(SDD: la spec manda; estos datos deben coincidir con los diagramas.)

Los datos están desacoplados del mecanismo: `ETAPAS` y `TRANSICIONES`
describen el grafo; `seed(engine)` lo carga de forma idempotente con
SQLAlchemy. Este módulo es el equivalente programático de `seed_etapas.sql`
(fuente canónica) para tests y base sintética.

Uso:
    from sqlalchemy import create_engine
    from etapas_seed_data import seed
    seed(create_engine("postgresql+psycopg2://..."))

Requiere las tablas `etapa` y `transicion_etapa` (DBML v2) ya migradas.
"""
from sqlalchemy import text

# (area, fase, nombre, orden, es_terminal)
ETAPAS = [
    # LABORAL — extrajudicial
    ("LABORAL", "EXTRAJUDICIAL", "Toma del cliente",         1, False),
    ("LABORAL", "EXTRAJUDICIAL", "Telegrama 1",              2, False),
    ("LABORAL", "EXTRAJUDICIAL", "Telegrama 2",              3, False),
    ("LABORAL", "EXTRAJUDICIAL", "Telegrama 3",              4, False),
    ("LABORAL", "EXTRAJUDICIAL", "Conciliación",             5, False),
    ("LABORAL", "EXTRAJUDICIAL", "Acuerdo",                  6, True),
    # LABORAL — judicial
    ("LABORAL", "JUDICIAL",      "Juicio: Inicial",          7, False),
    ("LABORAL", "JUDICIAL",      "Producción de pruebas",    8, False),
    ("LABORAL", "JUDICIAL",      "Vista de causa",           9, False),
    ("LABORAL", "JUDICIAL",      "Sentencia",               10, True),
    # ART — extrajudicial
    ("ART",     "EXTRAJUDICIAL", "Toma del cliente",         1, False),
    ("ART",     "EXTRAJUDICIAL", "Denuncia ART",             2, False),
    ("ART",     "EXTRAJUDICIAL", "SRT / Comisión Médica",    3, False),
    ("ART",     "EXTRAJUDICIAL", "Indemnización",            4, True),
    # ART — judicial
    ("ART",     "JUDICIAL",      "Juicio: Inicial",          5, False),
    ("ART",     "JUDICIAL",      "Producción de pruebas",    6, False),
    ("ART",     "JUDICIAL",      "Vista de causa",           7, False),
    ("ART",     "JUDICIAL",      "Sentencia",                8, True),
]

# (area, origen, destino)
TRANSICIONES = [
    # LABORAL
    ("LABORAL", "Toma del cliente",      "Telegrama 1"),
    ("LABORAL", "Telegrama 1",           "Telegrama 2"),
    ("LABORAL", "Telegrama 1",           "Conciliación"),
    ("LABORAL", "Telegrama 2",           "Telegrama 3"),
    ("LABORAL", "Telegrama 2",           "Conciliación"),
    ("LABORAL", "Telegrama 3",           "Conciliación"),
    ("LABORAL", "Conciliación",          "Acuerdo"),
    ("LABORAL", "Conciliación",          "Juicio: Inicial"),
    ("LABORAL", "Juicio: Inicial",       "Producción de pruebas"),
    ("LABORAL", "Producción de pruebas", "Vista de causa"),
    ("LABORAL", "Vista de causa",        "Sentencia"),
    # ART
    ("ART",     "Toma del cliente",      "SRT / Comisión Médica"),  # accidente
    ("ART",     "Toma del cliente",      "Denuncia ART"),           # enfermedad
    ("ART",     "Denuncia ART",          "SRT / Comisión Médica"),
    ("ART",     "SRT / Comisión Médica", "Indemnización"),
    ("ART",     "SRT / Comisión Médica", "Juicio: Inicial"),
    ("ART",     "Juicio: Inicial",       "Producción de pruebas"),
    ("ART",     "Producción de pruebas", "Vista de causa"),
    ("ART",     "Vista de causa",        "Sentencia"),
]


def seed(engine):
    """Carga etapas y transiciones de forma idempotente.

    Apoya la idempotencia en las restricciones únicas ya provistas por la
    migración: uq_etapa_area_nombre (area, nombre) y
    uq_transicion_etapa_etapa_origen_id_etapa_destino_id.
    No crea índices ni restricciones (eso pertenece a las migraciones).
    """
    with engine.begin() as conn:
        for area, fase, nombre, orden, es_terminal in ETAPAS:
            conn.execute(
                text(
                    "INSERT INTO etapa (area, fase, nombre, orden, es_terminal) "
                    "VALUES (:area, :fase, :nombre, :orden, :es_terminal) "
                    "ON CONFLICT (area, nombre) DO NOTHING"
                ),
                {"area": area, "fase": fase, "nombre": nombre,
                 "orden": orden, "es_terminal": es_terminal},
            )
        for area, origen, destino in TRANSICIONES:
            conn.execute(
                text(
                    "INSERT INTO transicion_etapa (etapa_origen_id, etapa_destino_id) "
                    "SELECT o.id, d.id FROM etapa o, etapa d "
                    "WHERE o.area = CAST(:area AS area_derecho) AND o.nombre = :origen "
                    "  AND d.area = CAST(:area AS area_derecho) AND d.nombre = :destino "
                    "ON CONFLICT (etapa_origen_id, etapa_destino_id) DO NOTHING"
                ),
                {"area": area, "origen": origen, "destino": destino},
            )


if __name__ == "__main__":
    import os
    from sqlalchemy import create_engine
    url = os.environ.get("DATABASE_URL", "postgresql+psycopg2://postgres@/postgres")
    seed(create_engine(url))
    print(f"Seed OK: {len(ETAPAS)} etapas, {len(TRANSICIONES)} transiciones.")
