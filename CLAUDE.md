# CLAUDE.md — Iuris (raíz)

Plataforma de gestión jurídica para un estudio de las áreas **Laboral** y **ART**. Centraliza clientes, casos y documentos; automatiza comunicaciones y respaldos con **n8n**; usa IA **asistencial** para redactar borradores. La fuente de verdad es `docs/` (SDD).

## Reglas no negociables (leer SIEMPRE antes de codear)

1. **Spec-Driven Development.** Antes de implementar, leé la spec en `docs/` (RF/RN/UC/US/ADR). Si el código y la spec divergen, **gana la spec** — o actualizá la spec primero, en el mismo PR.
2. **La IA vive SOLO en n8n.** Toda la IA se implementa con nodos *AI Agent* de n8n (OpenAI). **Nunca** agregues LLM, claves de OpenAI ni prompts al backend o al frontend. (ADR-0003, ADR-0006)
3. **Humano en el bucle.** Ninguna comunicación al cliente se envía automáticamente. La IA genera borradores; el abogado revisa y aprueba. (RN-10)
4. **Estados como datos.** El ciclo de vida del caso son etapas y transiciones **configurables por área** (`etapa`, `transicion_etapa`), no un enum. El avance es manual; el retroceso requiere confirmación. (ADR-0008)
5. **Confidencialidad.** Datos jurídicos sensibles (Ley 25.326). En dev/tests se usa **base sintética**. Nunca commitear datos reales ni secretos. (ADR-0004)
6. **Seguridad obligatoria.** JWT (access + refresh revocable) en **cookies HttpOnly/Secure/SameSite**, CSRF, RBAC (SOCIO/ABOGADO), rate limiting, HTTPS, headers de seguridad, hash bcrypt/argon2, backend **stateless**. Detalle en `docs/07-seguridad-y-despliegue/`.

## Roles

- **SOCIO**: acceso total + gestión de usuarios.
- **ABOGADO**: operación completa salvo gestión de usuarios (incluye al personal administrativo).
- Todo usuario autenticado puede **leer** los casos del estudio (la titularidad no limita la lectura).

## Estructura del repositorio

- `frontend/` — React (ver `frontend/CLAUDE.md`).
- `backend/` — FastAPI (ver `backend/CLAUDE.md`).
- `n8n/workflows/` — workflows JSON (WF-01 generar actualización, WF-02 backup, WF-05 batch).
- `docs/` — especificaciones (fuente de verdad). Empezá por `docs/README.md`.

**Organización del código: feature-first (vertical slice).** Tanto `backend/` como `frontend/` se organizan por features autocontenidas; lo transversal va en `core/`/`shared/`. Ver ADR-0009 y los `CLAUDE.md` de cada uno.

## Stack

React · FastAPI · PostgreSQL · n8n · Docker · Cloudflare R2 (documentos) · OpenAI (solo dentro de n8n). 

## Instalador de paquetes

Utiliza solamente pnpm para instalar librerías, paquetes y dependencias

## Alcance

**Incluido:** auth/roles, clientes + admisión, casos con ciclo de vida por área, documentos (R2), comunicaciones IA (individual y batch 15 días), generador de telegramas (Ley 23.789), agenda de vencimientos, backups.
**Fuera:** reportes/facturación, OCR, portal de clientes, integración judicial directa.

## Comandos

- `docker compose up --build` — frontend, backend, db, n8n.
- Seeds: `psql "$DATABASE_URL" -f backend/seeds/seed_etapas.sql` (etapas y transiciones).
- Frontend `:3000` · API/Swagger `:8000/docs` · n8n `:5678` · health `GET /health`.

## Git y commits

- Ramas `feature/<ID>-<slug>` (p. ej. `feature/RF-14-drag-drop`).
- Conventional Commits con referencia a la spec: `feat(casos): avance de etapa [refs RF-10, RN-04]`.
- Todo PR vincula su RF/RN/UC y pasa tests (cobertura ≥ 80%).

## Dónde buscar (en `docs/`)

Requisitos `01-` · comportamiento `02-` · arquitectura y modelo de datos `03-` · API `04-` · ADRs `05-` · convenciones `06-` · seguridad y despliegue `07-` · features `08-` · operación `09-`.
