## Why

El estudio necesita asociar archivos (DNI, bonos de sueldo, historias clínicas, actas notariales) a cada caso. Hoy esa capacidad no existe: los abogados trabajan con archivos por fuera de la plataforma, sin trazabilidad ni acceso centralizado. La infraestructura de storage (MinIO dev / R2 prod) ya está en producción desde el change `storage-infra`; este change implementa la capa funcional sobre ella.

## What Changes

- **Migración de base de datos**: tabla `documento` (caso_id, object_key, nombre_archivo, categoría, formato, subido_por, subido_en).
- **Backend — feature `documentos`**: router, schemas, service con 4 endpoints:
  - `POST /casos/{id}/documentos:init` — valida rol, genera URL prefirmada de subida (PUT S3); devuelve `upload_url` + `object_key`.
  - `POST /casos/{id}/documentos` — registra metadata en BD tras la subida directa al storage.
  - `GET /casos/{id}/documentos` — lista metadata de documentos del caso.
  - `GET /documentos/{id}/url` — genera URL prefirmada de descarga (GET S3).
- **Frontend — feature `documentos`**: panel en la página de detalle de caso con drag&drop uploader y lista de documentos con botón de descarga/preview.
- Los formatos permitidos son PDF, DOC/DOCX e imagen (JPG/PNG); otros → 415.
- Solo el abogado sube (RN-12); la lectura es accesible a todo usuario autenticado (RN-08).

## Capabilities

### New Capabilities

- `gestion-documentos`: Subida de archivos por drag&drop (flujo init→PUT directo al storage→registrar), listado y descarga de documentos por caso mediante URLs prefirmadas.

### Modified Capabilities

_(ninguna — el contrato API ya está documentado en `contratos-api.md`; no hay cambio de spec existente)_

## Impact

- **Backend**: nuevo módulo `backend/app/features/documentos/` (router, schemas, service, migration `003_documento.sql`). Depende de `StorageClient` (`backend/app/core/storage.py`).
- **Frontend**: nuevos componentes `DocumentUploader` y `DocumentList` integrados en `CasoDetallePage`.
- **Base de datos**: 1 migración SQL nueva; sin cambios en tablas existentes.
- **Dependencias**: `boto3` ya en `requirements.txt` (storage-infra). Sin dependencias frontend nuevas.
- **Infraestructura**: usa MinIO en dev y R2 en prod tal como lo define `storage-s3/spec.md`; sin cambios en `docker-compose.yml`.
