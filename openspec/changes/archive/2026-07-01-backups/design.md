## Context

La tabla `backup` y sus enums (`TipoBackup`: AUTOMATICO/MANUAL, `EstadoBackup`: OK/ERROR) ya están definidos en el esquema Alembic. El patrón de endpoint interno con `X-Internal-Secret` ya está implementado en `features/comunicaciones/`. El storage (MinIO dev / R2 prod) ya tiene su abstracción en `core/storage.py`. La UI (`RespaldosPage.tsx`) existe pero usa datos mock.

## Goals / Non-Goals

**Goals:**
- Endpoints `POST /backups`, `POST /internal/backups`, `GET /backups` con sus guards de seguridad.
- WF-02 en n8n: schedule diario + trigger manual → Postgres → Excel → storage → registro.
- RespaldosPage conectada a datos reales (listar + trigger manual).

**Non-Goals:**
- Notificación por email al completar el respaldo (mencionado en la arquitectura pero fuera del alcance MVP — no hay servicio de email configurado).
- Restauración de respaldos desde la UI.
- Respaldo incremental o diferencial.

## Decisions

### D1 — Flujo de respaldo manual: backend delega a n8n via webhook

`POST /backups` (SOCIO) no ejecuta el respaldo directamente. Llama al webhook de n8n (igual que WF-01) y devuelve 202 Accepted. n8n hace el trabajo y al finalizar llama a `POST /internal/backups` para registrar el resultado.

**Alternativa descartada:** ejecutar el respaldo directamente en el backend (consulta + Excel + upload) — infla el backend con lógica de orquestación que pertenece a n8n; además la solicitud HTTP tardaría demasiado.

### D2 — `POST /internal/backups` registra el resultado completo

n8n es el único que crea registros en la tabla `backup`. El endpoint interno recibe `tipo`, `estado`, `ubicacion` (URL/path del archivo en storage) y `fecha` (opcional, default `now()`). No hay estado intermedio PENDIENTE en el modelo (los enums solo tienen OK/ERROR).

### D3 — Generación de Excel en n8n con nodo "Spreadsheet File"

n8n tiene el nodo nativo "Spreadsheet File" (operación "Create from List") que puede generar un `.xlsx` a partir de datos JSON. El workflow extrae datos via nodo Postgres (casos + clientes) y los convierte a Excel sin dependencias externas.

**Alternativa descartada:** generar el Excel en el backend — innecesario dado que n8n lo soporta nativamente.

### D4 — Upload del Excel a storage via URL prefirmada del backend

El workflow llama a `POST /internal/storage/presigned-upload` (o reutiliza la lógica de `core/storage.py` expuesta via endpoint interno) para obtener una URL prefirmada, luego hace PUT del archivo Excel, y finalmente llama a `POST /internal/backups` con la ubicación. Si el storage no está disponible, registra el backup con `estado=ERROR` y `ubicacion=null`.

**Alternativa descartada:** que n8n acceda directamente a MinIO/R2 con credenciales propias — evitar duplicar configuración de credenciales de storage en n8n; mejor centralizar en el backend.

### D5 — Reutilizar `verify_internal_secret` de comunicaciones

La dependencia `verify_internal_secret` ya existe en `features/comunicaciones/dependencies.py`. Se importa directamente en el router de backups — no se duplica.

### D6 — `GET /backups` restringido a SOCIO

El historial de respaldos es información operacional sensible. Solo SOCIO puede consultarlo (RF-22). A diferencia de la lectura amplia de casos/clientes, esta restricción se aplica con `require_roles(SOCIO)`.

## Risks / Trade-offs

- **[Risk] n8n no disponible al disparar respaldo manual** → `POST /backups` devuelve 503 con mensaje claro. El respaldo no se registra como fallido (nunca llegó a n8n).
- **[Risk] Storage no disponible durante el respaldo** → n8n registra `estado=ERROR` via `POST /internal/backups`; el SOCIO lo ve en el historial.
- **[Trade-off] Sin estado PENDIENTE** → el historial no refleja backups en curso. Aceptable para MVP: el tiempo de ejecución es < 1 minuto y el SOCIO puede refrescar la página.
- **[Risk] Nodo Postgres de n8n requiere credenciales de DB** → credencial de Postgres configurada en n8n con los mismos valores que `DATABASE_URL`. Agregar a `.env.example` la variable `N8N_DB_*` si se usa configuración separada.
