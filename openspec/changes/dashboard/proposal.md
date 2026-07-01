## Why

El Dashboard (`frontend/src/features/dashboard/DashboardPage.tsx`) muestra hoy datos **100% hardcodeados**: fecha fija (`new Date(2026, 5, 24)`), tarjetas de métricas con números inventados (`24`, `11`, `5`, `8`), una tabla de "Actualizaciones para revisar" con 3 filas mock y un panel de "Próximos vencimientos" con 4 ítems fijos. Es la primera pantalla que ve el abogado al entrar y no refleja el estado real del estudio, lo que la vuelve inútil para operar y engañosa para decidir.

Además la feature `dashboard/` es un único archivo monolítico, sin la separación `api.ts` / `types.ts` / hooks / componentes que exige el ADR-0009 (vertical slice), a diferencia del resto del repo.

## What Changes

- **Backend — lectura de borradores**: implementar `GET /api/v1/comunicaciones?estado=PENDIENTE_REVISION` (contrato ya documentado en `docs/04-api/contratos-api.md`, RF-26.4, nunca implementado). Devuelve, por cada borrador pendiente, los datos que la tabla del dashboard necesita: cliente, área, etapa actual, preview del `contenido`, id, estado y fecha de generación (resolviendo `Comunicacion → Caso → Cliente/Etapa`).
- **Backend — revisión de borradores**: implementar `PATCH /api/v1/comunicaciones/{id}` (RF-26.4 / RN-19) para aprobar (`APROBADO`) o descartar (`DESCARTADO`) un borrador ya generado. Registra `aprobado_por` / `aprobado_en`. No envía nada al cliente (RN-10).
- **Backend — métricas del panel**: exponer los conteos que alimentan las tarjetas (casos por área con delta mensual, clientes nuevos últimos 30 días, vencimientos de la semana). No existe hoy ningún endpoint de agregación. El enfoque concreto se decide en `design.md` (necesidad derivada del dashboard, sin RF nuevo).
- **Frontend — datos reales**: reemplazar TODOS los valores hardcodeados listados en Impact por datos traídos del backend, incluyendo la fecha real (`new Date()`), los contadores de borradores pendientes (badge y botón) y el panel de vencimientos próximos (reutilizando `GET /vencimientos?desde=&hasta=`).
- **Frontend — vertical slice**: dividir el monolito `DashboardPage.tsx` en `api.ts`, `types.ts`, un hook de datos (`useDashboard`) y subcomponentes, alineando la feature con el ADR-0009 y el patrón de `casos`/`vencimientos`.
- **Docs (SDD)**: precisar en `docs/04-api/contratos-api.md` el schema de respuesta de `GET /comunicaciones` (hoy solo se nombra) y documentar el endpoint de métricas elegido.

## Capabilities

### New Capabilities
- `panel-inicio`: comportamiento del Dashboard como pantalla de inicio — métricas reales por área y del estudio, bloque de borradores pendientes de revisión con sus acciones, panel de próximos vencimientos, y la estructura vertical-slice de la feature frontend.
- `revision-comunicaciones`: endpoints de backend para **listar** borradores de comunicación por estado y **aprobar/descartar** un borrador ya generado (lectura + mutación de estado de `Comunicacion`, sin IA).

### Modified Capabilities
<!-- Sin cambios de requisitos en specs existentes. Las métricas se apoyan en datos ya persistidos (Caso.creado_en, Cliente.creado_en, Vencimiento) sin alterar el esquema. -->

## Impact

- **Frontend**: `frontend/src/features/dashboard/DashboardPage.tsx` (refactor + fin del hardcodeo en `:6`, `:426`, `:440-475`, `:314-354`, `:519`, `:620-645`); nuevos `frontend/src/features/dashboard/{api.ts,types.ts}`, `hooks/useDashboard.ts` y `components/`. Reutiliza `frontend/src/shared/http.ts`.
- **Backend**: feature `comunicaciones` — nuevos endpoints GET (listado) y PATCH en `router.py`, con su `service.py` y `schemas.py`; endpoint de métricas del dashboard (ubicación a definir en design). Reutiliza el patrón de seguridad de `comunicaciones/router.py` y `casos/router.py` (JWT cookie, RBAC ABOGADO/SOCIO, CSRF en mutaciones, rate limit) y las columnas `creado_en` de `Caso`/`Cliente` (sin migración de DB).
- **Docs**: `docs/04-api/contratos-api.md` (schema de `GET /comunicaciones` y endpoint de métricas).
- **Fuera de alcance** (hallazgos relacionados, NO se abordan aquí): WF-05 (batch automático 15 días, endpoints `/internal/casos/pendientes-actualizacion` y `POST /internal/casos/{id}/comunicaciones`, RN-20..22); refactor visual de `frontend/src/features/comunicaciones/BatchPage.tsx` (aunque puede consumir gratis el mismo `GET /comunicaciones`); archivo huérfano `frontend/src/features/agenda/AgendaPage.tsx`.
