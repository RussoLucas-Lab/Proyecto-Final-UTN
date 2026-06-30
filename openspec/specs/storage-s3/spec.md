## ADDED Requirements

### Requirement: Cliente S3 configurable por entorno
El sistema SHALL proveer un `StorageClient` en `backend/app/core/storage.py` configurado exclusivamente mediante variables de entorno (`STORAGE_ENDPOINT_URL`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`, `STORAGE_BUCKET_NAME`). El código de las features NO SHALL contener credenciales ni URLs de storage hardcodeadas.

#### Scenario: Cliente apunta a MinIO en dev
- **WHEN** `STORAGE_ENDPOINT_URL=http://minio:9000`, `STORAGE_BUCKET_NAME=iuris-docs`
- **THEN** `get_storage_client()` retorna un cliente boto3 conectado a MinIO local sin modificar ningún código de feature

#### Scenario: Cliente apunta a R2 en prod
- **WHEN** `STORAGE_ENDPOINT_URL=https://<account>.r2.cloudflarestorage.com`, credenciales R2
- **THEN** `get_storage_client()` retorna un cliente boto3 conectado a Cloudflare R2 sin modificar ningún código de feature

### Requirement: Generación de URLs prefirmadas
El `StorageClient` SHALL exponer `generate_presigned_url(operation: Literal["put_object","get_object"], key: str, expires_in: int) -> str` que delega a boto3. El backend NEVER SHALL exponer las credenciales del storage al frontend — solo la URL prefirmada resultante.

#### Scenario: URL prefirmada de subida (PUT)
- **WHEN** se llama `generate_presigned_url("put_object", "casos/1/doc.pdf", expires_in=300)`
- **THEN** retorna una URL HTTPS firmada válida por 300 segundos que el cliente puede usar con HTTP PUT directo

#### Scenario: URL prefirmada de descarga (GET)
- **WHEN** se llama `generate_presigned_url("get_object", "casos/1/doc.pdf", expires_in=3600)`
- **THEN** retorna una URL HTTPS firmada válida por 3600 segundos que el cliente puede usar con HTTP GET directo

### Requirement: URL pública de MinIO reemplaza hostname interno
En entorno dev, las URLs prefirmadas generadas por boto3 contienen el hostname interno `minio:9000` (irresoluble desde el navegador). El sistema SHALL reemplazar ese hostname por el valor de `STORAGE_PUBLIC_URL` (default: `http://localhost:9000`) antes de devolver la URL al frontend.

#### Scenario: URL prefirmada resuelta para el navegador en dev
- **WHEN** boto3 genera `http://minio:9000/iuris-docs/...?X-Amz-Signature=...` y `STORAGE_PUBLIC_URL=http://localhost:9000`
- **THEN** `generate_presigned_url` retorna `http://localhost:9000/iuris-docs/...?X-Amz-Signature=...`

#### Scenario: URL no modificada en prod
- **WHEN** `STORAGE_PUBLIC_URL` no está definida (o es vacía) y el endpoint ya es una URL pública R2
- **THEN** la URL se retorna sin modificaciones

### Requirement: Bucket `iuris-docs` creado automáticamente al iniciar Docker Compose
El servicio `minio-init` SHALL crear el bucket `iuris-docs` con política privada al levantar el entorno de desarrollo, de forma idempotente (no falla si el bucket ya existe).

#### Scenario: Primer arranque sin bucket previo
- **WHEN** se ejecuta `docker compose up` por primera vez
- **THEN** `minio-init` crea el bucket `iuris-docs` y termina con exit code 0 antes de que el backend acepte requests

#### Scenario: Arranque con bucket ya existente
- **WHEN** se ejecuta `docker compose up` con el bucket ya creado (volumen persistido)
- **THEN** `minio-init` termina con exit code 0 sin error (flag `--ignore-existing`)

### Requirement: El backend no se inicia hasta que el bucket exista
El servicio `backend` en Docker Compose SHALL depender de `minio-init` con `condition: service_completed_successfully`, garantizando que el bucket está listo antes de aceptar cualquier request.

#### Scenario: Backend espera a minio-init
- **WHEN** MinIO tarda en iniciar
- **THEN** el backend no arranca hasta que `minio-init` complete exitosamente, previniendo errores de bucket-not-found en el arranque
