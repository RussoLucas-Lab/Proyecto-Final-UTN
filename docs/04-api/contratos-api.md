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

### GET /usuarios
Lista de usuarios. *(RF-03, RN-07)*

### POST /usuarios
```json
{ "nombre": "María López", "email": "m@estudio.test", "rol": "ABOGADO", "area": "ART", "matricula": "MZA-1234" }
```
**201** → usuario creado. *(RF-03, RN-07)*

### PUT /usuarios/{id}
Edita los datos del usuario. *(RF-03)*

### PATCH /usuarios/{id}
Activa o desactiva (baja lógica): `{ "activo": false }`. *(RF-03, RN-07)*

## Clientes

### GET /clientes?search=&page=
Lista paginada. *(RF-07)*

### POST /clientes
```json
{ "nombre": "Acme S.A.", "dni": "30111222", "telefono": "+54...", "email": "c@acme.test" }
```
**201** → cliente creado. **409** si DNI duplicado (RN-03). *(RF-05)*

### GET /clientes/{id} · PUT /clientes/{id}
Consulta y edición. *(RF-06)*

## Casos

### POST /casos
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
    "empleador_nombre": "Acme S.A.", "razon_social": "Acme S.A.",
    "direccion_trabajo": "Av. San Martín 1000, Mendoza", "fecha_inicio_laboral": "2020-03-01",
    "jornada": "8 h", "tareas": "Operario", "remuneracion": 850000, "cct_aplicable": "CCT 130/75",
    "registrado": true, "notas": ""
  }
}
```
El caso se crea en la **etapa inicial** del área ("Toma del cliente") y genera la primera entrada de historial. En ART, `tipo_reclamo` es `ACCIDENTE` o `ENFERMEDAD`. La **ficha laboral** viaja anidada (1:1 con el caso) y puede omitirse y completarse luego. **201**. *(RF-08, RF-09, RN-05, RN-11)*

### PUT /casos/{id}/ficha-laboral
Crea o actualiza la ficha de admisión laboral del caso (1:1). *(RF-09)*

### GET /casos?area=&etapa=&abogado_id=&cliente_id=&page=
Listado con filtros. *(RF-13)*

### GET /casos/{id}
Detalle (cliente, área, etapa actual, ficha, fechas, observaciones). Incluye las **transiciones válidas** desde la etapa actual (para el stepper del frontend).

### POST /casos/{id}/avanzar · POST /casos/{id}/retroceder
Cambia la etapa. `avanzar` valida que exista una transición permitida desde la etapa actual (RN-04). `retroceder` requiere confirmación explícita (`{ "confirmar": true }`, RN-09). Ambos registran en `historial_caso`. *(RF-10, RF-11)*

### GET /casos/{id}/historial
Historial inmutable del caso. *(RF-12, RN-06)*

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
