---
name: seguridad-endpoint
description: >-
  Checklist de seguridad obligatorio antes de cerrar cualquier endpoint nuevo en el backend de
  Iuris: autenticación por cookie JWT (HttpOnly/Secure/SameSite), CSRF double-submit, RBAC
  SOCIO/ABOGADO, rate limiting y validación con Pydantic. Usá esta skill SIEMPRE que se cree o
  modifique un endpoint o router, se agregue una ruta, o antes de dar por terminada una feature de
  backend — aunque no se mencione la palabra "seguridad". Es exactamente el combo que se olvida a
  la décima feature: que falte el guard de rol, que un POST no valide CSRF, que un endpoint quede
  sin auth. Consultá esta skill como paso de cierre de todo router nuevo.
---

# seguridad-endpoint — checklist de cierre de cada endpoint en Iuris

Cada endpoint nuevo del backend tiene que cumplir el mismo combo de seguridad. Individualmente cada
pieza es simple; el problema es que es fácil olvidarse de UNA a la décima feature (típicamente el
guard de rol o el CSRF en un PATCH). Esta skill es el chequeo que se corre **antes de dar por
cerrado cualquier router nuevo**.

**Fuente de verdad:** la spec de seguridad y despliegue del repo (`docs/.../seguridad-y-despliegue.md`)
y los `CLAUDE.md`. Esta skill resume los invariantes; si hay conflicto, gana la spec. Leé las
dependencias reales en `app/core/security` en vez de inventar nombres.

---

## El combo (lo que TODO endpoint debe cumplir)

### 1. Autenticación por cookie JWT
- El token de acceso (JWT, ~15 min) viaja en una cookie **HttpOnly + Secure + SameSite**, no en un
  header `Authorization` ni en localStorage.
- El refresh token (~7 días) es **revocable** vía la tabla `refresh_token` (revocación de sesión);
  no es un JWT stateless eterno.
- El endpoint lee el usuario actual mediante la dependencia de auth (p. ej. `get_current_user`),
  que valida la cookie. **Ningún endpoint operativo queda sin esta dependencia**, salvo los
  públicos explícitos (login, refresh, health).

### 2. CSRF double-submit
- Como la auth es por cookie, los métodos que **cambian estado** (`POST`, `PUT`, `PATCH`, `DELETE`)
  deben validar el token CSRF con el esquema **double-submit cookie**: el valor de la cookie CSRF
  debe coincidir con el enviado en el header por el cliente.
- `GET`/`HEAD` están exentos (no mutan estado).
- El frontend manda el header CSRF a través del cliente HTTP de `shared/` — si alguien hace `fetch`
  crudo, se saltea esto: revisar.

### 3. RBAC — SOCIO vs ABOGADO
- Dos roles, todos abogados: **SOCIO** (acceso total, incluida la gestión de usuarios) y **ABOGADO**
  (acceso operativo total, **sin** gestión de usuarios).
- Endpoints de **gestión de usuarios** (`/usuarios`, ABM, RF-07/RN-07) → **solo SOCIO**.
- Endpoints operativos → ambos roles.
- Se aplica con una dependencia de rol (p. ej. `require_socio` / `require_roles(...)`), no con un
  `if` suelto adentro del handler. El guard va en la firma del endpoint para que sea explícito y
  testeable.

### 4. Rate limiting
- Aplicar rate limiting, con énfasis en los endpoints sensibles: **login** y refresh sobre todo
  (anti fuerza bruta). Confirmar el límite configurado en la spec.

### 5. Validación de entrada
- Todo body entra y sale por **schemas Pydantic** (de la feature). Nada de leer `request.json()`
  crudo. Esto valida tipos y evita over-posting.

### 6. Humano en el bucle (si aplica al dominio)
- Regla no negociable RN-10: **ninguna comunicación al cliente se envía automáticamente**. Los
  endpoints de `comunicaciones` generan/persisten **borradores** que el abogado revisa y aprueba;
  no disparan el envío por sí solos. Si el endpoint que estás cerrando toca comunicaciones, verificá
  que respete esto.

---

## Patrón de un endpoint que muta estado (ilustrativo)

```python
@router.patch("/{id}", response_model=schemas.CasoOut)
async def actualizar_caso(
    id: int,
    payload: schemas.CasoUpdate,                      # (5) validación Pydantic
    user = Depends(get_current_user),                 # (1) auth por cookie
    _csrf = Depends(verify_csrf),                      # (2) CSRF en método mutante
    _rol = Depends(require_roles("SOCIO", "ABOGADO")), # (3) RBAC explícito
    svc: service.CasoService = Depends(),
):
    return await svc.actualizar(id, payload, actor=user)
```

Para un endpoint de gestión de usuarios, el guard sería `Depends(require_socio)`.

---

## Checklist antes de cerrar el router

- [ ] **Auth:** ¿el endpoint exige sesión válida por cookie? (o está justificadamente en la lista de públicos)
- [ ] **CSRF:** si es `POST/PUT/PATCH/DELETE`, ¿valida CSRF double-submit?
- [ ] **RBAC:** ¿tiene el guard de rol correcto? (gestión de usuarios = solo SOCIO; operativo = ambos)
- [ ] **Rate limiting:** ¿está cubierto, especialmente si es login/refresh?
- [ ] **Validación:** ¿entra y sale por schemas Pydantic, sin leer el body crudo?
- [ ] **Humano en el bucle:** si toca comunicaciones, ¿no envía nada automáticamente? (RN-10)
- [ ] **Tests:** ¿hay un test que verifique al menos el rechazo por falta de auth y por rol insuficiente?
- [ ] Lo alineé con `seguridad-y-despliegue.md`; ante conflicto, gana la spec.
