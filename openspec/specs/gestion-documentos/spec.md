## ADDED Requirements

### Requirement: Inicializar subida de documento (init)
El sistema SHALL proveer `POST /casos/{id}/documentos:init` que valide sesión y rol (ABOGADO o SOCIO), genere un `object_key` con formato `casos/{caso_id}/{uuid4}.{ext}` y devuelva una URL prefirmada de subida (PUT) con expiración de 300 segundos. El backend NO SHALL procesar ni almacenar el contenido del archivo.

#### Scenario: Init con rol válido
- **WHEN** un ABOGADO autenticado envía `POST /casos/1/documentos:init` con `{ "nombre_archivo": "dni_Gomez.pdf", "categoria": "DNI", "formato": "PDF" }`
- **THEN** responde 200 con `{ "upload_url": "<URL prefirmada PUT>", "object_key": "casos/1/<uuid>.pdf", "expires_in": 300 }`

#### Scenario: Init con formato inválido
- **WHEN** se envía `formato: "XLSX"` (no existe en el enum `FormatoDocumento`)
- **THEN** responde 422 con detalle de validación

#### Scenario: Init sin sesión
- **WHEN** se llama sin cookie de acceso
- **THEN** responde 401

#### Scenario: Init con caso inexistente
- **WHEN** `caso_id` no existe en la base de datos
- **THEN** responde 404

### Requirement: Registrar metadata de documento tras la subida
El sistema SHALL proveer `POST /casos/{id}/documentos` que valide sesión y rol, persista la metadata del documento en la tabla `documento` y devuelva el registro creado. El campo `ruta_almacenamiento` en DB DEBE almacenar el valor del `object_key` recibido en el body.

#### Scenario: Registro exitoso
- **WHEN** un ABOGADO autenticado envía `POST /casos/1/documentos` con `{ "object_key": "casos/1/uuid.pdf", "nombre_archivo": "dni_Gomez.pdf", "categoria": "DNI", "formato": "PDF" }` y el CSRF token correcto
- **THEN** responde 201 con `DocumentoResponse` que incluye `id`, `caso_id`, `nombre_archivo`, `categoria`, `formato`, `object_key`, `subido_por`, `subido_en`

#### Scenario: Registro sin CSRF
- **WHEN** la mutación se realiza sin el header `X-CSRF-Token`
- **THEN** responde 403

#### Scenario: Registro con caso inexistente
- **WHEN** `caso_id` no existe
- **THEN** responde 404

### Requirement: Listar documentos de un caso
El sistema SHALL proveer `GET /casos/{id}/documentos` que devuelva la lista de metadata de todos los documentos asociados al caso, ordenados por `subido_en` descendente. Este endpoint SHALL ser accesible a cualquier usuario autenticado (RN-08).

#### Scenario: Lista de documentos de un caso con documentos
- **WHEN** un usuario autenticado envía `GET /casos/1/documentos`
- **THEN** responde 200 con una lista de `DocumentoResponse`; si no hay documentos, devuelve lista vacía `[]`

#### Scenario: Lista sin sesión
- **WHEN** se llama sin cookie de acceso
- **THEN** responde 401

#### Scenario: Lista con caso inexistente
- **WHEN** `caso_id` no existe
- **THEN** responde 404

### Requirement: Generar URL prefirmada de descarga
El sistema SHALL proveer `GET /documentos/{id}/url` que valide sesión y rol, y devuelva una URL prefirmada de descarga (GET) con expiración de 3600 segundos. Solo ABOGADO o SOCIO puede obtener URLs de descarga.

#### Scenario: Descarga con rol válido
- **WHEN** un ABOGADO autenticado envía `GET /documentos/1/url`
- **THEN** responde 200 con `{ "download_url": "<URL prefirmada GET>", "expires_in": 3600 }`

#### Scenario: Descarga de documento inexistente
- **WHEN** el `documento_id` no existe en la tabla `documento`
- **THEN** responde 404

#### Scenario: Descarga sin sesión
- **WHEN** se llama sin cookie de acceso
- **THEN** responde 401

### Requirement: Restricción de rol en subida
El sistema SHALL impedir que el rol CLIENTE suba documentos. Solo usuarios autenticados con rol ABOGADO o SOCIO pueden llamar a los endpoints de init y register (RN-12). El servicio SHALL registrar `subido_por` con el `id` del usuario autenticado.

#### Scenario: Intento de subida sin rol ABOGADO/SOCIO
- **WHEN** un usuario con rol diferente a ABOGADO o SOCIO intenta `POST /casos/{id}/documentos:init`
- **THEN** responde 403

#### Scenario: subido_por registrado automáticamente
- **WHEN** el ABOGADO con `id=3` registra un documento
- **THEN** `documento.subido_por = 3` en la base de datos; el campo NO es editable por el cliente

### Requirement: CORS habilitado en MinIO para PUT directo desde el browser
El servicio `minio-init` SHALL configurar la política CORS en el bucket `iuris-docs` para permitir `PUT` desde `http://localhost:3001` (frontend dev). En producción (R2), la política CORS se configura en el dashboard de Cloudflare.

#### Scenario: PUT directo al bucket desde el browser en dev
- **WHEN** el browser hace `fetch(upload_url, { method: 'PUT', body: file, headers: { 'Content-Type': 'application/pdf' } })`
- **THEN** el bucket responde 200 sin error CORS

#### Scenario: PUT desde producción con R2
- **WHEN** `STORAGE_ENDPOINT_URL` apunta a R2 y la política CORS de R2 permite el dominio del frontend
- **THEN** el PUT directo funciona de la misma forma sin cambiar código
