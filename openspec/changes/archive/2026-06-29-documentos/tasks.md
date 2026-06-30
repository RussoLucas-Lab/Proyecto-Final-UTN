## 1. Infraestructura — CORS en MinIO

- [x] 1.1 Agregar configuración CORS en `docker-compose.yml` → servicio `minio-init`: ejecutar `mc cors set` para permitir `PUT` desde `http://localhost:3001` en el bucket `iuris-docs`
- [x] 1.2 Verificar que el bucket responde los headers CORS correctos haciendo un `OPTIONS` manual contra `http://localhost:9000/iuris-docs/`

## 2. Backend — Schemas

- [x] 2.1 Crear `backend/app/features/documentos/schemas.py` con:
  - `DocumentoInitRequest` (`nombre_archivo`, `categoria: CategoriaDocumento`, `formato: FormatoDocumento`)
  - `DocumentoInitResponse` (`upload_url`, `object_key`, `expires_in: int`)
  - `DocumentoRegisterRequest` (`object_key`, `nombre_archivo`, `categoria`, `formato`)
  - `DocumentoResponse` (`id`, `caso_id`, `nombre_archivo`, `categoria`, `formato`, `object_key` ← mapeado desde `ruta_almacenamiento`, `subido_por`, `subido_en`)
  - `DocumentoDownloadResponse` (`download_url`, `expires_in: int`)

## 3. Backend — Service

- [x] 3.1 Crear `backend/app/features/documentos/service.py` con función `init_upload(caso_id, request, usuario_id, storage) -> DocumentoInitResponse`: valida que el caso exista, genera `object_key = f"casos/{caso_id}/{uuid4()}.{ext}"`, llama a `storage.generate_presigned_url("put_object", object_key, 300)`
- [x] 3.2 Agregar función `register_documento(caso_id, request, usuario_id, db) -> Documento`: valida caso, crea registro `Documento` con `ruta_almacenamiento = request.object_key`
- [x] 3.3 Agregar función `list_documentos(caso_id, db) -> list[Documento]`: valida caso, retorna documentos ordenados por `subido_en DESC`
- [x] 3.4 Agregar función `get_download_url(documento_id, db, storage) -> DocumentoDownloadResponse`: busca el documento, llama a `storage.generate_presigned_url("get_object", doc.ruta_almacenamiento, 3600)`

## 4. Backend — Router

- [x] 4.1 Crear `backend/app/features/documentos/router.py` con los 4 endpoints:
  - `POST /casos/{caso_id}/documentos:init` — rol ABOGADO/SOCIO + CSRF, llama `init_upload`
  - `POST /casos/{caso_id}/documentos` — rol ABOGADO/SOCIO + CSRF, llama `register_documento`, responde 201
  - `GET /casos/{caso_id}/documentos` — cualquier usuario autenticado, llama `list_documentos`
  - `GET /documentos/{documento_id}/url` — rol ABOGADO/SOCIO, llama `get_download_url`
- [x] 4.2 Registrar el router en `backend/app/main.py` bajo el prefijo `/api/v1`

## 5. Backend — Tests (TDD)

- [x] 5.1 Crear `backend/tests/features/documentos/test_service.py` con tests unitarios (mock de `StorageClient` y DB session):
  - Init genera `object_key` con formato correcto y retorna `upload_url`
  - Register crea registro con `ruta_almacenamiento` = `object_key` del request
  - List retorna vacío para caso sin documentos
  - Download retorna `download_url` a partir de `ruta_almacenamiento`
- [x] 5.2 Crear `backend/tests/features/documentos/test_router.py` con tests de integración (TestClient):
  - Init: 200 con rol ABOGADO, 401 sin sesión, 404 caso inexistente, 422 formato inválido
  - Register: 201 con rol ABOGADO + CSRF, 403 sin CSRF
  - List: 200 sin importar rol (usuario autenticado), 401 sin sesión
  - Download URL: 200 con rol ABOGADO, 404 documento inexistente
- [x] 5.3 Ejecutar `pytest backend/tests/features/documentos/` y confirmar ≥ 80% cobertura

## 6. Frontend — Feature documentos

- [x] 6.1 Instalar `react-dropzone` con `pnpm add react-dropzone` en `frontend/`
- [x] 6.2 Crear `frontend/src/features/documentos/types.ts` con interfaces `DocumentoInitResponse`, `DocumentoResponse`, `DocumentoDownloadResponse`
- [x] 6.3 Crear `frontend/src/features/documentos/api.ts` con funciones:
  - `initUpload(casoId, payload)` → `POST /api/v1/casos/{casoId}/documentos:init`
  - `registerDocumento(casoId, payload)` → `POST /api/v1/casos/{casoId}/documentos`
  - `listDocumentos(casoId)` → `GET /api/v1/casos/{casoId}/documentos`
  - `getDownloadUrl(documentoId)` → `GET /api/v1/documentos/{documentoId}/url`
  - `uploadToStorage(uploadUrl, file)` → `fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })` — **sin headers de auth ni CSRF** (la firma S3 ya autentica)
- [x] 6.4 Crear `frontend/src/features/documentos/components/DocumentUploader.tsx`: zona drag&drop con `react-dropzone`, selector de `categoria` y `formato`, flujo init→PUT→register, feedback de estado (cargando / éxito / error)
- [x] 6.5 Crear `frontend/src/features/documentos/components/DocumentList.tsx`: tabla con columnas `nombre_archivo`, `categoria`, `formato`, `subido_en` y botón "Descargar" que llama `getDownloadUrl` y abre la URL en nueva pestaña
- [x] 6.6 Integrar `DocumentUploader` y `DocumentList` en `CasoARTPage.tsx` y `CasoLaboralPage.tsx` (nueva sección "Documentos" en el panel de detalle)

## 7. Verificación manual

- [x] 7.1 `docker compose up -d --force-recreate backend minio minio-init` y confirmar que el backend arranca sin errores
- [x] 7.2 Smoke test: iniciar sesión como ABOGADO → abrir un caso → subir un PDF → verificar que aparece en la lista → hacer clic en "Descargar" y confirmar que el archivo es accesible
- [x] 7.3 Verificar en MinIO Console (`http://localhost:9001`) que el objeto existe en el bucket `iuris-docs` con la ruta `casos/{id}/{uuid}.pdf`
