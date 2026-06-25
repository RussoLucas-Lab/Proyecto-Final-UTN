## 1. Validación contra la spec (gana la spec)

- [x] 1.1 Confirmar las 18 etapas y su terminalidad contra `docs/03-arquitectura/diagramas.md` (Laboral: 10, ART: 8; terminales: Acuerdo, Sentencia, Indemnización) — documentar cualquier desvío
- [x] 1.2 Confirmar las 19 transiciones contra los diagramas (11 Laboral + 8 ART) y que todas son intra-área (RN-11)
- [x] 1.3 Verificar que las columnas del seed (`area`, `fase`, `nombre`, `orden`, `es_terminal`) coinciden con el modelo ORM `Etapa` en `backend/app/features/casos/models.py` y con el DBML
- [x] 1.4 Confirmar el nombre real del tipo enum de área en Postgres con `psql "$DATABASE_URL" -c "\dT"` (esperado `area_derecho`) y que el cast del seed lo usa
- [x] 1.5 Confirmar que las restricciones únicas `uq_etapa_area_nombre (area,nombre)` y `uq_transicion_etapa_etapa_origen_id_etapa_destino_id` existen en la migración aplicada (`\d etapa`, `\d transicion_etapa`)

## 2. Depurar y re-anclar `seed_etapas.sql` (canónico)

- [x] 2.1 Reemplazar la cita `INFORME_RELEVAMIENTO.md §3` del encabezado por referencias a ADR-0008, RN-04/RN-09 y `docs/03-arquitectura/diagramas.md`
- [x] 2.2 Eliminar la sentencia `CREATE UNIQUE INDEX IF NOT EXISTS ux_etapa_area_nombre` (la restricción `uq_etapa_area_nombre` ya la provee la migración; el seed no crea estructura)
- [x] 2.3 Documentar en el encabezado el requisito de orden: ejecutar tras `alembic upgrade head` y el comando oficial `psql "$DATABASE_URL" -f backend/seeds/seed_etapas.sql`
- [x] 2.4 Verificar que `ON CONFLICT (area, nombre) DO NOTHING` y `ON CONFLICT (etapa_origen_id, etapa_destino_id) DO NOTHING` se mantienen (idempotencia)

## 3. Sincronizar `etapas_seed_data.py`

- [x] 3.1 Reemplazar la cita `INFORME_RELEVAMIENTO.md §3` del docstring por referencias a la spec (ADR-0008, RN-04/RN-09, diagramas)
- [x] 3.2 Eliminar la creación del índice `ux_etapa_area_nombre` dentro de `seed(engine)` (apoyarse en la restricción migrada)
- [x] 3.3 Verificar que `ETAPAS` (18) y `TRANSICIONES` (19) son idénticas, dato a dato, a las del `.sql`

## 4. Test de carga sobre base sintética

- [x] 4.1 Agregar test en `backend/tests/` (espejando feature `casos`) que aplique el seed sobre una base sintética migrada
- [x] 4.2 Aserción de conteos: `etapa` = 18, `transicion_etapa` = 19
- [x] 4.3 Aserción de idempotencia: ejecutar el seed dos veces y verificar que los conteos no cambian y no hay error
- [x] 4.4 Aserción de terminalidad: `es_terminal = true` solo en Acuerdo, Sentencia (Laboral) e Indemnización, Sentencia (ART)
- [x] 4.5 Aserción de coherencia del grafo: ninguna transición cruza área; toda etapa no inicial alcanzable desde `Toma del cliente`; toda etapa no terminal tiene salida
- [x] 4.6 Verificar que el test NO introduce enums/literales de estado en código (renderizado/lectura por dato)

## 5. Verificación e integración final

- [ ] 5.1 Ejecutar el seed canónico contra la DB del compose y verificar conteos con `psql` (18/19)
- [ ] 5.2 Re-ejecutar el seed y confirmar idempotencia (conteos estables)
- [x] 5.3 Confirmar que NO se creó ni modificó ninguna migración Alembic (solo datos)
- [x] 5.4 Actualizar `docs/changemap.md`: marcar la fila del seed del ciclo de vida como completada (de 🔲 a hecho)
- [ ] 5.5 Confirmar que la cobertura de tests del seed cumple el umbral del proyecto (≥ 80%) y commit con refs a spec (`[refs ADR-0008, RN-04]`)
