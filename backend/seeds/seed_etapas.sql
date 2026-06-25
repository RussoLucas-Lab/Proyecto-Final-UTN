-- =====================================================================
-- Iuris — Seed de etapas y transiciones del ciclo de vida de los casos
-- Fuente: ADR-0008, RN-04/RN-09, docs/03-arquitectura/diagramas.md.
-- (SDD: la spec manda; estos datos deben coincidir con los diagramas.)
-- Idempotente: puede ejecutarse varias veces sin duplicar datos.
-- Requiere las tablas `etapa` y `transicion_etapa` ya migradas y el
-- tipo enum `area_derecho`. Ejecutar DESPUÉS de `alembic upgrade head`.
-- Comando oficial: psql "$DATABASE_URL" -f backend/seeds/seed_etapas.sql
-- =====================================================================

-- ----------------------------- ETAPAS -------------------------------
INSERT INTO etapa (area, fase, nombre, orden, es_terminal) VALUES
  -- LABORAL — instancia extrajudicial
  ('LABORAL','EXTRAJUDICIAL','Toma del cliente',        1, false),
  ('LABORAL','EXTRAJUDICIAL','Telegrama 1',             2, false),
  ('LABORAL','EXTRAJUDICIAL','Telegrama 2',             3, false),
  ('LABORAL','EXTRAJUDICIAL','Telegrama 3',             4, false),
  ('LABORAL','EXTRAJUDICIAL','Conciliación',            5, false),
  ('LABORAL','EXTRAJUDICIAL','Acuerdo',                 6, true),   -- terminal
  -- LABORAL — instancia judicial (juicio)
  ('LABORAL','JUDICIAL','Juicio: Inicial',              7, false),
  ('LABORAL','JUDICIAL','Producción de pruebas',        8, false),
  ('LABORAL','JUDICIAL','Vista de causa',               9, false),
  ('LABORAL','JUDICIAL','Sentencia',                   10, true),   -- terminal

  -- ART — instancia extrajudicial
  ('ART','EXTRAJUDICIAL','Toma del cliente',            1, false),
  ('ART','EXTRAJUDICIAL','Denuncia ART',                2, false),  -- vía enfermedad
  ('ART','EXTRAJUDICIAL','SRT / Comisión Médica',       3, false),
  ('ART','EXTRAJUDICIAL','Indemnización',               4, true),   -- terminal
  -- ART — instancia judicial (juicio)
  ('ART','JUDICIAL','Juicio: Inicial',                  5, false),
  ('ART','JUDICIAL','Producción de pruebas',            6, false),
  ('ART','JUDICIAL','Vista de causa',                   7, false),
  ('ART','JUDICIAL','Sentencia',                        8, true)    -- terminal
ON CONFLICT (area, nombre) DO NOTHING;

-- --------------------------- TRANSICIONES ---------------------------
-- Definen el grafo de avances permitidos. El retroceso se habilita a
-- nivel de aplicación con confirmación (no se modela como transición).
WITH t(area, origen, destino) AS (
  VALUES
    -- LABORAL: telegramas -> conciliación -> (acuerdo | juicio)
    ('LABORAL','Toma del cliente',      'Telegrama 1'),
    ('LABORAL','Telegrama 1',           'Telegrama 2'),
    ('LABORAL','Telegrama 1',           'Conciliación'),   -- si el empleador acepta en T1
    ('LABORAL','Telegrama 2',           'Telegrama 3'),
    ('LABORAL','Telegrama 2',           'Conciliación'),   -- si acepta en T2
    ('LABORAL','Telegrama 3',           'Conciliación'),   -- tras T3, con o sin empleador
    ('LABORAL','Conciliación',          'Acuerdo'),        -- hay acuerdo -> fin
    ('LABORAL','Conciliación',          'Juicio: Inicial'),-- sin acuerdo -> juicio
    ('LABORAL','Juicio: Inicial',       'Producción de pruebas'),
    ('LABORAL','Producción de pruebas', 'Vista de causa'),
    ('LABORAL','Vista de causa',        'Sentencia'),

    -- ART: accidente (directo a SRT) | enfermedad (denuncia ART -> SRT)
    ('ART','Toma del cliente',          'SRT / Comisión Médica'), -- accidente
    ('ART','Toma del cliente',          'Denuncia ART'),          -- enfermedad
    ('ART','Denuncia ART',              'SRT / Comisión Médica'),
    ('ART','SRT / Comisión Médica',     'Indemnización'),         -- favorable -> fin
    ('ART','SRT / Comisión Médica',     'Juicio: Inicial'),       -- desfavorable -> juicio
    ('ART','Juicio: Inicial',           'Producción de pruebas'),
    ('ART','Producción de pruebas',     'Vista de causa'),
    ('ART','Vista de causa',            'Sentencia')
)
INSERT INTO transicion_etapa (etapa_origen_id, etapa_destino_id)
SELECT o.id, d.id
FROM t
JOIN etapa o ON o.area = t.area::area_derecho AND o.nombre = t.origen
JOIN etapa d ON d.area = t.area::area_derecho AND d.nombre = t.destino
ON CONFLICT (etapa_origen_id, etapa_destino_id) DO NOTHING;
