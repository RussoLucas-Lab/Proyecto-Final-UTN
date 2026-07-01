## 1. Backend — revisión de comunicaciones (GET + PATCH)

- [ ] 1.1 En `backend/app/features/comunicaciones/schemas.py`, agregar `BorradorPendienteResponse` (`id`, `caso_id`, `cliente`, `area`, `etapa`, `preview` con alias de `contenido`, `estado`, `generado_en`) y `ComunicacionPatch` (`estado: EstadoComunicacion` restringido a APROBADO/DESCARTADO) + `ComunicacionPatchResponse` (`id`, `estado`, `aprobado_por`, `aprobado_en`)
- [ ] 1.2 En `service.py`, `listar_comunicaciones(db, estado=None)`: query con joins `Comunicacion → Caso → Cliente` y `Caso → etapa_actual`, filtro por estado, orden `generado_en` DESC; mapear al schema enriquecido
- [ ] 1.3 En `service.py`, `revisar_comunicacion(db, id, estado, usuario_id)`: validar existencia (404), que esté en `PENDIENTE_REVISION` (409), aplicar nuevo estado + `aprobado_por`/`aprobado_en=now()`; devolver el recurso
- [ ] 1.4 En `router.py`, `GET /comunicaciones` con `estado` opcional (Query validado contra `EstadoComunicacion`), `get_current_user`, rate limit 100/min, `response_model=list[BorradorPendienteResponse]`
- [ ] 1.5 En `router.py`, `PATCH /comunicaciones/{id}` con `require_roles(ABOGADO, SOCIO)`, rate limit, mapeo de excepciones a 404/409/422; pasar `current_user.id` al service
- [ ] 1.6 Verificar checklist `seguridad-endpoint` en ambos endpoints (JWT cookie, CSRF en el PATCH, RBAC, rate limit, validación Pydantic); confirmar que NO se dispara ningún envío al cliente (RN-10)

## 2. Backend — métricas del dashboard

- [ ] 2.1 Crear la feature `backend/app/features/dashboard/` (vertical slice: `router.py`, `service.py`, `schemas.py`) con `feature-scaffold`
- [ ] 2.2 En `schemas.py`, `ResumenDashboardResponse` con `casos_laboral`/`casos_art` (`{total, delta_mes}`) y `clientes_nuevos_30d`
- [ ] 2.3 En `service.py`, `calcular_resumen(db)`: conteos de `Caso` por área (total y `delta_mes` = `creado_en` dentro del mes en curso) y conteo de `Cliente` con `creado_en >= now - 30d`; solo lecturas (documentar la excepción de cruce de modelos del ADR-0009, ver design R1)
- [ ] 2.4 En `router.py`, `GET /dashboard/resumen` con `get_current_user`, rate limit, `response_model=ResumenDashboardResponse`
- [ ] 2.5 Registrar el router de `dashboard` en `backend/app/main.py` bajo el prefijo `/api/v1`
- [ ] 2.6 Verificar checklist `seguridad-endpoint` (auth por cookie, rate limit, sin datos sensibles de más)

## 3. Docs (SDD)

- [ ] 3.1 En `docs/04-api/contratos-api.md`, precisar el schema de respuesta de `GET /comunicaciones?estado=` (campos cliente/area/etapa/preview/estado/generado_en) y del `PATCH /comunicaciones/{id}` (200/404/409/422)
- [ ] 3.2 En `docs/04-api/contratos-api.md`, documentar el nuevo `GET /dashboard/resumen` (forma de respuesta y que es necesidad derivada del dashboard, sin RF nuevo)

## 4. Frontend — capa de datos (vertical slice)

- [ ] 4.1 Crear `frontend/src/features/dashboard/types.ts`: `ResumenDashboard`, `BorradorPendiente` (espejo de los schemas del backend) y tipo de vencimiento (reutilizar el de `features/vencimientos` si es exportable)
- [ ] 4.2 Crear `frontend/src/features/dashboard/api.ts`: `getResumen()`, `listarBorradoresPendientes()`, `patchBorrador(id, estado)` usando `shared/http.ts`; reutilizar `listarVencimientosRango` de la feature `vencimientos`
- [ ] 4.3 Crear `frontend/src/features/dashboard/hooks/useDashboard.ts`: 3 lecturas en paralelo (resumen, vencimientos rango hoy..hoy+15d, borradores pendientes), estado `{ isLoading, error }`, `refetch`, y derivar contadores (borradores.length, vencimientos "esta semana" = próximos 7d, total próximos)

## 5. Frontend — reemplazo del hardcodeo y componentes

- [ ] 5.1 `DashboardPage.tsx:6` → usar `new Date()` real en `formatDate`
- [ ] 5.2 Extraer `MetricCard` a `components/` y poblar las 4 tarjetas (`:440-475`): Casos Laboral/ART desde `resumen` (total + "+N este mes"), Clientes nuevos desde `resumen.clientes_nuevos_30d`, Vencimientos próximos desde el conteo derivado de vencimientos
- [ ] 5.3 Reemplazar el array `rows` mock (`:314-354`) y renderizar la tabla real desde `borradores`; badge (`:519`) y contador del botón "Revisar actualizaciones" (`:426`) = `borradores.length`
- [ ] 5.4 Extraer `VencimientoItem`/panel a `components/` y renderizar "Próximos vencimientos" (`:620-645`) desde la lista real de vencimientos (día/mes/nombre/área/flag "hoy" calculado con la fecha real)
- [ ] 5.5 Cablear las acciones aprobar/descartar de la tabla a `patchBorrador` + `refetch()` (o update local) para mantener lista y contadores consistentes
- [ ] 5.6 Añadir estados de carga y de error a las secciones (sin mostrar valores mock ante fallo)

## 6. Tests y cierre

- [ ] 6.1 Tests backend `comunicaciones`: listar por estado (con/sin resultados, estado inválido 422, 401) y patch (aprobar, descartar, 409 no pendiente, 404, 403 sin rol) — base sintética
- [ ] 6.2 Tests backend `dashboard`: `calcular_resumen` con datos y sin datos (totales/deltas en 0), 401 sin sesión
- [ ] 6.3 Test/verificación frontend del hook `useDashboard` y del render sin datos hardcodeados; `pnpm lint`
- [ ] 6.4 Verificar cobertura ≥ 80% en las features tocadas y correr la suite completa
