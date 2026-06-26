## 1. Backend — scaffold de la feature (vertical slice, ADR-0009)

- [x] 1.1 Crear `backend/app/features/usuarios/__init__.py` y la carpeta de la feature.
- [x] 1.2 Crear `backend/app/features/usuarios/schemas.py` con `UsuarioCreate` (incluye `password: str` y `EmailStr`), `UsuarioUpdate` (sin password ni email), `UsuarioActivacion` (`activo: bool`) y `UsuarioResponse` (sin `password_hash`). NO inventar una política de complejidad ad-hoc en este schema: hoy NO existe validación centralizada de complejidad de password en `auth` (solo `Field(min_length=1)` en `LoginRequest`). Usar la misma validación mínima existente (`min_length=1`) y dejar la política de complejidad como deuda registrada (ver 6.4) — cuando exista la validación centralizada (registro/cambio de password), reutilizarla acá.
- [x] 1.3 NO crear `models.py`: reutilizar `from app.features.auth.models import Usuario` (D1). Verificar que NO se duplique la tabla `usuario` ni se cree migración nueva.
- [x] 1.4 Crear `backend/app/features/usuarios/dependencies.py` solo si hace falta una dependencia propia (p. ej. cargar el usuario por `{id}` con 404); si no, dejar el archivo mínimo.

## 2. Backend — lógica de negocio (service.py)

- [x] 2.1 `crear_usuario(db, datos)`: validar coherencia rol/área (ABOGADO requiere `area`; SOCIO permite nula, D6), hashear `password` con `hash_password`, insertar con `activo=true`; traducir `IntegrityError` de email duplicado a un error de dominio → `409`.
- [x] 2.2 `editar_usuario(db, id, datos)`: 404 si no existe; aplicar misma validación rol/área; actualizar `nombre`, `rol`, `area`, `matricula` (no toca password ni email).
- [x] 2.3 `cambiar_activacion(db, id, activo, actor)`: 404 si no existe; si `activo=false` y `id == actor.id` → error de dominio (autodesactivación prohibida, D5) → `409`; aplicar baja/alta lógica sin borrar el registro.
- [x] 2.4 `listar_usuarios(db)`: devolver todos los usuarios (la serialización a `UsuarioResponse` garantiza que no se exponga `password_hash`).
- [x] 2.5 Definir excepciones de dominio (`EmailDuplicado`, `AutodesactivacionProhibida`, `UsuarioNoEncontrado`) siguiendo el patrón de `auth/service.py`.

## 3. Backend — router.py y enganche

- [x] 3.1 Crear `router = APIRouter(prefix="/usuarios", tags=["usuarios"])`.
- [x] 3.2 `GET /usuarios` → `dependencies=[Depends(get_current_user)]` (lectura amplia, RN-08); responde `200` con `list[UsuarioResponse]`.
- [x] 3.3 `POST /usuarios` → `Depends(require_socio)`; `201` con `UsuarioResponse`; `409` email duplicado; `422` payload inválido; `403` si no es SOCIO.
- [x] 3.4 `PUT /usuarios/{id}` → `Depends(require_socio)`; `200`/`404`/`403`.
- [x] 3.5 `PATCH /usuarios/{id}` → `Depends(require_socio)` recibiendo el actor para la regla de autodesactivación; `200`/`404`/`409`/`403`.
- [x] 3.6 Aplicar `@limiter.limit("100/minute")` en las rutas siguiendo el patrón de `auth/router.py` (param `request: Request`).
- [x] 3.7 Enganchar el router en `backend/app/main.py`: `app.include_router(usuarios_router, prefix="/api/v1")`.
- [x] 3.8 Cierre de seguridad (skill `seguridad-endpoint`): verificar por endpoint auth por cookie JWT, CSRF double-submit (heredado del middleware), RBAC SOCIO en mutaciones, rate limiting y validación Pydantic. Confirmar que `password_hash` no se serializa en ninguna respuesta.

## 4. Backend — tests (cobertura ≥ 80%, base sintética)

- [x] 4.1 Crear `backend/tests/features/usuarios/` con fixtures de usuario SOCIO y ABOGADO (reutilizar fixtures de `tests/fixtures/` y `conftest.py` existentes).
- [x] 4.2 `GET /usuarios`: 200 autenticado, 401 sin sesión, y assert de que la respuesta NO contiene `password_hash`.
- [x] 4.3 `POST /usuarios`: 201 alta válida (SOCIO), 409 email duplicado, 422 payload inválido, 403 ABOGADO, 403 sin CSRF.
- [x] 4.4 `PUT /usuarios/{id}`: 200 edición válida, 404 inexistente, 403 ABOGADO, validación rol/área.
- [x] 4.5 `PATCH /usuarios/{id}`: 200 desactivar/reactivar otro, 409 autodesactivación del SOCIO, 404 inexistente, 403 ABOGADO; assert de baja lógica (registro persiste, `activo=false`).
- [x] 4.6 Verificar que la contraseña se guarda hasheada (no texto plano) y que `verify_password` valida la inicial.
- [x] 4.7 Ejecutar `pytest` con cobertura y confirmar ≥ 80% en la feature.

## 5. Frontend — feature usuarios (vertical slice, solo SOCIO)

- [x] 5.1 Crear `frontend/src/features/usuarios/types.ts` (`Usuario`, `UsuarioCreate`, `UsuarioUpdate`).
- [x] 5.2 Crear `frontend/src/features/usuarios/api.ts` sobre `shared/http` (`listar`, `crear`, `editar`, `cambiarActivacion`) — el cliente ya inyecta CSRF y `credentials:'include'`.
- [x] 5.3 Crear `hooks/` (p. ej. `useUsuarios`) para cargar y mutar la lista.
- [x] 5.4 Crear `components/` y la `page` con listado (nombre, email, rol, área, matrícula, estado activo) + acciones alta/edición/toggle activación.
- [x] 5.5 Montar la ruta en el router de `app/` protegida solo-SOCIO (leer `rol` del `AuthContext`); ocultar el ítem de navegación para ABOGADO.
- [x] 5.6 Mensajes claros en español (AR) y manejo de errores (409 email duplicado, 403, 422).

## 6. Documentación y trazabilidad (regla SDD)

- [x] 6.1 Actualizar `docs/04-api/contratos-api.md`: agregar el campo `password` (obligatorio) al body de `POST /usuarios` (desvío D2) y confirmar códigos de error (409/422/403/404). Aclarar que la validación de `password` reutiliza la validación centralizada de auth cuando exista; hoy es solo `min_length=1` (sin política de complejidad).
- [x] 6.2 Actualizar `docs/changemap.md`: fila RF-03 (feature `usuarios`) → estado y Rama/PR; agregar línea al changelog y registrar el desvío D2 en la sección de desvíos.
- [x] 6.4 Registrar en `docs/changemap.md` la **DEUDA**: no existe validación centralizada de complejidad de password (registro/cambio de password aún no implementados); `usuarios` toma `password` con `min_length=1` y la política de complejidad queda pendiente de una validación compartida. NO resolver inventando una regla ad-hoc en el router/schema de usuarios.
- [ ] 6.3 Verificación manual end-to-end: SOCIO crea/edita/desactiva; ABOGADO recibe 403 en mutaciones y no ve la pantalla; login del nuevo usuario con la contraseña inicial.
