## Context

El Dashboard es la pantalla de inicio del abogado. Hoy `DashboardPage.tsx` es un archivo monolítico con datos inventados y sin capa de datos (`api.ts`/`types.ts`/hooks), incumpliendo el ADR-0009. Para poblarlo con datos reales necesitamos tres orígenes:

1. **Borradores pendientes** (tabla "Actualizaciones para revisar" + badge + botón): dependen de `Comunicacion.estado = PENDIENTE_REVISION`, que ya se persiste (WF-01, feature `comunicaciones`), pero **no hay endpoint de lectura ni de aprobación/descartado** — solo están documentados en `docs/04-api/contratos-api.md` (RF-26.4) sin implementar.
2. **Próximos vencimientos** (panel + tarjeta de conteo): ya cubiertos por `GET /api/v1/vencimientos?desde=&hasta=` (feature `vencimientos`), consumido igual en `AgendaPage.tsx`.
3. **Métricas de casos y clientes** (tarjetas "Casos Laboral", "Casos ART", "Clientes nuevos"): requieren agregaciones (conteos + deltas) que **ningún endpoint expone hoy**. Las columnas `Caso.creado_en` y `Cliente.creado_en` ya existen, así que no hace falta migración de DB.

Restricciones: backend stateless, RBAC SOCIO/ABOGADO, CSRF en mutaciones, JWT en cookies (patrón de `comunicaciones/router.py` y `casos/router.py`); IA solo en n8n (este change NO toca IA, solo lee/muta estado de `Comunicacion` ya creada); SDD (la spec en `docs/` es fuente de verdad y se actualiza en el mismo change).

## Goals / Non-Goals

**Goals:**
- Que el Dashboard muestre datos 100% reales, eliminando todo hardcodeo enumerado en el proposal.
- Implementar `GET /comunicaciones?estado=` y `PATCH /comunicaciones/{id}` reutilizables (también habilitan `BatchPage` a futuro sin trabajo extra de UI en este change).
- Exponer las métricas de casos/clientes con el **mínimo** de superficie de backend nueva y sin over-engineering.
- Dejar la feature `dashboard/` alineada al vertical slice (ADR-0009): `api.ts`, `types.ts`, `useDashboard`, subcomponentes.
- Mantener el contrato en `docs/04-api/contratos-api.md` alineado con lo implementado.

**Non-Goals:**
- WF-05 (batch automático cada 15 días) y sus endpoints `/internal` (RN-20..22): fuera de alcance.
- Refactor visual de `BatchPage.tsx` y del huérfano `agenda/AgendaPage.tsx`.
- Cualquier lógica de IA o de envío al cliente (RN-10: el envío por WhatsApp sigue siendo manual/externo).
- Nuevos RF/RN: las métricas son necesidad derivada del dashboard; no se inventa un RF.

## Decisions

### D1 — Métricas: un único endpoint de agregación acotado a casos + clientes; el resto se deriva en el frontend

**Decisión:** crear **una** nueva feature backend `dashboard/` con un solo endpoint `GET /api/v1/dashboard/resumen` que devuelve únicamente lo que exige agregación server-side (conteos por área con delta mensual y clientes nuevos de los últimos 30 días). Las demás tarjetas/paneles se derivan en el frontend de endpoints que ya existen.

Reparto de responsabilidades de los datos del panel:

| Dato del dashboard | Origen | Nuevo? |
|---|---|---|
| Tarjetas "Casos Laboral/ART" (total + "+N este mes") | `GET /dashboard/resumen` | **Sí** |
| Tarjeta "Clientes nuevos" (últimos 30 días) | `GET /dashboard/resumen` | **Sí** |
| Tarjeta "Vencimientos próximos" (total + "N esta semana") | derivado de `GET /vencimientos?desde=hoy&hasta=hoy+N` (contado en el hook) | No |
| Panel "Próximos vencimientos" (lista) | mismo `GET /vencimientos` | No |
| Tabla "Actualizaciones para revisar" | `GET /comunicaciones?estado=PENDIENTE_REVISION` | **Sí (lectura)** |
| Badge + botón contador de borradores | `= length` de la respuesta anterior | No |
| Fecha "hoy" | `new Date()` en el cliente | No |

Forma de la respuesta de `GET /dashboard/resumen`:
```json
{
  "casos_laboral": { "total": 24, "delta_mes": 2 },
  "casos_art":     { "total": 11, "delta_mes": 1 },
  "clientes_nuevos_30d": 5
}
```
`delta_mes` = casos con `creado_en` dentro del mes calendario en curso. `clientes_nuevos_30d` = clientes con `creado_en >= hoy - 30 días`.

**Por qué, y alternativas descartadas:**
- *(a) Exponer `total` en las respuestas paginadas de `/casos` y `/clientes`* (vía campo o header): resolvería los conteos totales pero **no** los deltas ("+N este mes") ni "clientes nuevos 30d", que igual necesitarían agregación aparte; además obliga al frontend a orquestar varias llamadas y a cambiar el contrato de endpoints ya estables. Descartada.
- *(b) Un endpoint mega-resumen que devuelva TODO (casos + clientes + vencimientos + borradores)*: duplicaría en el backend conteos que el frontend ya puede derivar barato de `GET /vencimientos` y `GET /comunicaciones` (que además necesita traer igualmente para la lista), inflando la respuesta y el acoplamiento. Descartada por over-engineering.
- *(a elegida) endpoint acotado*: una sola llamada nueva, agregación solo donde es imprescindible, endpoints existentes intactos.

**Ubicación del endpoint** — feature nueva `dashboard/` en vez de `GET /casos/resumen`: el resumen es una vista de reporte que cruza casos + clientes; ponerlo en `casos` mezclaría clientes ahí. Una slice `dashboard/` mapea 1:1 con la capability `panel-inicio`. Ver riesgo R1 sobre el cruce de modelos.

### D2 — `GET /comunicaciones?estado=PENDIENTE_REVISION`: schema enriquecido para la tabla

**Decisión:** el endpoint vive en la feature `comunicaciones` (donde está el modelo). Resuelve las relaciones `Comunicacion → Caso → Cliente` y `Caso → Etapa (etapa_actual)` y devuelve por ítem lo que la tabla del dashboard necesita, no el ORM crudo:
```json
[
  {
    "id": 88,
    "caso_id": 12,
    "cliente": "Juan Pérez",
    "area": "LABORAL",
    "etapa": "Conciliación",
    "preview": "Hola Juan, te informamos que el expediente tuvo movimiento...",
    "estado": "PENDIENTE_REVISION",
    "generado_en": "2026-06-11T14:05:00Z"
  }
]
```
`preview` mapea el campo ORM `contenido` (texto completo; el truncado a preview lo hace el frontend, igual que hoy con las filas mock). `estado` es filtrable por query param (default sin filtro o `PENDIENTE_REVISION`); se valida contra el enum `EstadoComunicacion`. Se ordena por `generado_en` DESC.

**Por qué:** evita N+1 en el frontend (no hay que pedir el caso y el cliente por separado) y deja el contrato de `docs/04-api/contratos-api.md` preciso (hoy solo se nombra el endpoint sin schema). Alternativa descartada: devolver solo `{id, contenido, estado}` y que el frontend resuelva cliente/área/etapa con llamadas extra → más round-trips y peor UX.

### D3 — `PATCH /comunicaciones/{id}`: aprobar/descartar con auditoría

**Decisión:** body `{ "estado": "APROBADO" | "DESCARTADO" }`. Solo se permiten esas dos transiciones y solo desde `PENDIENTE_REVISION` (RN-19). Registra `aprobado_por = current_user.id` y `aprobado_en = now()` para dejar trazado quién revisó (en ambos casos, aprobado o descartado). Devuelve el recurso actualizado (`id`, `estado`, `aprobado_por`, `aprobado_en`). Seguridad: JWT cookie + `require_roles(ABOGADO, SOCIO)` + CSRF (double-submit, hereda del middleware para PATCH de navegador) + rate limit, idéntico al patrón de `POST /casos/{id}/actualizacion`. **No envía nada al cliente** (RN-10).

Códigos: 200 ok · 401 sin sesión · 403 sin rol/CSRF · 404 comunicación inexistente · 409 si la comunicación no está en `PENDIENTE_REVISION` · 422 estado inválido.

### D4 — Frontend: vertical slice `dashboard/` con un hook orquestador

**Decisión:** dividir `DashboardPage.tsx` en:
- `types.ts`: espejo de los schemas Pydantic (`ResumenDashboard`, `BorradorPendiente`, reutiliza el tipo de vencimiento de la feature `vencimientos` si es exportable, si no lo replica local).
- `api.ts`: `getResumen()`, `listarBorradoresPendientes()`, `patchBorrador(id, estado)` — todas contra `/api/v1/...` vía el `http` de `shared/http.ts` (ya inyecta `credentials:'include'` + CSRF).
- `hooks/useDashboard.ts`: hace las 3 lecturas en paralelo (`resumen`, `vencimientos` del rango hoy..hoy+N, `borradores`), expone `{ resumen, vencimientos, borradores, isLoading, error, refetch }` y deriva los contadores (vencimientos "esta semana", total próximos, cantidad de borradores). Patrón de estado igual a `useCasos.ts` / `AgendaPage.tsx`.
- `components/`: extraer `MetricCard`, la tabla de borradores y `VencimientoItem`/panel como subcomponentes; `DashboardPage.tsx` queda como composición + fecha real (`new Date()`).

Las acciones aprobar/descartar de la tabla llaman a `patchBorrador` y luego `refetch()` (o actualizan el estado local) para que badge/contadores queden consistentes.

## Risks / Trade-offs

- **R1 — La slice `dashboard/` del backend lee modelos de otras features (`Caso`, `Cliente`, `Vencimiento`), lo que roza la regla de "no imports cruzados" del ADR-0009.** → Mitigación: se limita a **consultas de solo lectura para reporte** (sin duplicar reglas de negocio, que siguen viviendo en cada feature). Es la excepción pragmática habitual para agregaciones de dashboard. Si a futuro crece, se puede exponer helpers `contar_*` en los services de `casos`/`clientes` y que `dashboard` los invoque.
- **R2 — `delta_mes` y "clientes nuevos 30d" son ventanas temporales calculadas con `now()` del servidor.** → Mitigación: definir claramente el criterio (mes calendario en curso; ventana móvil de 30 días) en el spec y en el docstring; sin husos horarios exóticos (se usa la hora del servidor, consistente con `server_default=now()` de las columnas).
- **R3 — Doble fuente para el conteo de vencimientos (card) y su lista (panel) si se usaran endpoints distintos.** → Mitigación: D1 fuerza una **única** llamada `GET /vencimientos` de la que se derivan ambos, evitando divergencias.
- **R4 — Cambiar el contrato documentado de `GET /comunicaciones` (agregar cliente/área/etapa/preview) podría desalinear si alguien ya lo asumió más simple.** → Mitigación: nadie lo implementó aún; se actualiza `docs/04-api/contratos-api.md` en el mismo change (SDD), dejándolo como fuente de verdad.

## Open Questions

- **N de "próximos vencimientos"**: ¿qué horizonte usa el panel/tarjeta (p. ej. próximos 7, 15 o 30 días)? Propuesta por defecto: **próximos 15 días** para el panel, con el sub-contador "esta semana" = próximos 7 días. Ajustable sin cambios de backend (es un parámetro del rango en el frontend). A confirmar con el usuario si prefiere otro horizonte.
- **PATCH desde estados no pendientes**: se asume 409 si el borrador no está en `PENDIENTE_REVISION`. Confirmar si se quiere permitir re-descartar un `APROBADO` (por ahora, no).
