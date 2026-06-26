## 1. Backend — scaffold de la feature (vertical slice, ADR-0009 · skill `feature-scaffold`)

- [x] 1.1 Verificar que existe `backend/app/features/clientes/__init__.py` y la carpeta de la feature (ya creada).
- [x] 1.2 Crear `backend/app/features/clientes/schemas.py` con `ClienteCreate` (`nombre`, `dni` obligatorios; `cuil`, `telefono`, `email: EmailStr | None`, `domicilio_real`, `domicilio_real_cp`, `domicilio_real_localidad`, `domicilio_real_provincia`, `domicilio_coincide_dni` opcionales), `ClienteUpdate` (mismos campos editables; `dni` editable) y `ClienteResponse` (`id` + todos los campos + `creado_en`, `model_config = {"from_attributes": True}`). (D2, D7)
- [x] 1.3 NO crear `models.py`: reutilizar `from app.features.clientes.models import Cliente` (ya existe, D1). Verificar que NO se duplique la tabla `cliente` ni se cree migración nueva.
- [x] 1.4 Crear `backend/app/features/clientes/dependencies.py` solo si hace falta una dependencia propia (p. ej. cargar el cliente por `{id}` con 404); si no, dejar el archivo mínimo.

## 2. Backend — lógica de negocio (service.py)

- [x] 2.1 `crear_cliente(db, datos)`: insertar el cliente; traducir `IntegrityError`/colisión de `dni` a un error de dominio (`DniDuplicado`) → `409` (RN-03, D3).
- [x] 2.2 `obtener_cliente(db, id)`: devolver el cliente o lanzar `ClienteNoEncontrado` → `404`.
- [x] 2.3 `editar_cliente(db, id, datos)`: 404 si no existe; aplicar cambios; si el nuevo `dni` colisiona con **otro** cliente → `DniDuplicado` → `409` (D3).
- [x] 2.4 `listar_clientes(db, search, page)`: si hay `search`, filtrar por `nombre ILIKE %search%` **o** `dni` coincidente (SQL parametrizado); paginar por `page` (offset/limit). Sin `search`, devolver la página completa. (RF-07, D6)
- [x] 2.5 Definir excepciones de dominio (`DniDuplicado`, `ClienteNoEncontrado`) siguiendo el patrón de `usuarios/service.py`.

## 3. Backend — router.py y enganche (skill `seguridad-endpoint`)

- [x] 3.1 Crear `router = APIRouter(prefix="/clientes", tags=["clientes"])`.
- [x] 3.2 `GET /clientes` → `Depends(get_current_user)` (lectura amplia, RN-08); query params `search` y `page`; responde `200` con la lista paginada de `ClienteResponse`. (RF-07)
- [x] 3.3 `GET /clientes/{id}` → `Depends(get_current_user)`; `200`/`404`. (RF-06)
- [x] 3.4 `POST /clientes` → guard de rol ABOGADO+SOCIO (`require_roles`/patrón existente, D4); `201` con `ClienteResponse`; `409` DNI duplicado; `422` payload inválido; `401`/`403` según auth/rol. (RF-05)
- [x] 3.5 `PUT /clientes/{id}` → guard de rol ABOGADO+SOCIO; `200`/`404`; `409` DNI ya usado por otro cliente. (RF-06)
- [x] 3.6 Aplicar `@limiter.limit("100/minute")` en las rutas siguiendo el patrón de `usuarios/router.py` (param `request: Request`).
- [x] 3.7 Enganchar el router en `backend/app/main.py`: `app.include_router(clientes_router, prefix="/api/v1")`.
- [x] 3.8 Cierre de seguridad (skill `seguridad-endpoint`): verificar por endpoint auth por cookie JWT, CSRF double-submit (heredado del middleware en `POST`/`PUT`), RBAC (lectura amplia en `GET`; mutaciones ABOGADO+SOCIO), rate limiting y validación Pydantic.

## 4. Backend — tests (cobertura ≥ 80%, base sintética · Ley 25.326)

- [x] 4.1 Crear `backend/tests/features/clientes/` con fixtures de usuario SOCIO y ABOGADO y datos de cliente **sintéticos** (reutilizar `conftest.py`/fixtures existentes).
- [x] 4.2 `POST /clientes`: 201 alta válida, 409 DNI duplicado, 422 payload inválido (sin nombre/dni, email mal formado), 401 sin sesión, 403 sin CSRF. Verificar que `cuil` y `domicilio_real*` se persisten.
- [x] 4.3 `GET /clientes/{id}`: 200 existente (autenticado), 404 inexistente, 401 sin sesión.
- [x] 4.4 `PUT /clientes/{id}`: 200 edición válida, 404 inexistente, 409 al cambiar a un DNI de otro cliente.
- [x] 4.5 `GET /clientes?search=`: búsqueda por nombre (parcial, case-insensitive) y por DNI; verificar paginación con `page`.
- [x] 4.6 Ejecutar `pytest` con cobertura y confirmar ≥ 80% en la feature. (Nota: los tests requieren PostgreSQL en Docker — psycopg2 no corre en Windows nativo. Verificar con `docker compose up` + `docker compose exec backend pytest tests/features/clientes/ --cov=app/features/clientes`.)

## 5. Frontend — feature clientes (vertical slice · skill `feature-scaffold`)

- [x] 5.1 Crear `frontend/src/features/clientes/types.ts` (`Cliente`, `ClienteCreate`, `ClienteUpdate`).
- [x] 5.2 Crear `frontend/src/features/clientes/api.ts` sobre `shared/http` (`listar`, `obtener`, `crear`, `editar`) — el cliente ya inyecta CSRF y `credentials:'include'`.
- [x] 5.3 Crear `hooks/` (p. ej. `useClientes`) para cargar/buscar y mutar la lista.
- [x] 5.4 Crear `components/` (formulario de admisión con nombre, DNI, CUIL, contacto y domicilio real desglosado; tabla/listado con buscador por nombre/DNI) y la `page`.
- [x] 5.5 Montar la ruta en el router de `app/` protegida por sesión (todo usuario autenticado puede entrar y leer). (Las rutas `/clientes` y `/clientes/nuevo` ya estaban en `App.tsx` con `RequireAuth`.)
- [x] 5.6 Mensajes claros en español (AR) y manejo de errores (409 DNI duplicado, 404, 422).

## 6. Documentación y trazabilidad (regla SDD)

- [x] 6.1 Actualizar `docs/04-api/contratos-api.md`: corregir el body de `POST /clientes` para incluir `cuil` y `domicilio_real` (+ `_cp`/`_localidad`/`_provincia` y `domicilio_coincide_dni`) (desvío D2) y corregir la etiqueta de `GET /clientes?search=` a RF-07 (figura como RF-06).
- [x] 6.2 Actualizar `docs/changemap.md`: filas RF-05 / RF-06 / RF-07 (feature `clientes`) → estado y Rama/PR; agregar línea al changelog y registrar el desvío D2.
- [x] 6.3 Verificación manual end-to-end: ABOGADO crea/edita/busca clientes; alta con DNI duplicado devuelve 409; lectura disponible para todo autenticado. (Requiere `docker compose up --build` con DB corriendo. Verificar con Swagger en `:8000/docs` y la UI en `:3000/clientes`.)
