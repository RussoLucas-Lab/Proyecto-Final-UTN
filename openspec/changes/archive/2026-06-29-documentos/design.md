## Context

El change `storage-infra` está completo: `StorageClient` en `backend/app/core/storage.py`, MinIO en `docker-compose.yml` con bucket `iuris-docs` creado al arrancar. Los enums `CategoriaDocumento` y `FormatoDocumento` están en `backend/app/shared/enums.py`. El modelo ORM `Documento` existe en `backend/app/features/documentos/models.py` y la tabla `documento` fue creada en la migración `001_esquema_base_inicial.py`. El directorio `backend/app/features/documentos/` solo tiene `models.py`; faltan `router.py`, `schemas.py`, `service.py` y los tests.

El contrato API está documentado en `docs/04-api/contratos-api.md` (sección Documentos). Esta feature lo implementa.

## Goals / Non-Goals

**Goals:**
- Implementar los 4 endpoints definidos en el contrato: init (upload URL), register, list, download URL.
- Subida directa del browser al storage (el backend no transporta bytes).
- Restricción de rol: solo ABOGADO/SOCIO puede subir y descargar; GET /casos/{id}/documentos es accesible a cualquier usuario autenticado (RN-08).
- Validación de formato con el enum `FormatoDocumento` (PDF | DOC | IMAGEN).
- Componentes frontend: drag&drop uploader + lista de documentos en `CasoDetallePage`.

**Non-Goals:**
- Nueva migración de DB (la tabla `documento` ya existe en migración 001).
- Preview inline en el browser (solo se provee URL de descarga directa).
- Versionado de archivos ni eliminación de documentos en MVP.
- Escaneo de virus o validación de contenido de archivos.

## Decisions

**D1 — Upload directo al storage (paso intermedio sin el backend)**
El backend genera una URL prefirmada de subida (PUT) con expiración de 300 s. El frontend hace `PUT` del archivo directo a esa URL. Solo después registra la metadata via `POST /casos/{id}/documentos`. El backend nunca toca los bytes. Esto sigue ADR-0007 y mantiene el backend stateless.

**D2 — CORS en MinIO para PUT directo desde el browser**
El PUT directo requiere que MinIO responda headers CORS (`Access-Control-Allow-Origin`). El servicio `minio-init` en `docker-compose.yml` debe ejecutar `mc anonymous set download` y configurar la política CORS via `mc cors set`. En R2, la política CORS se configura en el dashboard de Cloudflare una sola vez. Esta es la principal diferencia de configuración entre entornos.

**D3 — `object_key` en API = `ruta_almacenamiento` en DB**
El contrato público usa `object_key` (convención S3 genérica). El modelo ORM usa `ruta_almacenamiento` (campo existente en `001`). El servicio hace el mapeo entre ambos nombres; los schemas Pydantic exponen `object_key` al frontend.

**D4 — Formato: enum explícito (no inferido del MIME)**
La categoría y el formato los elige explícitamente el usuario en el formulario. Se valida contra `FormatoDocumento` (PDF | DOC | IMAGEN) en el schema de entrada; 415 si el valor no existe. Así la metadata es coherente con el tipo de documento legal, independientemente del Content-Type del archivo real.

**D5 — Nombre del objeto en el bucket**
Convención: `casos/{caso_id}/{uuid4}.{ext}` generado por el backend en el step init. Esto garantiza unicidad, aísla por caso y evita colisiones de nombre de archivo.

**D6 — Frontend: react-dropzone para drag&drop**
`react-dropzone` ya es la opción estándar en React para esta UX. Se instala con `pnpm`. El PUT a la URL prefirmada se hace con `fetch` nativo (no axios, para evitar headers extra que rompen la firma S3).

## Risks / Trade-offs

- **CORS de MinIO en dev** → Mitigación: agregar la configuración CORS al `minio-init` del compose y documentarlo en el `.env.example`.
- **PUT con headers extra rompe firma S3** → Mitigación: el frontend usa `fetch` con `method: 'PUT'` y solo el header `Content-Type`; no debe incluir tokens de auth ni CSRF (la firma ya autentica la operación).
- **Object_key inválido en el paso de registro** → El backend no re-verifica que el objeto exista en el bucket antes de persistir la metadata (verificar un HEAD presignado añadiría latencia). Si el usuario registra un key que nunca fue subido, la descarga fallará con 403 del storage. Aceptable en MVP.
- **Expiración de URL de subida en formularios lentos** → 300 s debería ser suficiente para drag&drop de archivos < 50 MB. No se implementa renovación en MVP.

## Migration Plan

1. No se requiere nueva migración de Alembic (tabla y enums en 001).
2. Agregar configuración CORS en `docker-compose.yml` → `minio-init`.
3. Implementar backend (`schemas.py`, `service.py`, `router.py`) y registrar el router en `main.py`.
4. Implementar frontend (`DocumentUploader`, `DocumentList`) e integrar en `CasoDetallePage`.
5. Tests unitarios backend (service + router) con mock de `StorageClient`.
6. Smoke test manual: subir un PDF en MinIO local y descargarlo.
