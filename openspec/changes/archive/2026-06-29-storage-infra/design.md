## Context

ADR-0007 establece que el backend programa contra la API S3 estándar (boto3) para mantener portabilidad. Cloudflare R2 es el proveedor de producción. En dev/test no existe cuenta R2 — se necesita un backend S3-compatible local. MinIO expone exactamente la misma API S3 que R2 y puede correr en Docker Compose sin configuración externa.

Dos features del MVP consumen storage: `documentos` (RF-14/RF-15) y `backups` (RF-21). Centralizar el cliente en `core/` evita duplicar la configuración de boto3 en cada feature.

## Goals / Non-Goals

**Goals:**
- Un único `StorageClient` en `core/storage.py` utilizable por cualquier feature.
- MinIO corriendo en Docker Compose en dev, con bucket `iuris-docs` creado automáticamente.
- Zero cambios de código al pasar de MinIO a R2: solo variables de entorno.
- ADR-0010 que formaliza la decisión.

**Non-Goals:**
- Implementar endpoints de upload/download (eso es el change `documentos`).
- Implementar la lógica de backup (eso es el change `backups`).
- Soporte para múltiples buckets simultáneos en el MVP.
- Acceso directo del frontend a MinIO/R2 (siempre mediado por el backend).

## Decisions

### D-1: MinIO como backend S3-compatible en dev

**Decisión:** Agregar `minio` como servicio en `docker-compose.yml`, con `minio-init` como contenedor inicializador que crea el bucket y establece la política.

**Alternativa descartada:** Mock/stub en tests unitarios. Descartado porque las features necesitan verificar la generación real de URLs prefirmadas y la autenticación S3; un mock no ejercita eso.

**Por qué MinIO:** Imagen oficial Docker, API S3 idéntica a R2 (incluye presigned URLs), sin registro externo, sin costo.

### D-2: Cliente boto3 configurado exclusivamente por env vars

**Decisión:** `core/storage.py` expone `get_storage_client() -> StorageClient` que lee 4 variables de entorno:

| Variable | Dev (MinIO) | Prod (R2) |
|----------|-------------|-----------|
| `STORAGE_ENDPOINT_URL` | `http://minio:9000` | `https://<account>.r2.cloudflarestorage.com` |
| `STORAGE_ACCESS_KEY` | `minioadmin` | R2 access key |
| `STORAGE_SECRET_KEY` | `minioadmin` | R2 secret key |
| `STORAGE_BUCKET_NAME` | `iuris-docs` | `iuris-docs` |

El cliente es una instancia de `boto3.client("s3", ...)` envuelta en una clase `StorageClient` que expone `generate_presigned_url(operation, key, expires_in)`. No se redefine la lógica de presigned URLs — se delega a boto3.

### D-3: Bucket creado por `minio-init` al levantar Docker Compose

**Decisión:** Contenedor `minio-init` (imagen `minio/mc`) que espera a que MinIO esté listo y ejecuta:
```
mc alias set local http://minio:9000 $ACCESS_KEY $SECRET_KEY
mc mb --ignore-existing local/iuris-docs
mc anonymous set none local/iuris-docs
```
`depends_on: minio` con `condition: service_healthy`. El backend depende de `minio-init` con `condition: service_completed_successfully`.

**Por qué no scripts en entrypoint.sh del backend:** El backend no debe asumir que tiene credenciales de admin de MinIO; solo necesita credenciales de cliente para operar el bucket ya existente.

### D-4: Inyección por dependencia en FastAPI

**Decisión:** `get_storage_client()` se usa como dependencia FastAPI (`Depends(get_storage_client)`) en los routers que lo necesiten. No es singleton global para facilitar el mock en tests.

## Risks / Trade-offs

- **Race condition minio-init:** Si MinIO tarda en arrancar, `minio-init` puede fallar. Mitigación: `healthcheck` en el servicio `minio` (HTTP GET `/minio/health/live`) con reintentos antes de que `minio-init` ejecute.
- **Presigned URLs en dev apuntan a `minio:9000` (hostname interno):** El frontend no puede resolver ese hostname. Mitigación documentada en `storage-s3` spec: el backend debe reemplazar el hostname interno por `localhost:9000` en las URLs prefirmadas devueltas al cliente en entorno dev (variable `STORAGE_PUBLIC_URL`).
- **Windows / WSL2 con Docker:** Los volúmenes de MinIO pueden tener latencia en NTFS. No es bloqueante para el MVP (datos de test, no producción).

## Migration Plan

1. Agregar `minio` y `minio-init` a `docker-compose.yml`.
2. Agregar `boto3` a `requirements.txt`.
3. Crear `backend/app/core/storage.py`.
4. Agregar variables al `.env.example` (dev defaults incluidos).
5. Crear `docs/05-decisiones/adr/0010-storage-abstraction.md`.
6. `docker compose up --build` — verificar que MinIO inicia y bucket existe.

Rollback: eliminar el servicio `minio` y `minio-init` de docker-compose, remover `core/storage.py`. Sin impacto en DB ni en features existentes.

## Open Questions

*(ninguna — alcance acotado y decisiones ya confirmadas por el usuario)*
