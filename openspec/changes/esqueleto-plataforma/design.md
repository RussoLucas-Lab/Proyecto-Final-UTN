## Context

Iuris es una app web de tres capas (React · FastAPI · PostgreSQL) más n8n para orquestación/IA y Cloudflare R2 para documentos (`03-arquitectura/`). Este es el **primer change** del proyecto y el prerequisito de todos los demás (changemap, fila RNF-07). Estado actual del repo:

- `frontend/`: ya tiene scaffold Vite/React + pnpm (`package.json`, `vite.config.ts`, `node_modules`). Falta solo su `Dockerfile` e integración al compose.
- `backend/`: solo `seeds/` y `CLAUDE.md`. No hay `app/`, ni `Dockerfile`, ni dependencias declaradas.
- No hay `docker-compose.yml`, ni `.env.example`, ni `n8n/`.

Restricciones que enmarcan el diseño: backend stateless, **sin IA** en backend/frontend (la IA vive solo en n8n, ADR-0003/0006), organización feature-first (ADR-0009), pnpm como único gestor JS, secretos fuera del repo (ADR-0004, §1 de `07-seguridad-y-despliegue/`).

## Goals / Non-Goals

**Goals:**
- Entorno reproducible: `docker compose up --build` levanta frontend, backend, db (Postgres) y n8n.
- `GET /health` → `{"status":"UP"}` en el backend (RNF-13).
- Redes privadas (db y n8n no expuestos públicamente), volúmenes nombrados (Postgres y n8n), configuración por env vars con `.env.example` y `.env` ignorado.
- Dejar el esqueleto del backend listo para alojar features y transversales (`app/main.py`, `app/core/`, `app/shared/`, `app/features/`) y `n8n/workflows/`.

**Non-Goals:**
- Migraciones Alembic y esquema base (RNF-09 — change siguiente). Aquí Postgres levanta vacío.
- Seed del ciclo de vida (ADR-0008 — change separado).
- Auth (JWT/cookies/CSRF/RBAC), rate limiting, headers de seguridad, HTTPS: el esqueleto solo prepara `core/` para alojarlos; no se implementan.
- Cualquier feature de negocio (clientes, casos, documentos, comunicaciones, telegramas, vencimientos, backups).
- Integración real con R2 y OpenAI (externos / posteriores).

## Decisions

**1. Un `Dockerfile` por servicio aplicable; imágenes oficiales para db y n8n.**
- `backend/Dockerfile` (Python slim + Uvicorn) y `frontend/Dockerfile` (Node + pnpm, modo dev `vite --host` para el MVP local).
- `db` usa imagen oficial `postgres:16`; `n8n` usa `n8nio/n8n`. No se construyen imágenes propias para estos.
- *Alternativa descartada*: un único contenedor monolítico — rompe la separación de capas (`03-arquitectura/`) y la portabilidad (RNF-07).

**2. Red privada única del compose; exposición mínima.**
- Se publican al host `frontend:3000` y `backend:8000` (este último para API/Swagger en desarrollo, según comandos del `CLAUDE.md` raíz). `db` no publica puerto. `n8n:5678` se publica solo para uso local de desarrollo (acceso al editor); en producción quedaría detrás del proxy/red privada.
- Comunicación interna por hostname de servicio (`db`, `backend`), nunca `localhost`.
- *Alternativa descartada*: exponer Postgres al host — innecesario y contrario a §1 de `07-seguridad-y-despliegue/` ("solo el frontend (y el proxy) se exponen").

**3. Volúmenes nombrados para estado persistente.**
- `db_data` para `/var/lib/postgresql/data` y `n8n_data` para el home de n8n. Garantiza el escenario "los datos sobreviven a un reinicio" sin `down -v`.

**4. Configuración por env vars con plantilla versionada.**
- `.env.example` (versionado, sin secretos) derivado de §1 de `07-seguridad-y-despliegue/`. Para este change solo se necesitan las claves de DB y logging operativas (`DATABASE_URL`, `DB_USER`, `DB_PASSWORD`, `POSTGRES_*`, `LOG_LEVEL`); las claves de JWT/R2/n8n se dejan presentes en la plantilla como placeholders para changes futuros, pero el backend no las consume todavía.
- `.env` ignorado por git (raíz). Los `.gitignore` de `backend/` y `frontend/` ya existen; se agrega/verifica el de la raíz.
- *Alternativa descartada*: hardcodear credenciales en el compose — viola ADR-0004 y RNF de confidencialidad.

**5. `GET /health` mínimo, sin tocar la DB.**
- Endpoint público en `app/main.py` (o en un router transversal de `core/`) que devuelve `{"status":"UP"}` de forma constante. No verifica conectividad a Postgres en este change (eso puede ampliarse cuando exista la sesión de DB, RNF-09).
- *Alternativa considerada*: health "profundo" que pinguee la DB — se difiere a RNF-09 para no acoplar este change al esquema/sesión de DB inexistentes.

**6. Pydantic Settings para configuración centralizada.**
- `app/core/config.py` con `Settings` (pydantic-settings) que lee de entorno, dejando el patrón listo para las features siguientes. Dependencias del backend declaradas en `requirements.txt` (fastapi, uvicorn[standard], pydantic-settings).

**7. `healthcheck` del backend en compose apoyado en `GET /health`.**
- El servicio `backend` declara `depends_on: db` y un `healthcheck` que consulta `/health`, cerrando el lazo entre el endpoint y la orquestación.

## Risks / Trade-offs

- **[Frontend en modo dev dentro de Docker (HMR/volúmenes en Windows)]** → Para el MVP se corre `vite --host` con el código montado; el HMR sobre bind mounts en Windows puede ser lento. *Mitigación*: build de producción servido estáticamente queda para un change posterior; para desarrollo se acepta el modo dev.
- **[Postgres levanta vacío, sin esquema]** → El backend no puede consultar tablas todavía. *Mitigación*: es intencional; el esquema llega en RNF-09. `GET /health` no depende de la DB, así que el smoke test pasa igual.
- **[n8n expone su editor en :5678]** → Riesgo si se deja accesible. *Mitigación*: se documenta que es solo para desarrollo local; en producción va detrás del proxy/red privada (fuera de alcance de este change).
- **[Drift entre `.env.example` y lo que el backend realmente consume]** → claves de más en la plantilla. *Mitigación*: comentar en `.env.example` qué claves son para changes futuros vs. activas ahora.

## Migration Plan

1. No hay datos ni servicios previos en ejecución: es greenfield. El despliegue es simplemente clonar + `cp .env.example .env` + completar valores + `docker compose up --build`.
2. **Rollback**: `docker compose down` (sin `-v` para conservar volúmenes). Como no hay esquema ni datos de negocio, el rollback es seguro y sin pérdida.
3. Verificación post-despliegue (smoke test): `curl http://localhost:8000/health` → `{"status":"UP"}`; frontend accesible en `http://localhost:3000`; editor de n8n en `http://localhost:5678`.

## Open Questions

- ¿El frontend en el compose corre en modo dev (`vite --host`) o se sirve un build estático detrás de un proxy? Para este change se asume **modo dev** (suficiente para el smoke test); el build de producción + proxy reverso se deja para un change de despliegue posterior.
- ¿Se incluye ya un servicio de proxy reverso (NGINX) en el compose? Se difiere: §1 de `07-seguridad-y-despliegue/` lo marca como *opcional* y pertenece a la etapa de hardening/HTTPS, no al esqueleto.
