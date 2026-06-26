## Context

La autenticación y la infraestructura transversal ya están implementadas y archivadas: cookies JWT HttpOnly/Secure/SameSite, refresh revocable, CSRF double-submit (`CSRFMiddleware`), RBAC por dependencias (`get_current_user`, `require_socio`, `require_roles`) y rate limiting (SlowAPI, `limiter`). El modelo ORM `Cliente` **ya existe** en `backend/app/features/clientes/models.py` y la tabla `cliente` ya está en la migración `001_esquema_base_inicial.py` con todos los campos del DBML v2: `nombre`, `dni` (único, RN-03), `cuil`, `telefono`, `email`, `domicilio_real`, `domicilio_real_cp`, `domicilio_real_localidad`, `domicilio_real_provincia`, `domicilio_coincide_dni` y `creado_en`.

Este change agrega el **ABM de clientes (admisión)** (RF-05/UC-02, RF-06, RF-07, RN-03) como feature vertical-slice nueva (`features/clientes/`) que **consume** la seguridad transversal sin recrearla. No hay esquema nuevo ni migración. El patrón de referencia es el change `usuarios` ya implementado (`backend/app/features/usuarios/` y `frontend/src/features/usuarios/`).

Restricciones: feature-first (ADR-0009), backend stateless, español (AR) en código y artefactos, cobertura de tests ≥ 80%, base sintética (Ley 25.326 — nunca datos reales), SQL parametrizado (SQLAlchemy).

## Goals / Non-Goals

**Goals:**
- CRUD de clientes: `POST /clientes`, `GET /clientes/{id}`, `PUT /clientes/{id}`, `GET /clientes?search=&page=`.
- DNI único en el estudio (RN-03) → `409` ante colisión (alta y edición).
- Lectura amplia para todo autenticado (RN-08); mutaciones para ABOGADO y SOCIO.
- Body de `POST /clientes` con `cuil` y `domicilio_real` (+ CP/localidad/provincia) según el modelo de datos.
- Búsqueda por nombre o DNI y paginación en el listado (RF-07).
- Frontend: feature `clientes/` (listado + búsqueda + alta + edición).
- Tests backend ≥ 80% cubriendo RBAC, CSRF, unicidad de DNI, búsqueda y 404.

**Non-Goals:**
- Casos, ficha laboral, documentos, telegramas o cualquier cosa fuera de clientes (RF-08+).
- Borrado de clientes (no hay baja lógica ni física de cliente en RF-05/06/07; fuera de alcance).
- Reimplementar autenticación, cookies, CSRF o RBAC (ya existen).
- Nueva migración o cambios de esquema — el modelo `Cliente` y la tabla ya existen.
- Validación de formato de CUIL/DNI más allá de longitud y obligatoriedad mínima (se evalúa a futuro).

## Decisions

### D1 — Reutilizar el modelo `Cliente` existente, no redefinirlo
La feature importa `from app.features.clientes.models import Cliente` (ya creado en `migraciones-esquema-base`). NO se crea un segundo modelo ni una migración: hacerlo duplicaría la tabla `cliente` en el registro de SQLAlchemy y rompería el mapeo. El change agrega solo `router.py`, `service.py`, `schemas.py` y (si hace falta) `dependencies.py`.
- _Alternativa descartada_: redefinir `Cliente` en este change → colisión de tabla y doble fuente de verdad.

### D2 — Body de `POST /clientes` con `cuil` y `domicilio_real` (desvío del ejemplo de API)
El ejemplo en `docs/04-api/contratos-api.md` muestra solo `{ nombre, dni, telefono, email }`, pero el modelo de datos (DBML v2) define `cuil` y el domicilio real desglosado (`domicilio_real`, `_cp`, `_localidad`, `_provincia`) más `domicilio_coincide_dni`. Decisión: el schema `ClienteCreate` incluye todos esos campos. `dni` y `nombre` son obligatorios; el resto opcional (coherente con el DBML, donde solo `nombre`, `dni` y `creado_en` son NOT NULL). Se actualiza el contrato de API en el mismo PR de implementación (regla SDD); la nota ya está registrada en `docs/changemap.md`.
- _Alternativa descartada_: respetar el ejemplo reducido → perdería datos de admisión que el modelo ya soporta y que la operación necesita (domicilio para telegramas/comunicaciones futuras).

### D3 — DNI único validado vía restricción de tabla → `409`
La unicidad de DNI (RN-03) se apoya en la restricción `unique` de la columna `dni`. El servicio captura `IntegrityError` y lo traduce a una excepción de dominio (`DniDuplicado`) que el router mapea a `409`. Aplica tanto al alta como a la edición (si el nuevo DNI colisiona con **otro** cliente). Antes del flush se puede hacer una verificación previa por DNI para dar un `409` limpio, pero la restricción de tabla es la garantía final (evita carreras).
- _Alternativa descartada_: validar solo en código sin restricción de tabla → expuesto a condiciones de carrera.

### D4 — RBAC: lectura amplia, mutaciones ABOGADO+SOCIO
`GET /clientes` y `GET /clientes/{id}` usan solo `Depends(get_current_user)` (lectura amplia para todo autenticado, RN-08). `POST` y `PUT` usan `Depends(require_roles(SOCIO, ABOGADO))` (o el guard equivalente existente): la admisión es operación del abogado (RF-05/RF-06), por lo que ABOGADO y SOCIO pueden mutar. No se crea lógica de RBAC nueva; se reutilizan los guards de `core/dependencies.py`.
- _Nota_: a diferencia de `usuarios` (mutaciones solo SOCIO), aquí ABOGADO también muta. Si el guard `require_roles` no existe aún con esa firma, se reutiliza el patrón existente de `auth`/`usuarios` para componer el chequeo de rol.

### D5 — CSRF y rate limiting heredados, sin código nuevo
El `CSRFMiddleware` ya intercepta toda mutación bajo `/api/v1`, así que `POST/PUT /clientes` quedan protegidos automáticamente (header `X-CSRF-Token` debe coincidir con la cookie `csrf_token`). Las rutas aplican `@limiter.limit("100/minute")` siguiendo el patrón de `usuarios/router.py`. No se toca middleware ni configuración global. `GET` está exento de CSRF (método seguro).

### D6 — Búsqueda por nombre o DNI con paginación (RF-07)
`GET /clientes?search=&page=` filtra por coincidencia parcial **case-insensitive** en `nombre` (p. ej. `ILIKE %search%`) **o** por `dni` (coincidencia por prefijo/contiene). Sin `search`, devuelve la lista paginada completa. La paginación usa `page` (tamaño de página fijo en el servicio) y se construye con SQL parametrizado. La respuesta es una lista de `ClienteResponse` (con metadata de paginación si el patrón compartido lo provee; si no, lista simple paginada por offset/limit).

### D7 — Schemas Pydantic separados de entrada y salida
`ClienteCreate` (alta: `nombre`, `dni` obligatorios; `cuil`, `telefono`, `email`, `domicilio_real*`, `domicilio_coincide_dni` opcionales — `email` como `EmailStr | None`), `ClienteUpdate` (mismos campos editables; `dni` editable pero sujeto a unicidad) y `ClienteResponse` (incluye `id`, todos los datos y `creado_en`, `model_config = {"from_attributes": True}`). Los datos del cliente no son secretos como `password_hash`, pero igual se serializa explícitamente desde el ORM por consistencia con el patrón de `usuarios`.

### D8 — Frontend: feature vertical-slice clientes
`frontend/src/features/clientes/` con `api.ts` (sobre `shared/http`, que ya inyecta CSRF y `credentials:'include'`), `types.ts`, `hooks/` (p. ej. `useClientes`), `components/` (formulario de admisión + tabla con buscador) y una `page`. La ruta se monta protegida por sesión (todo autenticado puede entrar y leer). Mensajes en español (AR); manejo de errores `409` (DNI duplicado), `404` y `422`.

## Risks / Trade-offs

- **[Desvío de spec: `cuil`/`domicilio_real` no figuran en el ejemplo de API]** → Se actualiza `docs/04-api/contratos-api.md` en el mismo PR (regla SDD); nota ya registrada en `docs/changemap.md` (D2).
- **[Etiqueta incorrecta en API: `GET /clientes?search=` figura como RF-06]** → Es RF-07; se corrige la etiqueta en el contrato de API (nota del changemap).
- **[Unicidad de DNI con carrera]** → Se confía en la restricción `unique` de la tabla; el servicio captura `IntegrityError` y traduce a `409` (D3).
- **[Confidencialidad Ley 25.326]** → Datos sintéticos en dev/tests; nunca datos reales ni en commits. Los datos del cliente son sensibles: se evita loguearlos.
- **[Búsqueda sin índice dedicado]** → Para el volumen del MVP, `ILIKE` sin índice trigram es aceptable; se documenta como posible optimización futura si el listado crece.

## Open Questions

- ¿`email` y `cuil` deberían tener validación de formato estricta (regex CUIL, `EmailStr`)? Decisión MVP: `EmailStr` opcional para email; CUIL como string con longitud máxima (sin regex). Revisar si admisión lo exige.
- ¿Se requiere baja (lógica) de clientes? Fuera de RF-05/06/07; no se implementa. Evaluar en un change aparte si surge.
- ¿El listado debe devolver metadata de paginación (total/páginas) o lista simple? Se sigue el patrón del cliente HTTP/listados existentes; si no hay uno establecido, se usa offset/limit con `page`.
