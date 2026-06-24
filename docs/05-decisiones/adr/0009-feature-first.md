# ADR-0009: Organización del código por features (vertical slice)

**Estado:** Aceptada · **Fecha:** 2026-06

## Contexto
El proyecto se especifica por funcionalidad (SDD). Una organización por capas (carpetas globales `api/`, `models/`, `services/`, `schemas/`) dispersa cada funcionalidad en muchos lugares y dificulta la trazabilidad spec↔código. Se busca que el código refleje la misma división que las specs y que cada funcionalidad sea autocontenida.

## Decisión
Tanto el **backend (FastAPI)** como el **frontend (React)** se organizan **por features (vertical slice)**:
- **Backend:** `app/features/<feature>/` con `router.py`, `service.py`, `schemas.py`, `models.py`, `dependencies.py`. Lo transversal (config, seguridad, sesión de DB, dependencias y utilidades compartidas) vive en `app/core/` y `app/shared/`.
- **Frontend:** `src/features/<feature>/` con `components/`, `hooks/`, `api.ts`, `types.ts` y `pages/`. Lo transversal (cliente HTTP, UI base, hooks y utilidades) vive en `src/shared/`; el armazón (router, providers, layout) en `src/app/`.

Features previstas: auth, usuarios, clientes, casos, documentos, comunicaciones, telegramas, vencimientos, backups (y dashboard en el frontend).

## Consecuencias
- (+) Trazabilidad spec → feature → código; cada feature es autocontenida y testeable de forma aislada.
- (+) Escala mejor a medida que crece el sistema; facilita el trabajo en paralelo del equipo.
- (+) Los tests espejan las features.
- (−) Requiere disciplina para no filtrar lógica entre features; las dependencias cruzadas se resuelven vía `core/`/`shared/` o interfaces, evitando imports directos entre features.
