## Why

El change `documentos` (RF-14/RF-15) y el de `backups` (RF-21) ambos necesitan subir y descargar archivos de un object storage S3-compatible (Cloudflare R2 en prod). Sin una abstracción compartida, cada feature duplicaría la configuración de boto3 y la lógica de URLs prefirmadas. Además, en dev/test no existe R2 real — se necesita MinIO local corriendo en Docker Compose para poder implementar y verificar esas features sin cuenta de producción.

## What Changes

- Se agrega **MinIO** como servicio en `docker-compose.yml` (bucket `iuris-docs` creado automáticamente al iniciar vía `mc mb`).
- Se crea `backend/app/core/storage.py`: cliente boto3 configurado por env vars (`STORAGE_ENDPOINT_URL`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`, `STORAGE_BUCKET_NAME`). Misma interfaz para MinIO (dev) y R2 (prod); solo cambia la configuración inyectada.
- Se documenta el conjunto de variables de entorno de storage en `.env.example`.
- Se crea ADR-0010 formalizando la decisión de abstracción MinIO/R2.
- Se actualiza `docker-compose.yml` con el servicio `minio` y el inicializador `minio-init`.

## Capabilities

### New Capabilities
- `storage-s3`: Abstracción S3-compatible (boto3) para upload/download de archivos. Expone `get_storage_client()` y helper `generate_presigned_url()`. Configurable vía env vars; MinIO en dev, R2 en prod. Consumida por `documentos` y `backups`.

### Modified Capabilities
- *(ninguna — no cambia ninguna spec existente)*

## Impact

- **`docker-compose.yml`**: nuevo servicio `minio` (puerto 9000/9001) + `minio-init` (crea bucket y política).
- **`backend/app/core/storage.py`**: módulo nuevo, sin dependencias de features existentes.
- **`backend/requirements.txt`**: agrega `boto3`.
- **`.env.example`**: agrega 4 variables (`STORAGE_ENDPOINT_URL`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`, `STORAGE_BUCKET_NAME`).
- **`docs/05-decisiones/adr/0010-storage-abstraction.md`**: ADR nuevo.
- No toca ningún endpoint de API ni modelo de datos existente.
