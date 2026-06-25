## 1. Esqueleto de directorios (ADR-0009)

- [x] 1.1 Crear `backend/app/` con `__init__.py`, `main.py` (instancia FastAPI), y subdirectorios `core/`, `shared/`, `features/` (cada uno con `__init__.py` y un `.gitkeep` donde haga falta)
- [x] 1.2 Crear `backend/app/core/config.py` con `Settings` (pydantic-settings) que lea las env vars del entorno (al menos `DATABASE_URL`, `LOG_LEVEL`)
- [x] 1.3 Crear `n8n/workflows/` con un `.gitkeep` (placeholder para WF-01/02/05, que llegan en changes posteriores)
- [x] 1.4 Verificar que NO se crean carpetas globales `services/`, `models/` ni `schemas/` en la raíz de `app/`

## 2. Dependencias y Dockerfiles

- [x] 2.1 Declarar dependencias del backend en `backend/requirements.txt` (`fastapi`, `uvicorn[standard]`, `pydantic-settings`)
- [x] 2.2 Crear `backend/Dockerfile` (Python slim, instala requirements, comando `uvicorn app.main:app --host 0.0.0.0 --port 8000`)
- [x] 2.3 Crear `frontend/Dockerfile` (Node + pnpm; instala con `pnpm install` y arranca `pnpm dev --host` en `:3000`)
- [x] 2.4 Verificar que `frontend/.gitignore` y `backend/.gitignore` ignoran `node_modules/` y artefactos; agregar/crear `.gitignore` en la raíz que ignore `.env`

## 3. docker-compose: servicios, redes y volúmenes

- [x] 3.1 Crear `docker-compose.yml` con los cuatro servicios: `frontend`, `backend`, `db` (imagen `postgres:16`), `n8n` (imagen `n8nio/n8n`)
- [x] 3.2 Definir una red privada del compose y conectar los cuatro servicios; el backend referencia la DB por hostname `db` (no `localhost`)
- [x] 3.3 Exponer al host solo `frontend:3000` y `backend:8000`; dejar `db` sin publicar puerto; publicar `n8n:5678` solo para desarrollo local (documentarlo)
- [x] 3.4 Definir volúmenes nombrados `db_data` (Postgres) y `n8n_data` (home de n8n) y montarlos en sus servicios
- [x] 3.5 Configurar `backend.depends_on: [db]` y un `healthcheck` del backend que consulte `GET /health`
- [x] 3.6 Inyectar la configuración de cada servicio desde el `.env` (env_file / variables), sin valores hardcodeados de credenciales

## 4. Variables de entorno (sin secretos en el repo)

- [x] 4.1 Crear `.env.example` en la raíz con las claves operativas activas (`DATABASE_URL`, `DB_USER`, `DB_PASSWORD`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `LOG_LEVEL`) con valores de ejemplo
- [x] 4.2 Incluir como placeholders comentados las claves de changes futuros (`JWT_SECRET`, `R2_*`, `N8N_WEBHOOK_URL`, `N8N_SHARED_SECRET`, `RATE_LIMIT`) alineadas con §1 de `07-seguridad-y-despliegue/`, marcando cuáles aún no se consumen
- [x] 4.3 Confirmar que `.env` está en `.gitignore` y que ningún secreto real queda versionado

## 5. Endpoint GET /health (RNF-13)

- [x] 5.1 Implementar `GET /health` en el backend que devuelva `200` con `{"status":"UP"}`, sin autenticación y sin tocar la base de datos
- [x] 5.2 Verificar en local (sin Docker) que `uvicorn app.main:app` arranca y `/health` responde `{"status":"UP"}`

## 6. Smoke test del stack completo

- [x] 6.1 Ejecutar `docker compose up --build` y verificar que los cuatro servicios arrancan y quedan saludables
- [x] 6.2 Ejecutar `curl http://localhost:8000/health` y confirmar respuesta `{"status":"UP"}` (criterio de aceptación RNF-07 + RNF-13)
- [x] 6.3 Verificar acceso al frontend en `http://localhost:3000` y al editor de n8n en `http://localhost:5678`
- [x] 6.4 Reiniciar el servicio `db` (sin `down -v`) y confirmar que el volumen `db_data` conserva el estado
- [x] 6.5 Documentar el comando de arranque y el smoke test en el README/CLAUDE.md correspondiente y actualizar la fila RNF-07 del `docs/changemap.md`
