## 1. Docker Compose — MinIO

- [x] 1.1 Agregar servicio `minio` a `docker-compose.yml` (imagen `minio/minio`, puerto 9000/9001, volumen `minio_data`, healthcheck HTTP GET `/minio/health/live`)
- [x] 1.2 Agregar servicio `minio-init` a `docker-compose.yml` (imagen `minio/mc`, `depends_on: minio: condition: service_healthy`; crea alias, bucket `iuris-docs` con `--ignore-existing`, política privada)
- [x] 1.3 Agregar `minio_data` a la sección `volumes:` de `docker-compose.yml`
- [x] 1.4 Agregar `depends_on: minio-init: condition: service_completed_successfully` al servicio `backend`

## 2. Variables de entorno

- [x] 2.1 Agregar al `.env.example` las 5 variables con sus valores dev: `STORAGE_ENDPOINT_URL=http://minio:9000`, `STORAGE_ACCESS_KEY=minioadmin`, `STORAGE_SECRET_KEY=minioadmin`, `STORAGE_BUCKET_NAME=iuris-docs`, `STORAGE_PUBLIC_URL=http://localhost:9000`

## 3. Dependencia boto3

- [x] 3.1 Agregar `boto3` a `backend/requirements.txt`

## 4. Módulo `core/storage.py`

- [x] 4.1 Crear `backend/app/core/storage.py` con clase `StorageClient` que en `__init__` inicializa `boto3.client("s3", endpoint_url=..., aws_access_key_id=..., aws_secret_access_key=..., region_name="auto")`
- [x] 4.2 Implementar `StorageClient.generate_presigned_url(operation, key, expires_in) -> str` que llama a `boto3.generate_presigned_url` y reemplaza el hostname interno por `STORAGE_PUBLIC_URL` si está definido
- [x] 4.3 Implementar `get_storage_client() -> StorageClient` como función de dependencia FastAPI (lee env vars, retorna instancia)

## 5. ADR-0010

- [x] 5.1 Crear `docs/05-decisiones/adr/0010-storage-abstraction.md` documentando la decisión de abstracción MinIO/R2 con boto3, las variables de entorno y el patrón de reemplazo de hostname

## 6. Verificación

- [ ] 6.1 `docker compose up --build` — verificar que MinIO inicia en `:9001` (consola web), bucket `iuris-docs` existe, `minio-init` completa con exit 0
- [ ] 6.2 Verificar que el backend arranca sin errores después de `minio-init`
- [x] 6.3 Escribir test unitario en `backend/tests/core/test_storage.py`: `get_storage_client()` retorna `StorageClient`, `generate_presigned_url` sustituye hostname cuando `STORAGE_PUBLIC_URL` está definido

## 7. Documentación del changemap

- [x] 7.1 Actualizar `docs/changemap.md`: agregar fila para `storage-infra` en la sección Plataforma/Infraestructura con estado ✅ y referencia al ADR-0010
