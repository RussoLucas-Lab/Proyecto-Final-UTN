## Why

Iuris no tiene todavía un entorno reproducible donde levantar la plataforma. Antes de implementar cualquier feature de negocio (auth, clientes, casos, etc.) hace falta el **esqueleto del monorepo** y un `docker compose up` que ponga de pie los cuatro servicios (frontend, backend, db, n8n). Es el prerequisito de todo el MVP (changemap, fila RNF-07) y materializa el criterio de aceptación de RNF-07 ("el sistema levanta con `docker compose up`") y RNF-13 (`GET /health`).

## What Changes

- **Esqueleto del monorepo feature-first (ADR-0009).** Se crea el armazón mínimo de `backend/app/` (`main.py`, `core/`, `shared/`, `features/`) y `n8n/workflows/`. El `frontend/` ya tiene su scaffold Vite/React; solo se lo integra al compose. No se implementa ninguna feature de negocio.
- **`docker-compose.yml`** que orquesta cuatro servicios: `frontend` (React/Vite), `backend` (FastAPI/Uvicorn), `db` (PostgreSQL) y `n8n`. Un `Dockerfile` por servicio aplicable (backend, frontend).
- **Redes privadas y volúmenes nombrados.** Solo `frontend` (y el backend para desarrollo/Swagger) se exponen al host; `db` y `n8n` quedan en la red privada. Persistencia de Postgres y n8n por volúmenes nombrados.
- **Configuración por variables de entorno sin secretos en el repo.** Se agrega `.env.example` (plantilla, derivada de §1 de `07-seguridad-y-despliegue/`) y se asegura que `.env` esté ignorado por git.
- **`GET /health`** en el backend FastAPI que devuelve `{"status":"UP"}` (RNF-13). Backend stateless, sin auth ni IA.
- **Smoke test documentado**: `docker compose up --build` levanta los servicios y `curl http://localhost:8000/health` responde `{"status":"UP"}`.

Fuera de alcance (changes posteriores, NO se tocan aquí): migraciones Alembic + esquema base (RNF-09), seed del ciclo de vida (ADR-0008), y cualquier feature de negocio (auth, clientes, casos, documentos, comunicaciones, telegramas, vencimientos, backups). Tampoco se implementa JWT/CSRF/RBAC/rate limiting: el esqueleto solo deja `core/` preparado para alojarlos más adelante.

## Capabilities

### New Capabilities
- `plataforma-infraestructura`: armazón del monorepo, orquestación con docker-compose de los cuatro servicios (frontend, backend, db, n8n) con redes privadas, volúmenes nombrados y configuración por variables de entorno sin secretos en el repo, más el endpoint `GET /health` del backend.

### Modified Capabilities
<!-- Ninguna: es el primer change del proyecto; no existen specs previas en openspec/specs/. -->

## Impact

- **Nuevos archivos / directorios**: `docker-compose.yml`, `.env.example`, `.gitignore` (raíz, si no cubre `.env`), `backend/Dockerfile`, `backend/app/main.py`, `backend/app/core/` (config), `backend/app/shared/`, `backend/app/features/` (placeholders), `backend/requirements.txt` o `pyproject.toml`, `frontend/Dockerfile`, `n8n/workflows/` (placeholder).
- **APIs**: nuevo endpoint público `GET /health` → `{"status":"UP"}` (sin auth). No se modifican otros contratos (`docs/04-api/contratos-api.md` no cambia).
- **Dependencias**: backend FastAPI + Uvicorn + Pydantic Settings; imágenes Docker oficiales de `postgres` y `n8nio/n8n`. Frontend usa pnpm (ya scaffoldeado).
- **Sistemas**: Docker / Docker Compose como entorno de ejecución reproducible (ADR-0001, `03-arquitectura/`). R2 y OpenAI quedan fuera (externos / posteriores).
- **Changemap**: al implementarse, la fila RNF-07 ("Plataforma / Infraestructura") pasa a 🟡/✅.
