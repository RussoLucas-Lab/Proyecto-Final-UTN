# Convenciones de Desarrollo

## Control de versiones (Git)

**Ramas**
- `main` — estable, desplegable.
- `develop` — integración.
- `feature/<id>-<slug>` — p.ej. `feature/RF-12-drag-drop-documentos`.
- `fix/<slug>`, `docs/<slug>`, `chore/<slug>`.

**Commits — Conventional Commits**
```
<tipo>(<ámbito>): <descripción>   [refs <ID-spec>]
```
Tipos: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`.
Ejemplo: `feat(casos): alta de caso con historial [refs RF-07, RN-05]`.

> Todo commit funcional referencia el RF/RN/UC que implementa (RNF-09).

**Pull Requests**
- Vinculan su spec (RF/RN/UC/US).
- Requieren al menos una revisión y pruebas en verde.

## Backend (Python / FastAPI)
- Estilo: **PEP 8**, formateo con **Black**, imports con **isort**, linting con **ruff**.
- Tipado estático con type hints; validación con Pydantic.
- Nombres: `snake_case` para funciones/variables, `PascalCase` para clases.
- **Organización feature-first** (vertical slice): una carpeta por feature, autocontenida; lo transversal en `core/`/`shared/`. (ADR-0009)
```
backend/
  app/
    main.py
    core/         # config, seguridad, DB, deps compartidas, errores, middleware
    shared/       # utilidades / modelos base
    features/
      auth/  usuarios/  clientes/  casos/  documentos/
      comunicaciones/  telegramas/  vencimientos/  backups/
        # cada una: router.py · service.py · schemas.py · models.py · dependencies.py
  seeds/
  tests/          # espeja features/
  alembic/
```

## Frontend (React)
- Componentes en `PascalCase`; hooks en `useCamelCase`.
- Formateo **Prettier**, linting **ESLint**.
- **Organización feature-first** (vertical slice): una carpeta por feature; lo transversal en `shared/` y el armazón en `app/`. (ADR-0009)
```
frontend/src/
  app/          # router, providers, layout global
  shared/       # cliente HTTP (credentials+CSRF), UI base, hooks, utils, tipos
  features/
    auth/  dashboard/  clientes/  casos/  documentos/
    comunicaciones/  telegramas/  vencimientos/  usuarios/  respaldos/
      # cada una: components/ · hooks/ · api.ts · types.ts · pages/
```

## API
- Versionado bajo `/api/v1`.
- Recursos en plural y `kebab-case` cuando aplique.
- Errores con estructura uniforme (ver contratos-api.md).

## Pruebas
- Backend: `pytest`. Frontend: testing de componentes.
- Cada RF "Must" debe tener al menos un test que valide su criterio de aceptación.
- Las pruebas usan la base de datos sintética (ADR-0004).

## Documentación
- Las specs viven en este repositorio y se actualizan **antes** de codear (SDD).
- Si código y spec divergen, gana la spec o se actualiza la spec primero.

## Seguridad, migraciones y testing (resumen)

Los requisitos detallados están en `07-seguridad-y-despliegue/`. Puntos que el código debe cumplir:
- Autenticación por **cookies seguras** (HttpOnly/Secure/SameSite) con JWT access (15 min) + refresh (7 días) revocable; **CSRF** en mutaciones.
- Contraseñas con **bcrypt/argon2**; **rate limiting** (login y API); **headers** de seguridad; HTTPS en producción.
- **Consultas parametrizadas** (nunca concatenar SQL); validación de entradas; errores internos no expuestos.
- Migraciones con **Alembic** (nada de cambios manuales en producción).
- **Cobertura ≥ 80%**; endpoint `GET /health`; backend **stateless**.
- Logs sin datos sensibles (ni contraseñas, ni tokens, ni datos personales).
