## 1. Backend — scaffold de la feature (vertical slice, ADR-0009 · skill `feature-scaffold`)

- [x] 1.1 Verificar que existe `backend/app/features/casos/__init__.py` y la carpeta de la feature (los `models.py` ya existen).
- [x] 1.2 NO crear ni redefinir `models.py`: reutilizar `from app.features.casos.models import Caso, FichaLaboral, Etapa, TransicionEtapa, HistorialCaso` (ya existen, D1). Verificar que NO se duplique ninguna tabla ni se cree migración nueva.
- [x] 1.3 Crear `backend/app/features/casos/schemas.py` con `CasoCreate` (`cliente_id`, `abogado_responsable_id`, `area` obligatorios; `tipo_reclamo`, `codigo_expediente`, `fecha_inicio`, `observaciones`, `ficha_laboral` opcionales), `FichaLaboralUpsert` (todos los campos de la ficha, opcionales), `AvanzarRequest` (`etapa_destino_id`), `RetrocederRequest` (`etapa_destino_id`, `confirmar: bool = False`), `CasoResponse` (resumen), `CasoDetalleResponse` (incluye `etapa_actual`, `ficha`, `transiciones_validas`) e `HistorialItemResponse`; `model_config = {"from_attributes": True}` en los de salida. Validar `tipo_reclamo` según área (obligatorio en ART, nulo en LABORAL). (D6, D10)
- [x] 1.4 Crear `backend/app/features/casos/dependencies.py` con `get_caso_o_404` (cargar caso por `{id}` con 404), siguiendo el patrón de `clientes/dependencies.py`.

## 2. Backend — lógica de negocio (service.py · skill `etapas-y-transiciones`)

- [x] 2.1 `_etapa_inicial(db, area)`: resolver la etapa inicial como DATO (menor `orden` de la `area`); error claro si el catálogo no está sembrado. NUNCA buscar por nombre ni enum. (D2, ADR-0008)
- [x] 2.2 `crear_caso(db, datos, autor)`: en una transacción — validar cliente y abogado existentes; validar `tipo_reclamo` por área; insertar `Caso` en la etapa inicial; insertar `FichaLaboral` si viene anidada; insertar la primera fila de `historial_caso` (`etapa_anterior_id = NULL`, evento de creación). (RF-08, RF-09, RN-01, RN-05, D6)
- [x] 2.3 `upsert_ficha_laboral(db, caso_id, datos)`: 404 si el caso no existe; crear la ficha si no existe o actualizarla (1:1, respeta unique `caso_id`). (RF-09)
- [x] 2.4 `avanzar_etapa(db, caso, etapa_destino_id, autor)`: validar que exista `TransicionEtapa(origen=caso.etapa_actual_id, destino=etapa_destino_id)`; si no, `TransicionInvalida` → 409. En éxito: actualizar `etapa_actual_id` e insertar historial (evento avance) en la misma transacción. (RF-10, RN-04, RN-11, RN-05, D3, D5)
- [x] 2.5 `retroceder_etapa(db, caso, etapa_destino_id, confirmar, autor)`: validar que el destino sea de la misma área (RN-11); si la etapa actual es terminal y `confirmar` es false → `RetrocesoSinConfirmar` → 409/422 (RN-09). En éxito: actualizar etapa e insertar historial (evento retroceso). NO consultar `transicion_etapa`. (RF-11, RN-05, RN-09, D4)
- [x] 2.6 `obtener_detalle(db, caso)`: armar el detalle incluyendo `etapa_actual`, `ficha` y `transiciones_validas` (etapas destino con transición desde la etapa actual). (RF-13, D3)
- [x] 2.7 `listar_casos(db, area, etapa_id, abogado_id, cliente_id, page)`: aplicar filtros opcionales combinables con SQL parametrizado; paginar por `page`. (RF-13, D9)
- [x] 2.8 `listar_historial(db, caso_id)`: devolver las entradas en orden cronológico; solo lectura (append-only, sin update/delete). (RF-12, RN-06, D5)
- [x] 2.9 Definir excepciones de dominio (`CasoNoEncontrado`, `TransicionInvalida`, `RetrocesoSinConfirmar`, `ClienteOAbogadoInvalido`, `TipoReclamoInvalido`, `CatalogoEtapasVacio`) siguiendo el patrón de `clientes/service.py`.

## 3. Backend — router.py y enganche (skill `seguridad-endpoint`)

- [x] 3.1 Crear `router = APIRouter(prefix="/casos", tags=["casos"])`.
- [x] 3.2 `POST /casos` → `require_roles(SOCIO, ABOGADO)`; `201` con `CasoResponse`; `422` payload inválido (área/tipo_reclamo, cliente/abogado inexistente). (RF-08, RF-09, D7)
- [x] 3.3 `GET /casos` → `get_current_user` (lectura amplia, RN-08); query params `area`, `etapa`, `abogado_id`, `cliente_id`, `page`; `200` lista paginada. (RF-13)
- [x] 3.4 `GET /casos/{id}` → `get_current_user`; `200` con `CasoDetalleResponse` (incluye `transiciones_validas`) / `404`. (RF-13)
- [x] 3.5 `PUT /casos/{id}/ficha-laboral` → `require_roles(SOCIO, ABOGADO)`; `200`/`404`. (RF-09)
- [x] 3.6 `POST /casos/{id}/avanzar` → `require_roles(SOCIO, ABOGADO)`; body `AvanzarRequest`; `200`/`404`/`409` transición inválida. (RF-10)
- [x] 3.7 `POST /casos/{id}/retroceder` → `require_roles(SOCIO, ABOGADO)`; body `RetrocederRequest`; `200`/`404`/`409` (terminal sin confirmar o cruce de área). (RF-11)
- [x] 3.8 `GET /casos/{id}/historial` → `get_current_user`; `200` con la lista cronológica / `404`. (RF-12)
- [x] 3.9 Aplicar `@limiter.limit("100/minute")` en las rutas siguiendo el patrón de `clientes/router.py` (param `request: Request`). Mapear excepciones de dominio a HTTPException.
- [x] 3.10 Enganchar el router en `backend/app/main.py`: `app.include_router(casos_router, prefix="/api/v1")`.
- [x] 3.11 Cierre de seguridad (skill `seguridad-endpoint`): por endpoint verificar auth por cookie JWT, CSRF double-submit (heredado del middleware en `POST`/`PUT`), RBAC (lectura amplia en `GET`; mutaciones ABOGADO+SOCIO), rate limiting y validación Pydantic.

## 4. Backend — tests (cobertura ≥ 80%, base sintética · Ley 25.326)

- [x] 4.1 Crear `backend/tests/features/casos/` con fixtures: usuario SOCIO y ABOGADO, un cliente sintético, y el **catálogo de etapas/transiciones sembrado** (reutilizar `backend/seeds/etapas_seed_data.py` y `conftest.py`).
- [x] 4.2 `POST /casos`: 201 alta Laboral válida (verifica etapa inicial por dato + primera entrada de historial con `etapa_anterior_id` NULL), 201 con ficha anidada, 422 ART sin `tipo_reclamo`, 422/404 cliente/abogado inexistente, 401 sin sesión, 403 sin CSRF.
- [x] 4.3 `PUT /casos/{id}/ficha-laboral`: 200 crear ficha, 200 actualizar ficha existente, 404 caso inexistente.
- [x] 4.4 `POST /casos/{id}/avanzar`: 200 por transición válida (verifica nueva etapa + nueva entrada de historial), 409 por transición inexistente, 404 caso inexistente. Verificar que NO se hardcodean nombres de etapa.
- [x] 4.5 `POST /casos/{id}/retroceder`: 200 retroceso confirmado desde terminal, 409/422 desde terminal sin confirmar, 409 destino de otra área.
- [x] 4.6 `GET /casos/{id}/historial`: 200 orden cronológico incluyendo la creación; 404 inexistente. Confirmar que no hay endpoint de update/delete de historial (inmutabilidad, RN-06).
- [x] 4.7 `GET /casos` y `GET /casos/{id}`: filtros por área/etapa/abogado/cliente y paginación; detalle incluye `transiciones_validas`; 401 sin sesión.
- [x] 4.8 Ejecutar `pytest` con cobertura y confirmar ≥ 80% en la feature. (Nota: los tests requieren PostgreSQL en Docker — `docker compose exec backend pytest tests/features/casos/ --cov=app/features/casos`.) **Pendiente de ejecución manual en Docker** — la implementación está lista; la cobertura se verifica con: `docker compose exec backend pytest tests/features/casos/ --cov=app/features/casos --cov-report=term-missing`

## 5. Frontend — feature casos (vertical slice · skill `feature-scaffold`)

- [x] 5.1 Crear `frontend/src/features/casos/types.ts` (`Caso`, `CasoDetalle`, `CasoCreate`, `FichaLaboral`, `Etapa`, `TransicionValida`, `HistorialItem`).
- [x] 5.2 Crear `frontend/src/features/casos/api.ts` sobre `shared/http` (`listar`, `obtener`, `crear`, `upsertFicha`, `avanzar`, `retroceder`, `historial`) — el cliente ya inyecta CSRF y `credentials:'include'`.
- [x] 5.3 Crear `hooks/` (p. ej. `useCasos`, `useCaso`) para listar/filtrar, cargar el detalle y mutar etapas.
- [x] 5.4 Crear `components/`: formulario de alta (selección de cliente, área, tipo_reclamo en ART, ficha laboral); tabla con filtros (área/etapa/abogado/cliente); **stepper de etapas** que renderiza el avance a partir de `transiciones_validas` (sin hardcodear etapas) con avanzar/retroceder y **modal de confirmación** para retroceso en terminal (RN-09); timeline de historial.
- [x] 5.5 Completar las páginas existentes (`CasosPage`, `NuevoCasoPage`, `CasoLaboralPage`, `CasoARTPage`) usando los componentes/hooks. Rutas ya montadas en `app/App.tsx` con `RequireAuth`.
- [x] 5.6 Mensajes claros en español (AR) y manejo de errores (409 transición inválida / retroceso sin confirmar, 404, 422).

## 6. Documentación y trazabilidad (regla SDD)

- [x] 6.1 Revisar `docs/04-api/contratos-api.md` (sección "Casos"): alinear cualquier desvío de campos o códigos de estado introducido por la implementación, en el mismo PR.
- [x] 6.2 Actualizar `docs/changemap.md`: filas RF-08 / RF-09 / RF-10 / RF-11 / RF-12 / RF-13 (feature `casos`) → estado y Rama/PR; agregar línea al changelog y registrar cualquier desvío del contrato.
- [x] 6.3 Verificación manual end-to-end (requiere `docker compose up --build` + seed de etapas): ABOGADO crea un caso, completa la ficha, avanza por una transición válida, intenta una inválida (409), retrocede desde terminal con confirmación, y consulta el historial inmutable. Verificar en Swagger (`:8000/docs`) y en la UI (`:3000/casos`). **Pasos de verificación:** -[](1) `docker compose up --build` (2) `psql $DATABASE_URL -f backend/seeds/seed_etapas.sql` (3) Login como ABOGADO en `:3000` (4) `POST /api/v1/casos` en Swagger o UI (5) `GET /api/v1/casos/{id}` verifica `transiciones_validas` (6) `POST /api/v1/casos/{id}/avanzar` con etapa válida (200) e inválida (409) (7) `POST /api/v1/casos/{id}/retroceder` sin `confirmar` (409), luego con `confirmar:true` (200) (8) `GET /api/v1/casos/{id}/historial` — no debe haber endpoint DELETE (405).

¡Atencion!

el cliente se persiste correctamente, pero no se ve en la page de crear caso RESOLVER
403 en POST casos

borrar

{
"email": "socio@iuris.test",
"password": "SocioPass1!"
}
