# Contratos de la API REST

Convenciones generales:
- Base URL: `/api/v1`
- Autenticación: **JWT en cookies seguras** (`HttpOnly`, `Secure`, `SameSite`). El access token se renueva con el refresh token; ambos viajan en cookies (no en el body ni en headers). Ver `07-seguridad-y-despliegue/`.
- **CSRF**: al usar cookies, las mutaciones requieren protección CSRF (token o double-submit).
- Formato: JSON. Fechas en ISO-8601.
- Errores: `{ "error": { "code": "...", "message": "..." } }` con códigos HTTP estándar. Los errores internos no exponen detalle.

## Autenticación

### POST /auth/login
**Request**
```json
{ "email": "abogado@estudio.test", "password": "••••••" }
```
**Response 200**: emite cookies seguras (access + refresh) y devuelve el perfil.
```json
{ "rol": "ABOGADO", "nombre": "Juan Pérez" }
```
**401** credenciales inválidas. *(RF-01)*

### POST /auth/refresh
Renueva el access token a partir del refresh token (cookie). **401** si el refresh está vencido o revocado.

### POST /auth/logout
Limpia las cookies y **revoca** el refresh token (tabla `refresh_token`); registra el evento. *(RF-04)*

## Usuarios (solo SOCIO)

> **Auth**: JWT en cookie HttpOnly. Mutaciones protegidas por CSRF double-submit (`X-CSRF-Token`).
> **RBAC**: `GET` accesible por todo usuario autenticado (RN-08); `POST/PUT/PATCH` exclusivos de SOCIO (RN-07).

### GET /usuarios
Lista todos los usuarios del estudio. **200** lista de `UsuarioResponse`. **401** sin sesión. *(RF-03, RN-07, RN-08)*

### POST /usuarios
Crea un usuario nuevo. El SOCIO provee la contraseña inicial — **desvío D2** respecto al contrato original (que no incluía `password`): el modelo requiere `password_hash NOT NULL` y no hay flujo de invitación en el MVP.

```json
{
  "email": "m@estudio.test",
  "password": "contraseñaInicial",
  "nombre": "María López",
  "rol": "ABOGADO",
  "area": "ART",
  "matricula": "MZA-1234"
}
```

> **Validación de `password`**: hoy es solo `min_length=1`. No existe política de complejidad centralizada en el MVP — se reutilizará cuando esté disponible (ver deuda en changemap.md).

**201** → `UsuarioResponse` (sin `password_hash`). **409** email duplicado. **422** payload inválido o ABOGADO sin área. **403** si no es SOCIO. *(RF-03, RN-07)*

### PUT /usuarios/{id}
Reemplaza nombre, rol, área y matrícula. No modifica email (inmutable) ni contraseña.

```json
{ "nombre": "María López", "rol": "ABOGADO", "area": "LABORAL", "matricula": "MZA-9999" }
```

**200** → `UsuarioResponse`. **404** no encontrado. **422** ABOGADO sin área. **403** si no es SOCIO. *(RF-03)*

### PATCH /usuarios/{id}
Activa o desactiva (baja lógica). Un SOCIO no puede desactivarse a sí mismo.

```json
{ "activo": false }
```

**200** → `UsuarioResponse`. **409** intento de autodesactivación. **404** no encontrado. **403** si no es SOCIO. *(RF-03, RN-07)*

### UsuarioResponse (schema de respuesta)
```json
{
  "id": 3,
  "email": "m@estudio.test",
  "nombre": "María López",
  "rol": "ABOGADO",
  "area": "ART",
  "matricula": "MZA-1234",
  "activo": true,
  "creado_en": "2026-06-25T10:00:00"
}
```
`password_hash` **nunca** se incluye en ninguna respuesta.

## Clientes

> **Auth**: JWT en cookie HttpOnly. Mutaciones (`POST`/`PUT`) protegidas por CSRF double-submit (`X-CSRF-Token`).
> **RBAC**: `GET` accesible por todo usuario autenticado (RN-08); `POST`/`PUT` requieren ABOGADO o SOCIO (D4).

### GET /clientes?search=&page=
Lista paginada de clientes. Parámetros opcionales: `search` (filtra por nombre ILIKE o DNI), `page` (base 1, tamaño fijo 20).
**200** lista de `ClienteResponse`. **401** sin sesión. *(RF-07)*

### POST /clientes
Crea un cliente nuevo (admisión). `nombre` y `dni` son obligatorios; el resto opcionales.

> **Desvío D2** respecto al ejemplo original (que solo tenía `nombre`, `dni`, `telefono`, `email`):
> el modelo DBML v2 incluye `cuil` y `domicilio_real` desglosado, que son necesarios para telegramas y comunicaciones.

```json
{
  "nombre": "García Rodríguez, Juan",
  "dni": "28456123",
  "cuil": "20-28456123-4",
  "telefono": "0261-4567890",
  "email": "juan@iuris.test",
  "domicilio_real": "Av. San Martín 1234",
  "domicilio_real_cp": "5500",
  "domicilio_real_localidad": "Mendoza",
  "domicilio_real_provincia": "Mendoza",
  "domicilio_coincide_dni": true
}
```

**201** → `ClienteResponse`. **409** DNI duplicado (RN-03). **422** payload inválido. **403** sin rol ABOGADO/SOCIO. *(RF-05)*

### GET /clientes/{id}
Consulta un cliente por id. **200** → `ClienteResponse`. **404** no encontrado. **401** sin sesión. *(RF-06)*

### PUT /clientes/{id}
Edita los datos de un cliente. Mismo body que `POST /clientes`.
**200** → `ClienteResponse`. **404** no encontrado. **409** nuevo DNI ya registrado para otro cliente. **422** payload inválido. *(RF-06)*

### ClienteResponse (schema de respuesta)
```json
{
  "id": 1,
  "nombre": "García Rodríguez, Juan",
  "dni": "28456123",
  "cuil": "20-28456123-4",
  "telefono": "0261-4567890",
  "email": "juan@iuris.test",
  "domicilio_real": "Av. San Martín 1234",
  "domicilio_real_cp": "5500",
  "domicilio_real_localidad": "Mendoza",
  "domicilio_real_provincia": "Mendoza",
  "domicilio_coincide_dni": true,
  "creado_en": "2026-06-26T10:00:00"
}
```

## Casos

> **Auth**: JWT en cookie HttpOnly. Mutaciones (`POST`/`PUT`) protegidas por CSRF double-submit (`X-CSRF-Token`).
> **RBAC**: `GET` accesible por todo usuario autenticado; `POST`/`PUT` requieren ABOGADO o SOCIO.
> **ADR-0008**: La etapa inicial se resuelve por dato (menor `orden` del área), nunca hardcodeada.

### POST /casos
**Request body** (`CasoCreate`):
```json
{
  "cliente_id": 12,
  "abogado_responsable_id": 3,
  "area": "LABORAL",
  "tipo_reclamo": null,
  "codigo_expediente": "EXP-2026-000123",
  "fecha_inicio": "2026-06-11",
  "observaciones": "Reclamo laboral.",
  "ficha_laboral": {
    "empleador_nombre": "Acme S.A.",
    "razon_social": "Acme S.A.",
    "direccion_trabajo": "Av. San Martín 1000, Mendoza",
    "fecha_inicio_laboral": "2020-03-01",
    "jornada": "8 h",
    "tareas": "Operario",
    "remuneracion": "850000.00",
    "cct_aplicable": "CCT 130/75",
    "registrado": true,
    "notas": ""
  }
}
```
Reglas:
- `tipo_reclamo` (`ACCIDENTE` | `ENFERMEDAD`) es **obligatorio** para ART y **nulo** para LABORAL.
- La `ficha_laboral` es opcional al crear; se puede completar luego con `PUT /casos/{id}/ficha-laboral`.
- El caso se crea en la **etapa de menor `orden`** del área (ADR-0008, RN-04).
- Se genera automáticamente la primera entrada en `historial_caso` con `evento="creación"` y `etapa_anterior_id=null`.

**201** → `CasoResponse`. **422** si ART sin `tipo_reclamo` o LABORAL con `tipo_reclamo`. **404** cliente o abogado no existen. **401** sin sesión. **403** sin CSRF o sin rol. *(RF-08, RF-09, RN-04, RN-05)*

### CasoResponse (schema de respuesta — listado y mutaciones)
```json
{
  "id": 1,
  "cliente_id": 12,
  "abogado_responsable_id": 3,
  "area": "LABORAL",
  "tipo_reclamo": null,
  "codigo_expediente": "EXP-2026-000123",
  "etapa_actual_id": 1,
  "fecha_inicio": "2026-06-11",
  "observaciones": "Reclamo laboral.",
  "creado_en": "2026-06-26T10:00:00"
}
```

### CasoDetalleResponse (schema de detalle — GET /casos/{id})
```json
{
  "id": 1,
  "cliente_id": 12,
  "abogado_responsable_id": 3,
  "area": "LABORAL",
  "tipo_reclamo": null,
  "codigo_expediente": "EXP-2026-000123",
  "etapa_actual_id": 2,
  "fecha_inicio": "2026-06-11",
  "observaciones": "Reclamo laboral.",
  "creado_en": "2026-06-26T10:00:00",
  "etapa_actual": {
    "id": 2,
    "area": "LABORAL",
    "fase": "EXTRAJUDICIAL",
    "nombre": "Telegrama 1",
    "orden": 2,
    "es_terminal": false
  },
  "ficha": {
    "id": 1,
    "caso_id": 1,
    "empleador_nombre": "Acme S.A.",
    "remuneracion": "850000.00"
  },
  "transiciones_validas": [
    { "id": 3, "area": "LABORAL", "fase": "EXTRAJUDICIAL", "nombre": "Telegrama 2", "orden": 3, "es_terminal": false }
  ]
}
```

### GET /casos?area=&etapa_id=&abogado_id=&cliente_id=&page=
Listado con filtros opcionales (todos opcionales). Paginado (base 1, tamaño 20).
**200** → lista de `CasoResponse`. **401** sin sesión. *(RF-13)*

### GET /casos/{id}
Detalle completo: etapa actual como objeto, ficha laboral (si existe) y **transiciones válidas** desde la etapa actual.
**200** → `CasoDetalleResponse`. **404** no encontrado. **401** sin sesión. *(RF-13)*

### PUT /casos/{id}/ficha-laboral
Crea o actualiza (upsert) la ficha laboral del caso. Body: campos opcionales del schema `FichaLaboralUpsert` (todos son `null`able).
**200** → `FichaLaboralResponse`. **404** caso no encontrado. **403** sin CSRF o sin rol. *(RF-09)*

### POST /casos/{id}/avanzar
**Request**:
```json
{ "etapa_destino_id": 3 }
```
Valida que exista una entrada en `transicion_etapa` desde la etapa actual hacia `etapa_destino_id`.
**200** → `CasoResponse`. **409** si la transición no existe. **404** caso no encontrado. *(RF-10, RN-04)*

### POST /casos/{id}/retroceder
**Request**:
```json
{ "etapa_destino_id": 1, "confirmar": true }
```
Retrocede a cualquier etapa del mismo área (no usa `transicion_etapa` — lógica de aplicación).
Sin `confirmar: true` responde **409** (protección RN-09). **409** también si la etapa destino es de otra área.
**200** → `CasoResponse`. **404** caso no encontrado. *(RF-11, RN-09)*

### GET /casos/{id}/historial
Historial **append-only** del caso en orden cronológico. No existe `DELETE` ni `PUT` sobre este recurso (RN-06).

**200** → lista de `HistorialItemResponse`:
```json
[
  { "id": 1, "caso_id": 1, "etapa_anterior_id": null, "etapa_nueva_id": 1, "evento": "creación", "autor_id": 3, "ocurrido_en": "2026-06-26T10:00:00" },
  { "id": 2, "caso_id": 1, "etapa_anterior_id": 1, "etapa_nueva_id": 2, "evento": "avance", "autor_id": 3, "ocurrido_en": "2026-06-26T12:00:00" }
]
```
**404** caso no encontrado. **401** sin sesión. *(RF-12, RN-05, RN-06)*

## Telegramas (Laboral)

### POST /casos/{id}/telegramas
Registra un telegrama del caso (solo Laboral, hasta 3).
```json
{ "numero": 1, "destinatario": "Acme S.A.", "domicilio_destino": "Av. San Martín 1000", "cuerpo": "Intimo..." }
```
**201** → se crea con `resultado = PENDIENTE`. **409** si ya existe ese número. *(RF-25, RN-15, RN-16, RN-18)*

### PATCH /telegramas/{id}
Actualiza el resultado de entrega: `{ "resultado": "EN_SUCURSAL" }` (ENTREGADO · RECHAZADO · EN_SUCURSAL · DOMICILIO_INEXISTENTE · CERRADO). *(RF-25, RN-18)*

## Documentos

El bucket de R2 es **privado** (ADR-0007). La subida y la descarga usan **URLs prefirmadas** con expiración corta que emite el backend tras validar sesión y rol; el backend no transporta los bytes. Solo un abogado sube documentos (Relevamiento §6).

### Subida (2 pasos)
1) `POST /casos/{id}/documentos:init` — el backend valida el rol y devuelve una URL prefirmada de subida (PUT) y la clave del objeto.
```json
// request
{ "nombre_archivo": "dni_Gomez_Dario.pdf", "categoria": "DNI", "formato": "PDF" }
// response 200
{ "upload_url": "https://<cuenta>.r2.cloudflarestorage.com/...", "object_key": "casos/123/uuid.pdf", "expires_in": 600 }
```
2) El frontend hace `PUT` del archivo directamente a `upload_url`.
3) `POST /casos/{id}/documentos` — registra la metadata una vez subido el archivo.
```json
{ "object_key": "casos/123/uuid.pdf", "nombre_archivo": "dni_Gomez_Dario.pdf", "categoria": "DNI", "formato": "PDF" }
```
**415** si el formato no es permitido. *(RF-14, RN-02, RN-12)*

### GET /casos/{id}/documentos
Lista la metadata de los documentos del caso. *(RF-15)*

### GET /documentos/{id}/url
El backend valida el rol y devuelve una URL prefirmada de descarga (GET) con expiración corta.
```json
{ "download_url": "https://<cuenta>.r2.cloudflarestorage.com/...", "expires_in": 600 }
```
*(RF-15)*

## Comunicación asistida por IA

### POST /casos/{id}/actualizacion
Dispara la generación del borrador (vía n8n) y lo **persiste** como `comunicacion` (`tipo=MANUAL`, `estado=PENDIENTE_REVISION`); además lo devuelve. **No envía nada.** Así toda comunicación —manual o batch— queda trazada y aparece en el dashboard de forma uniforme.
**Response 200**
```json
{ "id": 88, "borrador": "Hola Juan, te informamos que el expediente tuvo movimiento...", "generado_en": "2026-06-11T14:05:00Z" }
```
**503** si el servicio de IA no está disponible (permite redacción manual). *(RF-16, RF-18, RN-10)*

### GET /internal/casos/{id}/contexto  (uso interno — herramienta del agente n8n)
Endpoint **de solo lectura** que el nodo AI Agent de n8n consume como herramienta. Devuelve únicamente datos seguros del caso para generar el borrador. No es accesible desde el frontend; se protege con el secreto compartido.
```json
{ "cliente": "Juan Pérez", "etapa": "Conciliación", "ultimas_novedades": ["Movimiento del expediente el 11/06"] }
```
*(soporta RF-16; el backend no contiene lógica de IA)*

### Batch de actualizaciones (WF-05)
Endpoints internos (uso de n8n, protegidos por secreto):
- `GET /internal/casos/pendientes-actualizacion` — devuelve los `caso_id` activos que cumplen 15 días desde su última actualización (cadencia calculada por el backend). *(RF-26.1)*
- `POST /internal/casos/{id}/comunicaciones` — persiste un borrador generado.
```json
{ "contenido": "Buenos días, ...", "tipo": "ACTUALIZACION_AUTOMATICA" }
```
→ se crea en estado `PENDIENTE_REVISION`. *(RF-26.3, RN-19)*

Endpoints de usuario:
- `GET /comunicaciones?estado=PENDIENTE_REVISION` — borradores para el dashboard. *(RF-26.4)*
- `PATCH /comunicaciones/{id}` — aprobar o descartar.
```json
{ "estado": "APROBADO" }   // o "DESCARTADO"
```
El envío al cliente (WhatsApp) es una acción externa y manual (RN-10).

## Respaldos

### POST /backups  (rol SOCIO)
Ejecuta respaldo manual. *(RF-21)*

### GET /backups
Historial de respaldos.
```json
[ { "fecha": "2026-06-15", "tipo": "AUTOMATICO", "estado": "OK" } ]
```
*(RF-22, RN-13)*

## Vencimientos / agenda

### POST /casos/{id}/vencimientos · GET /vencimientos?desde=&hasta=
Registro y consulta de movimientos a realizar (vista calendario del estudio). *(RF-19, RF-20)*

### PATCH /vencimientos/{id}
Marca un vencimiento como realizado: `{ "completado": true }`. *(RF-19)*

> El contrato completo se mantendrá además como **OpenAPI** autogenerado por FastAPI en `/api/v1/openapi.json`.
