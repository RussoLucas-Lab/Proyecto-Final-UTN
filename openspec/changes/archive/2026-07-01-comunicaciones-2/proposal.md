## Why

El estudio actualiza a cada cliente **cada 15 días** sobre el estado de su caso. Hoy ese mensaje lo redacta a mano un abogado administrativo: 5-10 minutos por caso, la mayor parte buscando información dispersa (Relevamiento §5). El change `comunicaciones` (archivado) ya resolvió el flujo **individual** (WF-01: "Generar actualización" a pedido), pero dejó explícitamente **fuera de alcance** el batch programado. Esta propuesta implementa RF-26 — **Batch de actualizaciones cada 15 días (WF-05 / UC-10)**: detectar a diario los casos que "vencen", generar un borrador por caso con el agente de n8n, persistirlos como `PENDIENTE_REVISION` y ofrecerlos en el dashboard listos para revisar y aprobar. Como toda comunicación, **nada se envía solo** (RN-10).

## What Changes

- **Backend — detección de pendientes (cadencia en el backend)**: nuevo `GET /internal/casos/pendientes-actualizacion` (interno, `verify_internal_secret`). El backend calcula los `caso_id` que vencen hoy combinando: caso **activo** = etapa NO terminal (`Etapa.es_terminal`, RN-20), **cadencia ≥15 días** desde la última `comunicacion` automática `APROBADO` o desde `caso.fecha_inicio` si nunca hubo (RN-21), e **idempotencia** = no si ya existe un borrador automático `PENDIENTE_REVISION` para el caso (RN-22). La cadencia vive en el backend, no en n8n.
- **Backend — persistencia del borrador**: nuevo `POST /internal/casos/{id}/comunicaciones` (interno, `verify_internal_secret`). Persiste un borrador `tipo=ACTUALIZACION_AUTOMATICA`, `estado=PENDIENTE_REVISION`. No dispara ningún envío (RN-19).
- **Backend — listado para revisión**: nuevo `GET /comunicaciones?estado=PENDIENTE_REVISION` (usuario: cookie JWT + RBAC). Devuelve, por borrador, los datos de revisión (id, cliente, área, etapa, preview del contenido, estado, `generado_en`), resolviendo `Comunicacion → Caso → Cliente/Etapa`.
- **Backend — revisión del borrador**: nuevo `PATCH /comunicaciones/{id}` (usuario). Aprueba (`APROBADO`) o descarta (`DESCARTADO`); registra `aprobado_por`/`aprobado_en`. Aprobar mueve la "última actualización" y **reinicia la ventana de 15 días** (insumo directo de la cadencia RN-21). No envía nada (RN-10/RN-19).
- **n8n — WF-05**: nuevo workflow `n8n/workflows/WF-05-batch-actualizaciones.json`. Schedule Trigger diario → `GET /internal/casos/pendientes-actualizacion` → IF/Split In Batches → **AI Agent (el MISMO de WF-01**, OpenAI Chat Model + herramienta `obtener_contexto_caso`) → `POST /internal/casos/{id}/comunicaciones`. Secretos como credenciales/variables de n8n, nunca hardcodeados (RN-23: sin plazos ni montos, lenguaje simple).
- **Frontend — revisión del batch**: cablear la pantalla de revisión existente `frontend/src/features/comunicaciones/BatchPage.tsx` (hoy con datos mock) a los endpoints reales (listar / aprobar / descartar / editar / copiar), reutilizando `EditorBorrador`. Extender `comunicaciones/api.ts` y `types.ts`.
- **Docs / trazabilidad**: marcar RF-26 (y RF-26.1..4) como implementados en `docs/changemap.md`; precisar en `docs/04-api/contratos-api.md` el schema de respuesta de `GET /comunicaciones` y del `PATCH`.

## Capabilities

### New Capabilities
- `batch-actualizaciones`: el batch programado de WF-05 — cómo el backend detecta a diario los casos "pendientes de actualización" (activo + cadencia 15 días + idempotencia), cómo persiste los borradores automáticos vía endpoints internos, y cómo n8n orquesta la generación con IA. Cubre RF-26.1, RF-26.2, RF-26.3, RN-19..23.
- `revision-comunicaciones`: los endpoints de usuario para **listar** borradores por estado y **aprobar/descartar** un borrador ya generado, más la UI de revisión (revisar/editar/aprobar/descartar/copiar). Aprobar reinicia la ventana de cadencia. Cubre RF-26.4 y RN-19.

### Modified Capabilities
<!-- Sin cambios de requisitos en specs existentes. `comunicaciones-asistidas` (flujo individual WF-01) queda intacta; este change agrega el flujo batch y la revisión sobre la MISMA tabla `comunicacion` y el MISMO agente n8n, sin alterar el esquema ni la migración 001. -->

## Impact

- **Backend** (feature existente `comunicaciones`, sin carpetas nuevas): `router.py` (+4 endpoints), `service.py` (cadencia, persistencia interna, listado, revisión), `schemas.py` (payloads de listado/persistencia/patch), `dependencies.py` (reutiliza `verify_internal_secret` y `get_caso_o_404`). Reutiliza el patrón de seguridad ya presente (JWT cookie + RBAC ABOGADO/SOCIO + CSRF en mutaciones + rate limit para los de usuario; secreto compartido para los `/internal/*`).
- **Sin migración de DB**: el modelo `Comunicacion` y los enums `TipoComunicacion.ACTUALIZACION_AUTOMATICA` y `EstadoComunicacion.PENDIENTE_REVISION/APROBADO/DESCARTADO` ya existen (migración `001` head). `Etapa.es_terminal` y `Caso.fecha_inicio` ya existen. **Verificado: no se requiere revisión Alembic nueva.**
- **n8n**: nuevo `n8n/workflows/WF-05-batch-actualizaciones.json`. Reutiliza la credencial OpenAI y el `N8N_INTERNAL_SECRET` ya usados por WF-01; ninguna clave nueva.
- **Frontend** (feature existente `comunicaciones`): `BatchPage.tsx` (de mock a datos reales), `api.ts` (+ `listarPendientes`, `revisarComunicacion`), `types.ts`. Reutiliza `shared/http.ts` y `components/EditorBorrador.tsx`.
- **Docs**: `docs/changemap.md` (fila RF-26/UC-10), `docs/04-api/contratos-api.md` (schemas de `GET /comunicaciones` y `PATCH`).

### Coordinación con el change `dashboard` (in-progress) — deslinde de alcance
El change **`dashboard`** (in-progress, 0/27 tareas, aún sin código) reclama en su proposal una capability `revision-comunicaciones` e implementa en sus tasks §1.1-1.6 los MISMOS endpoints `GET /comunicaciones` y `PATCH /comunicaciones/{id}`, y los consume en §5.3/§5.5. **Hay solapamiento directo.**

**Decisión de deslinde:**
- **`comunicaciones-2` es dueño de** los endpoints `GET /comunicaciones` + `PATCH /comunicaciones/{id}` y de la UI de revisión/aprobación de borradores (capability `revision-comunicaciones`), además del batch (`batch-actualizaciones`). Motivo: la lógica de **aprobar** está acoplada a la cadencia RN-21 (aprobar reinicia la ventana de 15 días), que pertenece a esta feature; y ambos changes tocarían los mismos `comunicaciones/{router,service,schemas}.py`, por lo que un solo dueño evita conflictos.
- **`dashboard` NO reescribe** estos endpoints ni la lógica de revisión: conserva solo `panel-inicio` (métricas reales por área, endpoint de métricas, y el refactor vertical-slice de `DashboardPage.tsx`) y **consume** los endpoints/`api.ts` que provee `comunicaciones-2` para su bloque "Mensajes listos para revisar".
- **Orden / dependencia**: `comunicaciones-2` aterriza primero (provee endpoints + UI de revisión en la feature `comunicaciones`); `dashboard` rebasa y recorta de su alcance la capability `revision-comunicaciones` y las tasks §1, §3.1, §5.3, §5.5. Esta poda del change `dashboard` queda como acción para el orquestador (ver Open Questions en design.md).
