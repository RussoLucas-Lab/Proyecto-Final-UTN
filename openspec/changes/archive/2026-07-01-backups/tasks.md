## 1. Backend — Feature backups

- [x] 1.1 Crear `backend/app/features/backups/schemas.py`: `BackupResponse` (`id`, `fecha`, `tipo: TipoBackup`, `estado: EstadoBackup`, `ubicacion: str | None`), `BackupRegistrarRequest` (`tipo: TipoBackup`, `estado: EstadoBackup`, `ubicacion: str | None`, `fecha: datetime | None`), `BackupTriggerResponse` (`mensaje: str`).
- [x] 1.2 Crear `backend/app/features/backups/service.py`: `registrar_backup(db, data) -> Backup` (crea registro con los datos de n8n, `fecha` default `now()` si no viene), `listar_backups(db) -> list[Backup]` (orden `fecha` DESC), `trigger_backup_manual(n8n_webhook_url, internal_secret) -> None` (HTTP POST al webhook de WF-02; lanza `BackupN8nNoDisponible` si falla).
- [x] 1.3 Crear `backend/app/features/backups/router.py` con 3 endpoints:
  - `GET /backups` — `require_roles(SOCIO)`, rate 100/min → `listar_backups`, 200 `list[BackupResponse]`, 401/403.
  - `POST /backups` — `require_roles(SOCIO)`, CSRF, rate 20/min → `trigger_backup_manual`; 202 `BackupTriggerResponse`, 401/403, 503 si n8n no responde.
  - `POST /internal/backups` — `Depends(verify_internal_secret)` (importar de `features/comunicaciones/dependencies.py`), sin CSRF/RBAC; 201 `BackupResponse`, 401/422.
- [x] 1.4 Registrar `backups_router` en `backend/app/main.py` con prefijo `/api/v1`. Agregar `N8N_WF02_WEBHOOK_URL` a `backend/app/core/config.py` (junto a `N8N_WF01_WEBHOOK_URL`).
- [x] 1.5 Verificar `seguridad-endpoint`: `GET /backups` y `POST /backups` requieren SOCIO + cookie JWT; `POST /backups` requiere CSRF; `POST /internal/backups` solo `X-Internal-Secret`, sin cookie/CSRF/RBAC. Ningún endpoint devuelve datos sensibles de clientes.

## 2. Backend — Tests

- [x] 2.1 Crear `backend/tests/features/backups/__init__.py` y `conftest.py`: fixtures `usuario_socio`, `usuario_abogado`, `backup_ok`, `backup_error`, `client` (con CSRF), `client_socio`, `client_abogado`.
- [x] 2.2 `test_router.py` — `GET /backups`: 200 lista (SOCIO), 200 vacía, 403 ABOGADO, 401 sin auth.
- [x] 2.3 `test_router.py` — `POST /backups`: mock del webhook de n8n (httpx mock o monkeypatch de `trigger_backup_manual`); 202 ok (SOCIO + CSRF), 503 si n8n falla, 403 ABOGADO, 403 sin CSRF, 401 sin auth.
- [x] 2.4 `test_router.py` — `POST /internal/backups`: 201 con tipo/estado/ubicacion, 201 con ubicacion null, 401 sin secreto, 422 payload inválido.

## 3. n8n — Workflow WF-02

- [x] 3.1 Crear `n8n/workflows/WF-02-respaldo-automatico.json` con los nodos en orden:
  - **Schedule Trigger**: diario 03:00 `America/Argentina/Buenos_Aires`.
  - **Webhook** (trigger manual): recibe POST desde `POST /backups` del backend.
  - **Merge**: combina ambos triggers en un flujo único.
  - **Postgres** (credencial n8n): extrae casos y clientes activos con una query SQL simple.
  - **Spreadsheet File** (Create): genera Excel con los datos extraídos.
  - **HTTP Request** (GET presigned URL): llama a un endpoint interno del backend para obtener URL prefirmada de upload.
  - **HTTP Request** (PUT storage): sube el Excel a MinIO/R2 con la URL prefirmada.
  - **HTTP Request** (POST internal/backups OK): llama `POST /internal/backups` con `estado=OK` y la ubicación.
  - **Error Handler** (IF/nodo de error): si algún nodo falla, llama `POST /internal/backups` con `estado=ERROR`.
- [x] 3.2 Verificar que el JSON no contiene secretos en texto plano: `N8N_INTERNAL_SECRET` se referencia como `{{ $env.N8N_INTERNAL_SECRET }}` o credencial de n8n; credencial Postgres configurada como credencial de n8n (no URL hardcodeada).
- [x] 3.3 Agregar `N8N_WF02_WEBHOOK_URL` a `.env.example` (URL del webhook de WF-02 en n8n, p. ej. `http://n8n:5678/webhook/wf02-backup`).

## 4. Backend — Endpoint presigned URL para n8n (si no existe)

- [x] 4.1 Verificar si ya existe `POST /internal/storage/presigned-upload` o similar en `features/documentos/` o `core/`. Si no existe, agregar `GET /internal/storage/presigned-upload?filename=<name>` con `verify_internal_secret` que llame a `core/storage.py` y devuelva la URL prefirmada para PUT. Esto permite que n8n suba el Excel a storage sin necesitar credenciales propias de MinIO/R2.

## 5. Frontend — Conectar RespaldosPage

- [x] 5.1 Crear `frontend/src/features/respaldos/types.ts`: tipo `Respaldo` (`id`, `fecha`, `tipo: 'AUTOMATICO' | 'MANUAL'`, `estado: 'OK' | 'ERROR'`, `ubicacion: string | null`).
- [x] 5.2 Crear `frontend/src/features/respaldos/api.ts`: `listarRespaldos()` → `GET /backups`; `triggerRespaldoManual()` → `POST /backups` (con CSRF).
- [x] 5.3 Crear `frontend/src/features/respaldos/hooks/useRespaldos.ts`: llama a `listarRespaldos()`, expone `respaldos`, `loading`, `error`.
- [x] 5.4 Actualizar `frontend/src/features/respaldos/RespaldosPage.tsx`: reemplazar `mockBackups` con `useRespaldos()`; conectar botón "Respaldo manual" a `triggerRespaldoManual()`; mostrar estados de carga y error; mapear `tipo`/`estado` a los labels de la UI (AUTOMATICO → "Automático", OK → "OK", etc.).

## 6. Documentación

- [x] 6.1 `docs/changemap.md`: marcar RF-21 y RF-22 como ✅ con referencia al change `backups`; agregar entrada al changelog.
- [x] 6.2 `docs/04-api/contratos-api.md`: agregar sección Backups con contratos de `GET /backups` (200 `list[BackupResponse]`), `POST /backups` (202 / 403 / 503), `POST /internal/backups` (201 / 401 / 422) y schema `BackupResponse`.
