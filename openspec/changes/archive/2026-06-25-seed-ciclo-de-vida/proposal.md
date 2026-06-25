## Why

El esquema con las tablas `etapa`, `transicion_etapa` e `historial_caso` ya está migrado (change `migraciones-esquema-base`), pero está **vacío**: sin etapas ni transiciones cargadas, ningún caso puede crearse ni avanzar, porque `caso.etapa_actual_id` exige una `etapa` existente y RN-04 exige validar contra `transicion_etapa`. ADR-0008 define que estos flujos viven como **datos** (no enum) y se cargan vía seed. Este change provee y deja *grounded en la spec* ese seed inicial: el ciclo de vida real de las áreas Laboral y ART (18 etapas, 19 transiciones).

Existen dos borradores previos (`backend/seeds/seed_etapas.sql` y `backend/seeds/etapas_seed_data.py`) que citan `INFORME_RELEVAMIENTO.md §3` como fuente en vez de `docs/`. Se validó su contenido contra ADR-0008, RN-04 y los diagramas de ciclo de vida: **los datos coinciden exactamente**. Falta re-anclar la fuente a `docs/` y depurar una redundancia de esquema.

## What Changes

- **Cargar el catálogo de etapas (18)** por área y fase: 10 Laboral (6 extrajudicial + 4 judicial) y 8 ART (4 extrajudicial + 4 judicial), con `orden` y `es_terminal` según los diagramas de `docs/03-arquitectura/diagramas.md`.
- **Cargar el grafo de transiciones válidas (19)**: 11 Laboral + 8 ART, todas intra-área (RN-11), referenciando etapas por su clave natural `(area, nombre)`.
- **Re-anclar la fuente del seed a la spec**: reemplazar las citas a `INFORME_RELEVAMIENTO.md §3` por referencias a ADR-0008, RN-04/RN-09 y los diagramas (regla SDD: gana la spec).
- **Eliminar del seed `.sql`/`.py` la creación redundante del índice único `ux_etapa_area_nombre`**: la migración base ya define la restricción única `uq_etapa_area_nombre` sobre `(area, nombre)`; el `ON CONFLICT (area, nombre)` se apoya en ella. No debe crearse un segundo índice único.
- **Fijar la fuente canónica**: el `.sql` es canónico (comando oficial `psql "$DATABASE_URL" -f backend/seeds/seed_etapas.sql` de CLAUDE.md); el `.py` es el equivalente programático para tests/base sintética y debe mantenerse sincronizado dato a dato.
- **Garantizar idempotencia**: re-ejecución sin duplicar (`ON CONFLICT ... DO NOTHING` en etapas y transiciones).
- NO se modifica el esquema (no hay migración Alembic): esto es carga de **datos**, no de estructura.

## Capabilities

### New Capabilities
- `ciclo-de-vida-seed`: datos semilla del ciclo de vida de los casos — catálogo de etapas y grafo de transiciones por área (Laboral/ART), idempotente, ejecutable sobre el esquema migrado y la base sintética, como única fuente de los estados configurables (ADR-0008).

### Modified Capabilities
<!-- Ninguna. El esquema (esquema-base-datos) no cambia; este change solo carga datos sobre las tablas ya migradas. -->

## Impact

- **Datos / DB**: poblar `etapa` (18 filas) y `transicion_etapa` (19 filas) en cualquier entorno (dev, tests, prod) tras `alembic upgrade head`.
- **Archivos**: `backend/seeds/seed_etapas.sql` (canónico) y `backend/seeds/etapas_seed_data.py` (equivalente programático) — ambos depurados y re-anclados a la spec.
- **Feature `casos`**: habilita crear/avanzar casos; el servicio de avance/retroceso (futuro) validará contra estas transiciones (RN-04, RN-05, RN-09).
- **Tests**: requiere un test de carga sobre base sintética que verifique conteos (18/19), idempotencia (doble ejecución sin duplicar) y coherencia del grafo (sin etapas huérfanas no intencionales).
- **Operación**: documentar el comando de seed en el flujo post-migración. Sin secretos ni datos reales (ADR-0004).
