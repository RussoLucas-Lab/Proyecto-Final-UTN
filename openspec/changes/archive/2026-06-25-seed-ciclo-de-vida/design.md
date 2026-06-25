## Context

ADR-0008 modela el ciclo de vida del caso como **datos configurables** en `etapa` y `transicion_etapa`, parametrizados por área (Laboral/ART). El esquema ya está migrado (change `migraciones-esquema-base`): los modelos ORM `Etapa`, `TransicionEtapa` e `HistorialCaso` existen en `backend/app/features/casos/models.py` y las tablas están vacías. Sin etapas no se puede crear un caso (`caso.etapa_actual_id` es NOT NULL con FK a `etapa`), y sin transiciones RN-04 no puede validar avances.

Existen dos borradores previos en `backend/seeds/`:
- `seed_etapas.sql` (73 líneas): 18 etapas + 19 transiciones, idempotente con `ON CONFLICT (area, nombre)`.
- `etapas_seed_data.py` (104 líneas): mismos datos desacoplados en listas `ETAPAS`/`TRANSICIONES` + función `seed(engine)` con SQLAlchemy.

**Validación realizada contra la spec** (regla SDD: gana la spec):
- Las 18 etapas y 19 transiciones coinciden **exactamente** con los diagramas de `docs/03-arquitectura/diagramas.md` (Laboral y ART) y con la terminalidad de RN-09.
- Las columnas usadas (`area`, `fase`, `nombre`, `orden`, `es_terminal`) coinciden con el modelo ORM `Etapa` y el DBML.
- **Divergencias detectadas**: (1) citan `INFORME_RELEVAMIENTO.md §3` como fuente en lugar de `docs/`; (2) crean un índice único `ux_etapa_area_nombre` que **duplica** la restricción `uq_etapa_area_nombre` ya creada por la migración (ORM: `UniqueConstraint("area","nombre", name="uq_etapa_area_nombre")`).

Restricciones: stack FastAPI + PostgreSQL + SQLAlchemy 2.x + Alembic; feature-first (ADR-0009); base sintética en dev/tests (ADR-0004); pnpm para frontend (no aplica aquí). El enum Postgres del área se llama `area_derecho`.

## Goals / Non-Goals

**Goals:**
- Dejar el seed de ciclo de vida (18 etapas / 19 transiciones) cargable sobre el esquema migrado y la base sintética, idempotente.
- Re-anclar la fuente de los seeds a `docs/` (ADR-0008, RN-04/RN-09, diagramas), eliminando citas a `INFORME_RELEVAMIENTO.md`.
- Definir `seed_etapas.sql` como fuente canónica y `etapas_seed_data.py` como equivalente sincronizado para tests.
- Eliminar la creación redundante del índice único en ambos artefactos.
- Cubrir con un test sobre base sintética: conteos, idempotencia y coherencia del grafo.

**Non-Goals:**
- NO implementar el servicio de avance/retroceso de etapas (mover un caso) — es un change posterior de la feature `casos`.
- NO crear ni modificar migraciones de esquema (esto es carga de datos, no estructura).
- NO tocar frontend ni endpoints.
- NO introducir ningún enum/literal de estado en código (prohibido por ADR-0008 y la skill `etapas-y-transiciones`).

## Decisions

### D1 — Partir de los borradores existentes, no reescribir
Los datos ya están validados contra la spec. Se reutilizan `seed_etapas.sql` y `etapas_seed_data.py` corrigiendo solo: comentarios de fuente y la línea del índice redundante. Alternativa descartada: reescribir desde cero (riesgo de introducir divergencias en datos ya correctos).

### D2 — `seed_etapas.sql` es la fuente canónica
CLAUDE.md fija el comando oficial `psql "$DATABASE_URL" -f backend/seeds/seed_etapas.sql`, ejecutable también dentro del contenedor tras `alembic upgrade head`. El `.py` (`etapas_seed_data.py::seed(engine)`) queda como equivalente programático para tests/pytest y carga sobre base sintética. Ambos representan el mismo conjunto y deben mantenerse sincronizados. Alternativa descartada: que el `.py` genere el `.sql` (sobre-ingeniería para 37 filas estables).

### D3 — Idempotencia apoyada en restricciones ya migradas, sin crear índices en el seed
La migración base ya define `uq_etapa_area_nombre (area, nombre)` y `uq_transicion_etapa_etapa_origen_id_etapa_destino_id (etapa_origen_id, etapa_destino_id)`. El `ON CONFLICT (area, nombre) DO NOTHING` y `ON CONFLICT (etapa_origen_id, etapa_destino_id) DO NOTHING` se apoyan en ellas. Se **elimina** del `.sql` y del `.py` la sentencia `CREATE UNIQUE INDEX IF NOT EXISTS ux_etapa_area_nombre`: un seed de datos no debe crear estructura (skill `etapas-y-transiciones`: "una migración/DDL que mete etapas → eso es seed", e inversamente, DDL no va en el seed). Alternativa descartada: mantener el `CREATE UNIQUE INDEX IF NOT EXISTS` (es idempotente pero genera un segundo índice único redundante sobre las mismas columnas y mezcla DDL con datos).

### D4 — Transiciones referenciadas por clave natural `(area, nombre)`
El seed resuelve los IDs de etapa con `JOIN`/subconsulta por `(area, nombre)` casteando el área a `area_derecho`, en vez de hardcodear IDs autoincrementales. Esto mantiene el seed re-ejecutable y robusto ante cambios de orden de inserción. Coincide con el patrón de ambos borradores.

### D5 — Retroceso fuera del grafo de transiciones
Conforme RN-09 y ADR-0008, el retroceso (caso terminal o vuelta atrás con confirmación) NO se modela como fila en `transicion_etapa`; se resolverá en la capa de servicio del change de avance/retroceso. El seed solo carga avances. Las 19 transiciones son todas de avance.

### D6 — Verificación contra la spec como tarea explícita
Se incluye en tasks una verificación dato-a-dato (18/19, terminalidad, intra-área) contra los diagramas, para que cualquier futura edición del seed mantenga el grounding SDD.

## Risks / Trade-offs

- [El enum Postgres podría no llamarse `area_derecho`] → El cast `::area_derecho` / `CAST(:area AS area_derecho)` falla si el nombre real difiere. Mitigación: la tarea de validación verifica el nombre del tipo con `\dT` antes de ejecutar; el DBML y la convención confirman `area_derecho`.
- [Seed ejecutado antes de migrar] → Falla por tablas inexistentes. Mitigación: el seed asume `alembic upgrade head` previo; se documenta el orden en tasks y en el encabezado del `.sql`.
- [Desincronización futura entre `.sql` y `.py`] → Datos divergentes. Mitigación: test que compara/valida conteos sobre ambos caminos y nota explícita en ambos archivos de mantenerlos en par.
- [Reintroducción de enums de estado en código] → Rompe ADR-0008. Mitigación: la skill `etapas-y-transiciones` y el spec prohíben enums/literales; el frontend renderiza por dato.
- [Etapa huérfana al editar el grafo] → Estado inalcanzable o sin salida. Mitigación: scenario/test de coherencia del grafo (alcanzabilidad desde `Toma del cliente`, salida en no-terminales).

## Migration Plan

1. Confirmar esquema migrado: `alembic current` = head; `etapa`/`transicion_etapa` existen y vacías.
2. Aplicar el seed: `psql "$DATABASE_URL" -f backend/seeds/seed_etapas.sql` (o `etapas_seed_data.seed(engine)` en tests).
3. Verificar: `SELECT count(*) FROM etapa` = 18, `SELECT count(*) FROM transicion_etapa` = 19.
4. Re-ejecutar el seed y verificar que los conteos no cambian (idempotencia).
5. Rollback: como es solo data idempotente, el "rollback" es `TRUNCATE etapa, transicion_etapa RESTART IDENTITY CASCADE` en entornos no productivos; en prod no se borra (no hay casos aún si se siembra al inicio). No hay cambio de esquema que revertir.

## Open Questions

- ¿El seed se ejecuta automáticamente en `docker compose up` (junto a `alembic upgrade head`) o queda como paso manual documentado? Recomendación: paso documentado en operación; automatizarlo es un ajuste menor de infra fuera de este change.
