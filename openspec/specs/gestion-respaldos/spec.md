### Requirement: Historial de respaldos (SOCIO)

El sistema SHALL exponer `GET /backups` restringido a usuarios con rol `SOCIO`, que devuelva la lista de respaldos registrados ordenados por fecha descendente. Cada entrada SHALL incluir `id`, `fecha`, `tipo` (`AUTOMATICO`/`MANUAL`), `estado` (`OK`/`ERROR`) y `ubicacion` (URL o path del archivo generado, puede ser nulo si el respaldo falló).

#### Scenario: SOCIO consulta el historial
- **WHEN** un usuario SOCIO hace `GET /backups`
- **THEN** el sistema responde 200 con la lista de respaldos ordenados por fecha descendente

#### Scenario: Lista vacía cuando no hay respaldos
- **WHEN** nunca se ejecutó un respaldo y un SOCIO consulta el historial
- **THEN** el sistema responde 200 con una lista vacía

#### Scenario: Usuario sin rol SOCIO es rechazado
- **WHEN** un usuario ABOGADO o sin sesión intenta `GET /backups`
- **THEN** el sistema responde 403 o 401 respectivamente

### Requirement: Trigger de respaldo manual (SOCIO)

El sistema SHALL exponer `POST /backups` restringido a usuarios con rol `SOCIO`, con protección CSRF y rate limiting, que dispare la ejecución de un respaldo manual delegando a n8n via webhook. El endpoint SHALL responder 202 Accepted inmediatamente (el respaldo se ejecuta de forma asíncrona). Si n8n no está disponible, SHALL responder 503.

#### Scenario: SOCIO dispara respaldo manual
- **WHEN** un usuario SOCIO hace `POST /backups` con CSRF válido
- **THEN** el sistema llama al webhook de n8n y responde 202; n8n ejecuta el respaldo en background

#### Scenario: n8n no disponible
- **WHEN** n8n no responde al webhook durante el trigger manual
- **THEN** el sistema responde 503 con mensaje de error; no se registra ningún backup en la DB

#### Scenario: Usuario sin rol SOCIO es rechazado
- **WHEN** un usuario ABOGADO intenta `POST /backups`
- **THEN** el sistema responde 403

#### Scenario: Sin CSRF es rechazado
- **WHEN** se hace `POST /backups` sin el header `X-CSRF-Token` válido
- **THEN** el sistema responde 403

### Requirement: Registro de resultado de respaldo por n8n (endpoint interno)

El sistema SHALL exponer `POST /internal/backups`, protegido por `X-Internal-Secret`, que permita a n8n registrar el resultado de un respaldo completado (automático o manual). El endpoint SHALL crear un registro `Backup` con `tipo`, `estado`, `ubicacion` (puede ser nulo) y `fecha` (default `now()`). Sin CSRF ni cookies — autenticación exclusivamente por secreto interno.

#### Scenario: n8n registra respaldo exitoso
- **WHEN** n8n llama a `POST /internal/backups` con secreto válido, `tipo=AUTOMATICO`, `estado=OK` y `ubicacion` del archivo
- **THEN** el sistema crea el registro y responde 201 con el `BackupResponse`

#### Scenario: n8n registra respaldo fallido
- **WHEN** n8n llama a `POST /internal/backups` con `estado=ERROR` y `ubicacion=null`
- **THEN** el sistema crea el registro con `estado=ERROR` y responde 201

#### Scenario: Sin secreto interno se rechaza
- **WHEN** se llama a `POST /internal/backups` sin `X-Internal-Secret` válido
- **THEN** el sistema responde 401 y no crea ningún registro

### Requirement: Workflow WF-02 ejecuta el respaldo automático y manual

El sistema SHALL incluir un workflow n8n `WF-02` que se dispara por **Schedule Trigger diario** (hora configurable, default 03:00 `America/Argentina/Buenos_Aires`) Y por **Webhook** (para trigger manual desde `POST /backups`). El workflow SHALL: (1) extraer datos de casos y clientes via nodo Postgres; (2) generar un archivo Excel con el nodo "Spreadsheet File"; (3) subir el archivo a storage (MinIO/R2) via URL prefirmada obtenida del backend; (4) llamar a `POST /internal/backups` con el resultado. Los secretos (`N8N_INTERNAL_SECRET`, credencial Postgres) SHALL gestionarse como credenciales/variables de n8n, nunca hardcodeados en el JSON del workflow (RN-13).

#### Scenario: Ejecución automática diaria
- **WHEN** el Schedule Trigger de WF-02 se dispara a las 03:00
- **THEN** el workflow extrae datos, genera Excel, sube a storage y registra el backup con `tipo=AUTOMATICO` y `estado=OK`

#### Scenario: Ejecución manual desde la UI
- **WHEN** el SOCIO dispara `POST /backups` desde la interfaz y n8n recibe el webhook
- **THEN** el workflow ejecuta el mismo flujo y registra el backup con `tipo=MANUAL`

#### Scenario: Error durante el respaldo
- **WHEN** el nodo Postgres o la subida a storage falla durante WF-02
- **THEN** el workflow llama a `POST /internal/backups` con `estado=ERROR` para dejar trazabilidad

#### Scenario: Ningún secreto embebido en el JSON del workflow
- **WHEN** se revisa `n8n/workflows/WF-02-respaldo-automatico.json`
- **THEN** no contiene el valor de `N8N_INTERNAL_SECRET` ni credenciales de Postgres en texto plano

### Requirement: Pantalla de respaldos conectada a datos reales

La pantalla de respaldos (`RespaldosPage.tsx`) SHALL mostrar el historial real de `GET /backups` reemplazando los datos mock actuales. SHALL mostrar estados de carga y error. El botón "Respaldo manual" SHALL llamar a `POST /backups` y mostrar confirmación o error al usuario. La pantalla es accesible únicamente para usuarios con rol SOCIO.

#### Scenario: SOCIO ve el historial real
- **WHEN** un SOCIO abre la pantalla de respaldos
- **THEN** la lista proviene de `GET /backups` y no de datos hardcodeados

#### Scenario: Botón de respaldo manual
- **WHEN** el SOCIO presiona "Respaldo manual" y el backend responde 202
- **THEN** la interfaz muestra confirmación de que el respaldo fue iniciado

#### Scenario: Error al disparar respaldo
- **WHEN** el backend responde 503 al trigger manual
- **THEN** la interfaz muestra un mensaje de error claro
