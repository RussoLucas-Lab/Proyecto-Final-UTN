## 1. Backend — Schemas

- [x] 1.1 Crear `backend/app/features/vencimientos/schemas.py` con:
  - `VencimientoCreate` (`descripcion: str` con `min_length=1, max_length=255`, `fecha: date`)
  - `VencimientoCompletar` (`completado: bool`)
  - `VencimientoResponse` (`id`, `caso_id`, `descripcion`, `fecha`, `completado`, `creado_por`, `creado_en`) con `model_config = ConfigDict(from_attributes=True)`

## 2. Backend — Service

- [x] 2.1 Crear `backend/app/features/vencimientos/service.py` con:
  - Excepción `CasoNoEncontrado`
  - Excepción `VencimientoNoEncontrado`
  - `crear_vencimiento(caso_id, datos, usuario_id, db)` → valida caso, crea `Vencimiento`, retorna instancia
  - `listar_vencimientos_caso(caso_id, db)` → valida caso, retorna vencimientos del caso ordenados por `fecha ASC`
  - `listar_vencimientos_rango(desde, hasta, db)` → retorna vencimientos de todo el estudio con `fecha BETWEEN desde AND hasta`, ordenados por `fecha ASC`
  - `completar_vencimiento(vencimiento_id, completado, db)` → busca por id, actualiza `completado`, retorna instancia

## 3. Backend — Router

- [x] 3.1 Crear `backend/app/features/vencimientos/router.py` con los 4 endpoints:
  - `POST /casos/{caso_id}/vencimientos` — rol ABOGADO/SOCIO + CSRF, llama `crear_vencimiento`, responde 201
  - `GET /casos/{caso_id}/vencimientos` — cualquier usuario autenticado, llama `listar_vencimientos_caso`
  - `GET /vencimientos` — cualquier usuario autenticado, params `desde` y `hasta` (Query, obligatorios), llama `listar_vencimientos_rango`
  - `PATCH /vencimientos/{id}` — rol ABOGADO/SOCIO + CSRF, llama `completar_vencimiento`
- [x] 3.2 Registrar el router en `backend/app/main.py` bajo el prefijo `/api/v1`

## 4. Backend — Tests (TDD)

- [x] 4.1 Crear `backend/tests/features/vencimientos/conftest.py` con:
  - `mock_db`: `MagicMock` de sesión SQLAlchemy
  - `caso_con_abogado`: fixture de DB in-memory (SQLite) con tablas `usuario`, `refresh_token`, `etapa`, `caso`, `vencimiento`; crea un caso LABORAL con un abogado ABOGADO activo; retorna `caso_id`
  - `client`: `TestClient` con `dependency_overrides` para `get_db`
- [x] 4.2 Crear `backend/tests/features/vencimientos/test_service.py` con tests unitarios (MagicMock):
  - `crear_vencimiento` → crea con `completado=False` y `creado_por` correcto
  - `crear_vencimiento` con caso inexistente → lanza `CasoNoEncontrado`
  - `listar_vencimientos_caso` → retorna lista vacía para caso sin vencimientos
  - `listar_vencimientos_rango` → retorna solo vencimientos en el rango
  - `completar_vencimiento` → actualiza `completado`
  - `completar_vencimiento` con id inexistente → lanza `VencimientoNoEncontrado`
- [x] 4.3 Crear `backend/tests/features/vencimientos/test_router.py` con tests de integración (TestClient):
  - `POST /casos/{id}/vencimientos` 201 con ABOGADO autenticado
  - `POST /casos/{id}/vencimientos` 401/403 sin sesión
  - `POST /casos/{id}/vencimientos` 404 caso inexistente
  - `POST /casos/{id}/vencimientos` 422 descripción vacía
  - `GET /casos/{id}/vencimientos` 200 lista vacía
  - `GET /casos/{id}/vencimientos` 200 con vencimientos
  - `GET /vencimientos?desde=&hasta=` 200 con rango válido
  - `GET /vencimientos` 422 sin params
  - `PATCH /vencimientos/{id}` 200 con ABOGADO
  - `PATCH /vencimientos/{id}` 404 id inexistente
- [x] 4.4 Ejecutar `pytest backend/tests/features/vencimientos/ -v` y confirmar ≥ 80% cobertura

## 5. Frontend — Types y API

- [x] 5.1 Crear `frontend/src/features/vencimientos/types.ts` con interfaces:
  - `VencimientoCreate` (`descripcion: string`, `fecha: string`)
  - `VencimientoResponse` (`id`, `caso_id`, `descripcion`, `fecha`, `completado`, `creado_por`, `creado_en`)
- [x] 5.2 Crear `frontend/src/features/vencimientos/api.ts` con funciones:
  - `crearVencimiento(casoId, payload)` → `POST /api/v1/casos/{casoId}/vencimientos`
  - `listarVencimientosCaso(casoId)` → `GET /api/v1/casos/{casoId}/vencimientos`
  - `listarVencimientosRango(desde, hasta)` → `GET /api/v1/vencimientos?desde={desde}&hasta={hasta}`
  - `completarVencimiento(id, completado)` → `PATCH /api/v1/vencimientos/{id}`

## 6. Frontend — Componentes

- [x] 6.1 Crear `frontend/src/features/vencimientos/components/VencimientoForm.tsx`: formulario con campos `descripcion` (input text) y `fecha` (input date); botón "Agregar"; llama `crearVencimiento` y llama `onCreado(v)` al completar
- [x] 6.2 Crear `frontend/src/features/vencimientos/components/VencimientoList.tsx`: lista de vencimientos con columnas descripción, fecha y un botón "Completar" (visible si `completado === false`) que llama `completarVencimiento` y actualiza el estado local; muestra checkmark si ya completado
- [x] 6.3 Integrar `VencimientoForm` y `VencimientoList` en `CasoARTPage.tsx` y `CasoLaboralPage.tsx` (nueva sección "Vencimientos" cargando con `useEffect` al montar)
- [x] 6.4 Crear `frontend/src/features/vencimientos/components/CalendarioMes.tsx`: grid CSS 7 columnas (Dom–Sáb), navegación prev/next mes, puntos o badges sobre días con vencimientos, tooltip o lista inline al hacer clic en un día
- [x] 6.5 Crear `frontend/src/features/vencimientos/AgendaPage.tsx`: página completa que carga `listarVencimientosRango` con el rango del mes actual, renderiza `CalendarioMes`, actualiza al navegar entre meses
- [x] 6.6 Agregar ruta `/agenda` en `frontend/src/app/App.tsx` apuntando a `AgendaPage`
- [x] 6.7 Agregar enlace "Agenda" en el sidebar de navegación

## 7. Verificación manual

- [x] 7.1 `docker compose up -d --build backend` y confirmar que el backend arranca sin errores
- [x] 7.2 Smoke test: login → abrir un caso → agregar vencimiento → verificar que aparece en la lista → marcar como completado → verificar cambio de estado
- [x] 7.3 Smoke test agenda: ir a `/agenda` → verificar que el mes muestra los vencimientos cargados → navegar al mes siguiente/anterior
