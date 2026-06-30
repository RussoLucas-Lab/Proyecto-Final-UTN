# ADR-0010: Abstracción de storage S3-compatible — MinIO en dev, Cloudflare R2 en prod

**Estado:** Aceptada · **Fecha:** 2026-06

## Contexto

ADR-0007 estableció Cloudflare R2 como proveedor de object storage y boto3 como cliente S3 estándar. Dos features del MVP necesitan storage: `documentos` (RF-14/RF-15) y `backups` (RF-21). En desarrollo no existe cuenta R2 real, y replicar la configuración de boto3 en cada feature duplicaría código y variables de entorno.

## Decisión

Centralizar el cliente S3 en `backend/app/core/storage.py` como clase `StorageClient`, configurada exclusivamente por variables de entorno:

| Variable | Dev (MinIO) | Prod (R2) |
|----------|-------------|-----------|
| `STORAGE_ENDPOINT_URL` | `http://minio:9000` | `https://<account>.r2.cloudflarestorage.com` |
| `STORAGE_ACCESS_KEY` | `minioadmin` | R2 access key |
| `STORAGE_SECRET_KEY` | `minioadmin` | R2 secret key |
| `STORAGE_BUCKET_NAME` | `iuris-docs` | `iuris-docs` |
| `STORAGE_PUBLIC_URL` | `http://localhost:9000` | *(vacío o dominio R2 público)* |

En dev, **MinIO** corre en Docker Compose (imagen `minio/minio`). El contenedor `minio-init` (imagen `minio/mc`) crea el bucket `iuris-docs` con política privada al arrancar, de forma idempotente. El backend depende de `minio-init` con `condition: service_completed_successfully`.

`STORAGE_PUBLIC_URL` resuelve el problema de que boto3 genera URLs prefirmadas con el hostname interno del contenedor (`minio:9000`), que el navegador no puede resolver. Si está definida, `StorageClient.generate_presigned_url` reemplaza el hostname interno antes de devolver la URL al frontend.

## Consecuencias

- (+) Zero cambios de código al pasar de MinIO a R2: solo variables de entorno.
- (+) Un único punto de configuración en `core/`; features `documentos` y `backups` lo consumen vía `Depends(get_storage_client)`.
- (+) MinIO es 100% local, sin registros externos ni costos.
- (−) `minio-init` agrega un contenedor extra al compose (mínimo, imagen liviana).
- (−) En prod la URL prefirmada contiene el dominio R2 directamente; `STORAGE_PUBLIC_URL` debe dejarse vacío o configurarse correctamente.
