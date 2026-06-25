## ADDED Requirements

### Requirement: Catálogo de etapas por área cargado vía seed

El sistema SHALL proveer un seed que cargue el catálogo de etapas del ciclo de vida en la tabla `etapa`, modelado como **datos** (no enum) según ADR-0008. El seed MUST cargar exactamente **18 etapas**: **10 para `LABORAL`** (6 en fase `EXTRAJUDICIAL`, 4 en `JUDICIAL`) y **8 para `ART`** (4 en `EXTRAJUDICIAL`, 4 en `JUDICIAL`), cada una con su `area`, `fase`, `nombre`, `orden` y `es_terminal`. Las etapas y sus marcas de terminalidad MUST coincidir con los diagramas de ciclo de vida de `docs/03-arquitectura/diagramas.md`.

#### Scenario: Carga del catálogo Laboral

- **WHEN** se ejecuta el seed sobre el esquema migrado
- **THEN** `etapa` contiene las 10 etapas Laboral: `Toma del cliente`, `Telegrama 1`, `Telegrama 2`, `Telegrama 3`, `Conciliación`, `Acuerdo` (terminal) en `EXTRAJUDICIAL`; y `Juicio: Inicial`, `Producción de pruebas`, `Vista de causa`, `Sentencia` (terminal) en `JUDICIAL`

#### Scenario: Carga del catálogo ART

- **WHEN** se ejecuta el seed sobre el esquema migrado
- **THEN** `etapa` contiene las 8 etapas ART: `Toma del cliente`, `Denuncia ART`, `SRT / Comisión Médica`, `Indemnización` (terminal) en `EXTRAJUDICIAL`; y `Juicio: Inicial`, `Producción de pruebas`, `Vista de causa`, `Sentencia` (terminal) en `JUDICIAL`

#### Scenario: Etapas terminales marcadas

- **WHEN** se inspeccionan las etapas con `es_terminal = true`
- **THEN** son exactamente `Acuerdo` y `Sentencia` (Laboral) e `Indemnización` y `Sentencia` (ART), y ninguna otra

### Requirement: Grafo de transiciones válidas por área cargado vía seed

El sistema SHALL cargar en `transicion_etapa` el grafo de avances permitidos entre etapas, cargando exactamente **19 transiciones**: **11 para `LABORAL`** y **8 para `ART`**. Cada transición MUST ser **intra-área** (`etapa_origen.area == etapa_destino.area`, RN-11) y MUST corresponder a una arista de los diagramas de `docs/03-arquitectura/diagramas.md`. Las transiciones referencian las etapas por su clave natural `(area, nombre)`. El retroceso NO se modela como transición: se habilita a nivel de aplicación con confirmación (RN-09).

#### Scenario: Transiciones Laboral cargadas

- **WHEN** se ejecuta el seed
- **THEN** existen las 11 transiciones Laboral del diagrama: `Toma del cliente→Telegrama 1`, `Telegrama 1→Telegrama 2`, `Telegrama 1→Conciliación`, `Telegrama 2→Telegrama 3`, `Telegrama 2→Conciliación`, `Telegrama 3→Conciliación`, `Conciliación→Acuerdo`, `Conciliación→Juicio: Inicial`, `Juicio: Inicial→Producción de pruebas`, `Producción de pruebas→Vista de causa`, `Vista de causa→Sentencia`

#### Scenario: Transiciones ART cargadas

- **WHEN** se ejecuta el seed
- **THEN** existen las 8 transiciones ART del diagrama: `Toma del cliente→SRT / Comisión Médica` (accidente), `Toma del cliente→Denuncia ART` (enfermedad), `Denuncia ART→SRT / Comisión Médica`, `SRT / Comisión Médica→Indemnización`, `SRT / Comisión Médica→Juicio: Inicial`, `Juicio: Inicial→Producción de pruebas`, `Producción de pruebas→Vista de causa`, `Vista de causa→Sentencia`

#### Scenario: Ninguna transición cruza área

- **WHEN** se inspecciona cada fila de `transicion_etapa`
- **THEN** la etapa origen y la etapa destino pertenecen a la misma `area`

#### Scenario: Grafo coherente sin etapas huérfanas no intencionales

- **WHEN** se analiza el grafo de transiciones por área
- **THEN** toda etapa no inicial es alcanzable desde `Toma del cliente`, y toda etapa no terminal tiene al menos una transición de salida

### Requirement: Seed idempotente

El seed SHALL ser idempotente: ejecutarlo más de una vez MUST dejar el mismo estado final sin filas duplicadas. La idempotencia de `etapa` se apoya en la restricción única **existente** `(area, nombre)` (`uq_etapa_area_nombre`, provista por la migración base) vía `ON CONFLICT (area, nombre) DO NOTHING`. La de `transicion_etapa` se apoya en la restricción única `(etapa_origen_id, etapa_destino_id)` vía `ON CONFLICT DO NOTHING`. El seed NO MUST crear índices ni restricciones (eso pertenece a las migraciones de esquema, no al seed de datos).

#### Scenario: Doble ejecución no duplica

- **WHEN** el seed se ejecuta dos veces consecutivas sobre la misma base
- **THEN** `etapa` mantiene 18 filas y `transicion_etapa` mantiene 19 filas, sin duplicados ni errores

#### Scenario: El seed no altera el esquema

- **WHEN** se revisa el contenido del seed
- **THEN** no contiene `CREATE INDEX`, `CREATE UNIQUE INDEX` ni `ALTER TABLE`; depende de las restricciones ya creadas por la migración

### Requirement: Fuente canónica y sincronización SQL/Python

El sistema SHALL mantener dos artefactos de seed coherentes: `backend/seeds/seed_etapas.sql` como **fuente canónica** (ejecutable con el comando oficial `psql "$DATABASE_URL" -f backend/seeds/seed_etapas.sql`) y `backend/seeds/etapas_seed_data.py` como equivalente programático para tests y base sintética. Ambos MUST representar el mismo conjunto de 18 etapas y 19 transiciones. Las referencias de origen en ambos artefactos MUST citar la spec (`ADR-0008`, `RN-04`, `RN-09`, `docs/03-arquitectura/diagramas.md`) y NO `INFORME_RELEVAMIENTO.md`.

#### Scenario: Datos equivalentes entre .sql y .py

- **WHEN** se comparan los datos de `seed_etapas.sql` y `etapas_seed_data.py`
- **THEN** ambos definen idénticas 18 etapas (misma `area`, `fase`, `nombre`, `orden`, `es_terminal`) e idénticas 19 transiciones

#### Scenario: Referencias ancladas a la spec

- **WHEN** se leen los comentarios/encabezados de ambos artefactos de seed
- **THEN** citan ADR-0008, RN-04/RN-09 y los diagramas de `docs/`, sin referencias a `INFORME_RELEVAMIENTO.md`
