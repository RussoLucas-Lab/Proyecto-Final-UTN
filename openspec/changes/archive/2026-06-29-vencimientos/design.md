## Context

La tabla `vencimiento` ya existe en la migración `001_esquema_base_inicial.py` y el ORM model en `backend/app/features/vencimientos/models.py`. Solo falta la capa de service + router + frontend. No hay n8n ni storage involucrados.

## Goals / Non-Goals

**Goals:**
- CRUD de vencimientos por caso (`POST`, `GET /casos/{id}/vencimientos`, `PATCH`)
- Vista calendario compartida (`GET /vencimientos?desde=&hasta=`)
- Sección "Vencimientos" en el detalle de caso (lista + alta)
- Página `/agenda` con calendario mensual navegable

**Non-Goals:**
- Notificaciones o alertas automáticas (fuera de alcance per spec)
- Edición de descripción/fecha post-creación (no hay endpoint en la spec)
- Eliminación de vencimientos (no especificada)
- Filtros adicionales en la vista calendario (por abogado, por caso, etc.)

## Decisions

**D1 — Dos endpoints GET separados**
`GET /casos/{id}/vencimientos` (por caso, para el detalle de caso) y `GET /vencimientos?desde=&hasta=` (global, para la agenda). Alternativa rechazada: un único `GET /vencimientos?caso_id=` — peor DX en el detalle y rompe el patrón de rutas anidadas que usa el resto del proyecto.

**D2 — Sin nueva migración**
La tabla `vencimiento` ya está definida en `001_esquema_base_inicial.py`. Se reutiliza el model ORM existente.

**D3 — RBAC: escritura ABOGADO/SOCIO, lectura amplia**
Coherente con RN-08: todo usuario autenticado puede leer. Solo ABOGADO/SOCIO puede crear/completar (mismo patrón que documentos y casos).

**D4 — Calendario frontend: grid mensual simple**
Sin librería externa de calendario. Grid CSS de 7 columnas, navegación prev/next mes. Alternativa rechazada: `react-big-calendar` o `fullcalendar` — agregan peso y complejidad innecesarios para el caso de uso (solo lectura, sin drag & drop).

**D5 — `desde`/`hasta` obligatorios en `GET /vencimientos`**
Evita consultas sin límite sobre la tabla completa. El frontend siempre envía el rango del mes visible.

## Risks / Trade-offs

- [Grid CSS manual] → puede quedar visual básico; aceptable para el MVP
- [Sin edición post-creación] → si el abogado carga mal la fecha, debe completar y crear uno nuevo; riesgo bajo

## Migration Plan

1. `docker compose up -d --build backend` — no requiere migración, tabla ya existe
2. Correr seed de etapas si la DB está vacía (no relacionado con este change)
3. No hay rollback necesario (solo se agregan endpoints, sin cambios de esquema)
