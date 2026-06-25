---
name: feature-scaffold
description: >-
  Genera el esqueleto de una feature nueva en Iuris respetando la organización feature-first /
  vertical slice del ADR-0009: en backend FastAPI (router.py · service.py · schemas.py · models.py ·
  dependencies.py) y en frontend React (components/ · hooks/ · api.ts · types.ts · pages/), y la
  engancha en main.py / el router de la app. Usá esta skill SIEMPRE que se vaya a crear una feature
  o módulo nuevo, agregar un recurso, armar la carpeta de algo, crear el router de un recurso nuevo,
  o sumar una pantalla/módulo nuevo en el frontend — aunque no se diga la palabra "scaffold". Su
  objetivo es que NO se improvise una estructura distinta cada vez (ej. carpetas globales api/,
  models/, services/ en vez de vertical slice, o imports cruzados entre features).
---

# feature-scaffold — esqueleto de una feature en Iuris

En Iuris **el código se organiza por feature, no por capa** (ADR-0009, "vertical slice"). El
problema que esta skill previene es el más común cuando se generan archivos en lote: que cada
feature termine con una estructura distinta, o que aparezcan carpetas globales `api/`, `models/`,
`services/` que dispersan una misma funcionalidad en cinco lugares y rompen la trazabilidad
spec ↔ feature ↔ código.

**Antes de generar nada:** leé el `CLAUDE.md` correspondiente (backend o frontend) y el
`ADR-0009`. Si hay una spec de la feature en `docs/`, leéla primero — la spec gana (SDD). El
esqueleto se ajusta a la spec, no al revés.

## Regla de oro: sin imports cruzados entre features

Una feature NO importa directamente de otra. Si dos features necesitan compartir algo, eso va a
`core/`/`shared/` (backend) o `src/shared/` (frontend), o se resuelve por interfaz. Esto es lo que
mantiene cada feature autocontenida y testeable de forma aislada.

---

## Backend (FastAPI)

Cada feature vive en `app/features/<feature>/` con estos cinco archivos, cada uno con una
responsabilidad única:

```
app/features/<feature>/
  __init__.py
  router.py        # define APIRouter, declara los endpoints HTTP, delega en service
  service.py       # lógica de negocio; única capa que toca la DB / orquesta
  schemas.py       # Pydantic: requests y responses (validación de entrada/salida)
  models.py        # modelos SQLAlchemy de la feature
  dependencies.py  # dependencias propias de la feature (Depends), p. ej. cargar el recurso por id
```

Lo transversal NO va acá: config, seguridad, sesión de DB, dependencias y utilidades compartidas
viven en `app/core/` y `app/shared/`. Los endpoints `/internal` que consume n8n viven **dentro de
la feature que corresponde** (no en una feature "n8n" aparte).

**Plantilla de `router.py`** (ajustar nombres a la feature y a las dependencias reales de `core/`):

```python
from fastapi import APIRouter, Depends, status
from app.core.security import get_current_user          # auth por cookie (ver skill seguridad-endpoint)
from . import schemas, service
from .dependencies import get_<recurso>_or_404

router = APIRouter(prefix="/<feature>", tags=["<feature>"])

@router.get("", response_model=list[schemas.<Recurso>Out])
async def listar(user = Depends(get_current_user), svc: service.<Feature>Service = Depends()):
    return await svc.listar()

@router.post("", response_model=schemas.<Recurso>Out, status_code=status.HTTP_201_CREATED)
async def crear(payload: schemas.<Recurso>Create, user = Depends(get_current_user),
                svc: service.<Feature>Service = Depends()):
    return await svc.crear(payload, actor=user)
```

**Enganche en `app/main.py`** — importar el router de la feature e incluirlo:

```python
from app.features.<feature>.router import router as <feature>_router
app.include_router(<feature>_router, prefix="/api")
```

**Tests:** la carpeta `tests/` **espeja** `features/`. Por cada feature nueva, creá
`tests/features/<feature>/` con al menos un test del happy path del router.

---

## Frontend (React)

Cada feature vive en `src/features/<feature>/`:

```
src/features/<feature>/
  components/   # componentes propios de la feature
  hooks/        # hooks de datos/estado de la feature
  api.ts        # llamadas HTTP de la feature (usa el cliente compartido de shared/)
  types.ts      # tipos TS de la feature (alineados al DBML y a los schemas del backend)
  pages/        # páginas/rutas de la feature
```

Lo transversal va a `src/shared/` (cliente HTTP con `credentials: 'include'` + header CSRF, UI base,
hooks y utils) y el armazón a `src/app/` (router, providers, layout global).

**Reglas clave del front:**
- `api.ts` usa el cliente HTTP de `shared/`, **no** hace `fetch` crudo (se perdería credentials+CSRF).
- `types.ts` se alinea al DBML y a los schemas del backend — no inventar nombres de campo.
- Enganchar la(s) página(s) en el router de `src/app/`, no crear un router paralelo en la feature.

---

## Checklist antes de dar por hecho el scaffold

- [ ] Leí el `CLAUDE.md` del lado correspondiente y la spec de la feature (si existe). La spec mandó.
- [ ] Backend: existen los 5 archivos en `app/features/<feature>/`, cada uno con su responsabilidad.
- [ ] El router quedó incluido en `app/main.py` con su prefix.
- [ ] No hay imports cruzados con otras features; lo compartido fue a `core/`/`shared/`.
- [ ] Los endpoints `/internal` (si los hay) están dentro de la feature, no aparte.
- [ ] Existe `tests/features/<feature>/` con al menos un test.
- [ ] Frontend: `components/ hooks/ api.ts types.ts pages/`; `api.ts` usa el cliente de `shared/`; las páginas se engancharon en el router de `src/app/`.
- [ ] Los tipos del front se alinean al DBML / schemas del backend.
- [ ] Si la feature expone endpoints que cambian estado, pasarlos por la skill **seguridad-endpoint** antes de cerrar.
