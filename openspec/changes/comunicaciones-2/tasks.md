## 1. Verificación previa (sin migración)

- [x] 1.1 Confirmar `alembic current` = `001 (head)` y que `Comunicacion` (con `tipo`, `estado`, `generado_en`, `aprobado_por`, `aprobado_en`) y los enums `TipoComunicacion.ACTUALIZACION_AUTOMATICA` / `EstadoComunicacion.{PENDIENTE_REVISION,APROBADO,DESCARTADO}` ya existen. Dejar constancia de que NO se crea revisión Alembic nueva. **Verificado leyendo `backend/app/features/comunicaciones/models.py` y `backend/app/shared/enums.py`: todo ya existe en la migración 001. Sin migración nueva.**
- [x] 1.2 Confirmar que `Etapa.es_terminal` y `Caso.fecha_inicio`/`Caso.creado_en` existen para el cálculo de cadencia (RN-20/RN-21). **Verificado en `backend/app/features/casos/models.py`.**

## 2. Backend — schemas (`comunicaciones/schemas.py`)

- [x] 2.1 `PendientesActualizacionResponse` (o `list[int]`) para la respuesta de `GET /internal/casos/pendientes-actualizacion` (lista de `caso_id`).
- [x] 2.2 `CrearComunicacionInternaRequest` (`contenido: str` no vacío, `tipo` opcional fijado a `ACTUALIZACION_AUTOMATICA`) y su response (`id`, `estado`, `generado_en`) para el `POST /internal/casos/{id}/comunicaciones`.
- [x] 2.3 `BorradorPendienteResponse` (`id`, `caso_id`, `cliente`, `area`, `etapa`, `preview` con `validation_alias="contenido"`, `estado`, `generado_en`) para `GET /comunicaciones`.
- [x] 2.4 `ComunicacionPatchRequest` (`estado: Literal["APROBADO","DESCARTADO"]` o enum restringido) y `ComunicacionPatchResponse` (`id`, `estado`, `aprobado_por`, `aprobado_en`) para el `PATCH`.

## 3. Backend — lógica de servicio (`comunicaciones/service.py`)

- [x] 3.1 `calcular_casos_pendientes(db) -> list[int]`: casos activos (`Etapa.es_terminal == False`, RN-20) + sin borrador automático `PENDIENTE_REVISION` (idempotencia, RN-22) + cadencia ≥15 días desde la última `ACTUALIZACION_AUTOMATICA` `APROBADO` (`aprobado_en`), o `caso.fecha_inicio`, o `caso.creado_en` como fallback (RN-21). Solo lecturas, SQL parametrizado.
- [x] 3.2 `persistir_borrador_automatico(db, caso_id, contenido) -> Comunicacion`: valida caso (404), aplica idempotencia (no crear segundo `PENDIENTE_REVISION` automático → 409 o devolver existente), crea `Comunicacion(tipo=ACTUALIZACION_AUTOMATICA, estado=PENDIENTE_REVISION)`. No envía nada (RN-19).
- [x] 3.3 `listar_comunicaciones(db, estado=None) -> list[...]`: joins `Comunicacion → Caso → Cliente` y `Caso → Etapa`, filtro por estado, orden `generado_en` DESC; mapear al schema enriquecido (sin DNI/CUIL ni montos, ADR-0004).
- [x] 3.4 `revisar_comunicacion(db, id, estado, usuario_id) -> Comunicacion`: valida existencia (404) y que esté en `PENDIENTE_REVISION` (409); si `APROBADO` setea `aprobado_por`/`aprobado_en=now()` (reinicia ventana de cadencia, D4); si `DESCARTADO` solo cambia estado. Nunca envía (RN-10/RN-19).

## 4. Backend — endpoints (`comunicaciones/router.py`)

- [x] 4.1 `GET /internal/casos/pendientes-actualizacion` con `Depends(verify_internal_secret)`, sin cookie/RBAC, exento de CSRF por prefijo `/internal`; devuelve la lista de `caso_id`.
- [x] 4.2 `POST /internal/casos/{caso_id}/comunicaciones` con `Depends(verify_internal_secret)`; mapea 404/409; devuelve el recurso creado.
- [x] 4.3 `GET /comunicaciones` con `estado: EstadoComunicacion | None` (Query), `get_current_user`, rate limit, `response_model=list[BorradorPendienteResponse]`.
- [x] 4.4 `PATCH /comunicaciones/{id}` con `require_roles(ABOGADO, SOCIO)`, CSRF (heredado del middleware para mutaciones de navegador), rate limit, validación Pydantic; pasa `current_user.id` al service; mapea 404/409/422.
- [x] 4.5 Checklist `seguridad-endpoint` en los 4 endpoints: internos = solo `X-Internal-Secret` (sin cookie/RBAC/CSRF); usuario = cookie JWT + (PATCH) CSRF + RBAC + rate limit + Pydantic. Confirmar que NINGUNO dispara envío al cliente (RN-10/RN-19).

## 5. n8n — WF-05 (`n8n/workflows/WF-05-batch-actualizaciones.json`)

- [x] 5.1 Schedule Trigger diario 07:00 `America/Argentina/Buenos_Aires` (decisión resuelta). Requiere `GENERIC_TIMEZONE`/`TZ` en el servicio `n8n` de `docker-compose.yml` (agregado).
- [x] 5.2 HTTP Request `GET /internal/casos/pendientes-actualizacion` con header `X-Internal-Secret` desde credencial/variable de n8n (no hardcodear).
- [x] 5.3 IF (`¿Hay pendientes?`) + Split Out (`casos_pendientes` → item por `caso_id`) + Split In Batches (batchSize=1) para iterar de a uno; lista vacía termina sin iterar.
- [x] 5.4 Reutiliza el AI Agent de WF-01 (mismo `systemMessage`/reglas + OpenAI Chat Model + tool `obtener_contexto_caso` → `GET /internal/casos/{id}/contexto`), respetando RN-23 (sin plazos ni montos, lenguaje simple).
- [x] 5.5 Nodo `Preparar Persistencia` (recupera `caso_id` tras el AI Agent) → HTTP Request `POST /internal/casos/{id}/comunicaciones` con el `contenido` generado y el header de secreto interno; vuelve a `Split In Batches` para continuar el loop.
- [x] 5.6 Verificado con skill `n8n-workflow`: **corrige** el patrón real de WF-01 (que en el JSON del repo todavía tiene `$env` embebido directo en el tool sub-node `obtener_contexto_caso`, el bug que la skill documenta). WF-05 usa un nodo `Set Internal Secret` en la cadena principal y todas las referencias — incluido el tool sub-node — leen `$('Set Internal Secret').first().json.*`, nunca `$env` directo. Sin secretos en texto plano (grep confirmado). **Validado end-to-end**: se importó el JSON contra una instancia real de n8n vía `POST /api/v1/workflows` (API REST, `N8N_API_KEY` de `.env`) → `200 OK`, 11 nodos aceptados sin errores de schema; se hizo `GET` de vuelta para confirmar y luego se borró el workflow de prueba (no se dejó activo ni se ejecutó con credenciales reales de OpenAI). **Pendiente de smoke test manual real**: disparar el Schedule Trigger (o "Execute Workflow") con el backend + OpenAI real corriendo, para confirmar el comportamiento en runtime del loop `Split In Batches` y la expresión `$('Split In Batches').item.json.caso_id` en `Preparar Persistencia`.

## 6. Frontend — cablear la revisión (`features/comunicaciones/`)

- [x] 6.1 `types.ts`: agregar `BorradorPendiente` (espejo de `BorradorPendienteResponse`) y `ComunicacionRevisada` (espejo de `ComunicacionPatchResponse`).
- [x] 6.2 `api.ts`: agregar `listarPendientes()` (`GET /comunicaciones?estado=PENDIENTE_REVISION`) y `revisarComunicacion(id, estado)` (`PATCH /comunicaciones/{id}`) usando `shared/http.ts`.
- [x] 6.3 `BatchPage.tsx`: reemplazar `ITEMS`/`DEFAULT_DRAFT` mock por la lista real de `listarPendientes()`; estados de carga/error/vacío; nombres de área/etapa desde el backend (no hardcodear — `AREA_BADGE` solo mapea el enum `AreaDerecho`, igual que `CasosPage.tsx`).
- [x] 6.4 `BatchPage.tsx`: Aprobar/Descartar cableados a `revisarComunicacion` + actualización local optimista (el item queda visible con check verde / X roja, sin desaparecer de la lista); "Copiar" con `navigator.clipboard` (+ `.catch` de seguridad); nota RN-10 conservada. **Verificado en vivo** con `docker compose up` + Playwright: login real, 4 borradores reales listados (3 preexistentes `MANUAL` + 1 sintético `ACTUALIZACION_AUTOMATICA`), Aprobar → `aprobado_por`/`aprobado_en` seteados en DB y contador "1/2 de N revisados" actualizado, Descartar → estado `DESCARTADO` sin `aprobado_por`. Datos de prueba limpiados al finalizar (no quedan cambios en la DB de desarrollo).

## 7. Docs (SDD) y trazabilidad

- [x] 7.1 `docs/changemap.md`: marcar RF-26 / UC-10 (y RF-26.1..4) como implementado (🔲 → ✅) con referencia al change `comunicaciones-2`; fila de changelog agregada.
- [x] 7.2 `docs/04-api/contratos-api.md`: precisado el schema de respuesta de `GET /comunicaciones` (cliente/area/etapa/preview/estado/generado_en), `POST /internal/casos/{id}/comunicaciones` (201) y `PATCH /comunicaciones/{id}` (200/403/404/409/422).

## 8. Tests y cierre

- [x] 8.1 Tests backend: cadencia (activo/terminal/idempotencia/<15d/≥15d/fecha_inicio NULL/ignora comunicación MANUAL), persistencia interna (201/404/409), listado por estado (con forma enriquecida), PATCH (aprobar/descartar/estado inválido 422/CSRF 403/404/409). **54/54 tests verdes, 98% cobertura en `app/features/comunicaciones/` (100% en `router.py`/`service.py`/`schemas.py`)**.
- [x] 8.2 Test/verificación de auth: `/internal/*` rechaza sin `X-Internal-Secret` (401) en los 2 endpoints nuevos; `GET /comunicaciones` sin sesión (401); `PATCH` sin CSRF (403) y sin cookie (401).
- [x] 8.3 Verificado (`test_aprobar_reinicia_ventana_de_cadencia` + smoke test manual en vivo): tras `APROBADO`, el mismo caso NO reaparece en pendientes hasta +15 días.
- [x] 8.4 **Nota al orquestador**: el change `dashboard` (in-progress) debe recortar de su alcance la capability `revision-comunicaciones` y las tasks §1, §3.1, §5.3, §5.5 (duplican `GET/PATCH /comunicaciones`, ya implementados acá) y pasar a **consumir** `comunicaciones/api.ts` (`listarPendientes`, `revisarComunicacion`) para su bloque "Mensajes listos para revisar". Ver detalle en `proposal.md` §Coordinación. Lint/format: backend con `black`/`isort`/`ruff --fix` aplicado y verificado (0 errores en los archivos tocados, tras corregir 2 bugs preexistentes en fixtures de test). Frontend: `tsc` sin errores en los archivos tocados; **no se pudo correr `eslint`** — no existe `eslint.config.js` en el repo (gap preexistente, fuera de alcance de este change).
