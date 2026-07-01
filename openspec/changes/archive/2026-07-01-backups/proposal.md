## Why

El estudio necesita respaldos periódicos de sus datos para cumplir con el objetivo de disponibilidad (RNF-08) y la trazabilidad de operaciones (RNF-03, RN-13). El modelo ORM y los enums ya existen en el esquema; faltan el backend operativo (endpoints + servicio), el workflow n8n WF-02 y la conexión del frontend que hoy usa datos mock.

## What Changes

- `POST /backups` (SOCIO): el abogado principal dispara un respaldo manual desde la interfaz; el backend registra la intención y delega la ejecución a n8n via webhook.
- `POST /internal/backups` (X-Internal-Secret): n8n llama este endpoint al terminar un respaldo (automático o manual) para registrar fecha, tipo, estado y ubicación del archivo generado.
- `GET /backups` (SOCIO): historial de respaldos con fecha, tipo (`AUTOMATICO`/`MANUAL`), estado (`OK`/`ERROR`) y ubicación.
- **WF-02** en n8n: Schedule Trigger diario + webhook de trigger manual → extrae datos via Postgres node → genera Excel → sube archivo a MinIO/R2 → llama `POST /internal/backups`.
- `frontend/src/features/respaldos/RespaldosPage.tsx`: reemplazar mock con datos reales de `GET /backups` y conectar botón "Respaldo manual" a `POST /backups`.

## Capabilities

### New Capabilities
- `gestion-respaldos`: historial de respaldos (consulta y registro), trigger manual desde la UI, y workflow WF-02 que ejecuta el respaldo automático y manual orquestado por n8n.

### Modified Capabilities
<!-- ninguna: no hay specs de backups existentes -->

## Impact

- **Backend**: nueva feature `features/backups/` con `schemas.py`, `service.py`, `router.py`. El modelo y enums ya existen (`models.py`, `shared/enums.py`). El patrón de `verify_internal_secret` se reutiliza de `features/comunicaciones/dependencies.py`.
- **n8n**: nuevo workflow `n8n/workflows/WF-02-respaldo-automatico.json`. Usa nodo Postgres para extraer datos, "Spreadsheet File" para generar Excel, HTTP Request para subir a storage y registrar el resultado. Secretos gestionados como credenciales/variables de n8n (nunca hardcodeados en el JSON).
- **Frontend**: `frontend/src/features/respaldos/` — agregar `types.ts`, `api.ts`, hook `useRespaldos`; conectar `RespaldosPage.tsx` a la API real.
- **Sin n8n desde el navegador**: el frontend llama a `POST /backups` (backend); es el backend quien dispara n8n.
