## Context

La autenticación ya está implementada y archivada (change `auth`): cookies JWT HttpOnly, refresh revocable, CSRF double-submit middleware, RBAC (`require_socio` / `require_roles`), rate limiting (SlowAPI) y hashing bcrypt (`hash_password`). El modelo ORM `Usuario` vive en `backend/app/features/auth/models.py` y la tabla `usuario` ya existe en la migración `001_esquema_base_inicial.py` con todos los campos necesarios (`email` único, `password_hash`, `nombre`, `rol`, `area` nullable, `matricula` nullable, `activo` con default `true`, `creado_en`).

Este change agrega el **ABM de usuarios** (RF-03, RN-07, UC-13) como una feature vertical-slice nueva (`features/usuarios/`) que **consume** la infraestructura transversal de seguridad sin recrearla. No hay esquema nuevo ni migración.

Restricciones: feature-first (ADR-0009), backend stateless, español en código y artefactos, cobertura de tests ≥ 80%, base sintética en tests, nunca exponer ni loguear `password_hash`.

## Goals / Non-Goals

**Goals:**
- CRUD de usuarios (`GET/POST /usuarios`, `PUT/PATCH /usuarios/{id}`) con baja lógica.
- Mutaciones exclusivas de SOCIO; lectura amplia para todo autenticado (RN-08).
- Reutilizar guards existentes: `get_current_user`, `require_socio`, CSRF middleware, `limiter`, `hash_password`.
- Frontend: feature `usuarios/` solo-SOCIO (listado + alta + edición + toggle activación).
- Tests backend ≥ 80% cubriendo RBAC, CSRF, unicidad de email, baja lógica y autodesactivación.

**Non-Goals:**
- Reimplementar autenticación, login, refresh, cookies o CSRF (ya existe).
- Recuperación/reseteo de contraseña por el propio usuario, cambio de contraseña self-service, invitaciones por email (fuera de RF-03).
- Borrado físico de usuarios (la baja es lógica).
- Nueva migración o cambios de esquema.

## Decisions

### D1 — Reutilizar el modelo `Usuario` de `features/auth/`, no duplicarlo
La feature `usuarios` importa `from app.features.auth.models import Usuario`. Definir un segundo modelo sobre la misma tabla rompería el registro de SQLAlchemy y violaría DRY. El acoplamiento entre features se acepta porque `Usuario` es la entidad de identidad compartida (auth la necesita para autenticar; usuarios la administra). Si más adelante molesta el import cruzado, se promueve `Usuario` a `shared/` — fuera de alcance ahora.
- _Alternativa descartada_: redefinir el modelo en `usuarios/models.py` → colisión de tabla y doble fuente de verdad.

### D2 — Contraseña inicial provista por el SOCIO en el alta
El contrato de API (`docs/04-api/contratos-api.md`) NO muestra `password` en el body de `POST /usuarios`, pero el modelo exige `password_hash NOT NULL` y no hay flujo de invitación por email en el MVP. Decisión: el `POST /usuarios` acepta un campo `password` obligatorio, que el servicio hashea con `hash_password`. Es la opción más simple y autocontenida; queda registrada como desvío menor de la spec de API (la spec de API se actualiza en el mismo PR de implementación, regla SDD).

**Validación de complejidad**: NO se inventa una política ad-hoc en `usuarios`. Hoy NO existe validación centralizada de complejidad de password en `auth` (solo `Field(min_length=1)` en `LoginRequest`; no hay flujo de registro ni de cambio de password). `usuarios` toma `password` con la misma validación mínima (`min_length=1`) y la política de complejidad queda como **deuda** registrada en el changemap, a resolver con una validación compartida cuando se implemente registro/cambio de password — momento en que `usuarios` debe reutilizarla.
- _Alternativa descartada_: generar contraseña temporal aleatoria y mostrarla una vez → requiere UI de "copiar credencial" y manejo de primer login; mayor superficie, innecesario para el MVP.
- _Alternativa descartada_: dejar `password_hash` nulo hasta el primer login → contradice el `NOT NULL` y abre cuentas sin credencial.

### D3 — RBAC por dependencia de ruta, reutilizando `require_socio`
Las mutaciones declaran `dependencies=[Depends(require_socio)]` (o el usuario tipado vía `Depends(require_socio)` cuando se necesita el actor, p. ej. para la regla de autodesactivación). `GET /usuarios` usa solo `Depends(get_current_user)` (lectura amplia, RN-08). No se crea lógica de RBAC nueva.

### D4 — CSRF y rate limiting heredados, sin código nuevo
El `CSRFMiddleware` ya intercepta toda mutación bajo `/api/v1` (salvo `/auth/login`), así que `POST/PUT/PATCH /usuarios` quedan protegidos automáticamente. El router puede aplicar `@limiter.limit("100/minute")` siguiendo el patrón de `auth/router.py`. No se toca middleware ni configuración global.

### D5 — Regla de negocio: un SOCIO no puede autodesactivarse
`PATCH /usuarios/{id}` con `activo=false` sobre el propio `id` del actor responde `409`. Evita que el último administrador se bloquee. Se valida en `service.py` comparando `id` objetivo con `current_user.id`. (No se exige "al menos un SOCIO activo" global en el MVP por simplicidad; queda como posible regla futura — ver Open Questions.)

### D6 — Coherencia rol/área en servicio
Regla derivada del modelo (`area` nullable, comentario "NULL para socios"): si `rol == ABOGADO` el `area` es obligatoria; si `rol == SOCIO` puede ser nula. Se valida en el servicio (no solo Pydantic) para alta y edición, devolviendo `422`/`400` ante incoherencia.

### D7 — Schemas Pydantic separados de entrada y salida
`UsuarioCreate` (incluye `password`), `UsuarioUpdate` (sin password ni email — email inmutable post-alta en el MVP), `UsuarioActivacion` (`activo: bool`) y `UsuarioResponse` (sin `password_hash`). El `UsuarioResponse` se construye explícitamente desde el ORM para garantizar que el hash nunca se serialice.

### D8 — Frontend: feature vertical-slice solo-SOCIO
`frontend/src/features/usuarios/` con `api.ts` (sobre `shared/http`, que ya inyecta CSRF y `credentials:'include'`), `types.ts`, `hooks/`, `components/` y una `page`. La ruta se monta protegida por rol leyendo el `rol` del `AuthContext`; ABOGADO no ve el ítem de navegación ni puede entrar.

## Risks / Trade-offs

- **[Desvío de spec: `password` no figura en el contrato de API]** → Se actualiza `docs/04-api/contratos-api.md` en el mismo PR de implementación (regla SDD) y se registra en el changemap.
- **[Import cruzado entre features `usuarios` → `auth`]** → Aceptado para la entidad de identidad compartida (D1); documentado. Mitigación futura: mover `Usuario` a `shared/`.
- **[El frontend oculta la pantalla pero la autorización real es del backend]** → El control de acceso es server-side (`require_socio`); el ocultamiento en frontend es UX, no seguridad. Los tests backend cubren el `403` para ABOGADO.
- **[No exponer `password_hash`]** → Mitigación: `UsuarioResponse` sin el campo + test que verifica que la respuesta no lo contiene.
- **[Validación de email duplicado con carrera]** → Se confía en la restricción `unique` de la tabla; el servicio captura `IntegrityError` y traduce a `409`.

## Open Questions

- ¿Se debe garantizar "al menos un SOCIO activo" a nivel global (además de impedir autodesactivación)? Propuesto: fuera del MVP; D5 cubre el caso más común.
- ¿La edición debería permitir cambiar el `email`? Decisión MVP: no (email inmutable). Revisar si el estudio lo pide.
- ¿Hace falta endpoint de cambio/reseteo de contraseña? Fuera de RF-03; se evaluará en un change aparte.
- **[Riesgo de seguridad documentado]** El SOCIO que crea un usuario define y por lo tanto conoce la contraseña inicial del ABOGADO. Sin un "forced password change" en el primer login, esa credencial inicial queda conocida por un tercero. No es bloqueante para el MVP, pero es un riesgo real (no solo prolijidad): debería resolverse con un cambio de contraseña obligatorio en el primer acceso. Queda como deuda/Open Question a tratar junto con el endpoint de cambio de contraseña.
