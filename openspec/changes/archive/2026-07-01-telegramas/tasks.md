## 1. Backend — Feature telegramas

- [x] 1.1 Crear `backend/app/features/telegramas/` con `__init__.py`, `schemas.py`, `service.py`, `router.py`. Registrar el router en `main.py` con prefijo `/casos`.
- [x] 1.2 `schemas.py`: `TelegramaCreate` (`numero: Literal[1,2,3]`, `tipo_comunicacion: TipoComunicacion = OTRO`, `documento_id: int | None`), `TelegramaResponse` (`id`, `caso_id`, `numero`, `tipo_comunicacion`, `resultado`, `documento_id`, `creado_en`), `TelegramaPatchRequest` (`resultado: ResultadoTelegrama`), `TelegramaPatchResponse` (igual a response).
- [x] 1.3 `service.py`: `crear_telegrama(db, caso_id, data, usuario_id) -> Telegrama` — valida que el caso exista (404), valida área Laboral (400 / RN-15), valida `numero` en 1-3, unicidad `(caso_id, numero)` → 409 (RN-16), crea con `resultado=PENDIENTE` (RN-18). `actualizar_resultado(db, telegrama_id, resultado) -> Telegrama` — valida existencia (404), actualiza campo.
- [x] 1.4 `router.py`: `POST /casos/{caso_id}/telegramas` con `get_current_user`, `require_roles(ABOGADO, SOCIO)`, CSRF (inherited del middleware), rate limiting; mapea 400/404/409/422. `PATCH /telegramas/{id}` con mismos guards; mapea 404/422.
- [x] 1.5 Verificar con `seguridad-endpoint`: CSRF presente en ambos endpoints de mutación, RBAC (ABOGADO+SOCIO), rate limit, sin envío externo.

## 2. Backend — Tests

- [x] 2.1 `backend/tests/features/telegramas/conftest.py`: fixtures de caso Laboral con ficha laboral, caso ART, telegrama existente.
- [x] 2.2 `test_router.py` — `POST /casos/{id}/telegramas`: caso ok (201), área ART rechaza (422), número duplicado (409), límite 3 alcanzado (409), número fuera de rango (422), sin auth (401), sin CSRF (403).
- [x] 2.3 `test_router.py` — `PATCH /telegramas/{id}`: actualización ok (200), telegrama inexistente (404), resultado inválido (422), sin auth (401), sin CSRF (403).

## 3. Frontend — Asset y setup

- [x] 3.1 Colocar el PDF rellenable oficial en `frontend/telegrama-oficial.pdf` (raíz del proyecto frontend, junto a `index.html` que es donde Vite sirve los assets estáticos). `pdf-lib` ya está instalado (`package.json`). **Pendiente de provisión manual** — `TelegramaPage.tsx` ya referencia `/telegrama-oficial.pdf` y muestra error visible si falta; comentario de módulo indica dónde colocar el archivo.
- [x] 3.2 `frontend/src/features/telegramas/types.ts`: tipos `TelegramaNumero` (1|2|3), `TipoComunicacion` enum, `ResultadoTelegrama` enum, `TelegramaFormData` (todos los campos del formulario con sus nombres exactos del PDF), `TelegramaRegistrado`.
- [x] 3.3 `frontend/src/features/telegramas/api.ts`: `crearTelegrama(casoId, data)` → `POST /casos/{id}/telegramas`; `actualizarResultado(telegramaId, resultado)` → `PATCH /telegramas/{id}`.

## 4. Frontend — Lógica de generación PDF

- [x] 4.1 `frontend/src/features/telegramas/hooks/useGeneradorTelegrama.ts`: hook que carga datos del caso y mapea `ficha_laboral` + `cliente`. Expone estado editable de cada campo.
- [x] 4.2 `frontend/src/features/telegramas/utils/generarPdf.ts`: `generarPdfTelegrama(pdfBytes, datos)` con nombres exactos del PDF, radio group OTRO por defecto, `try/catch` por campo.
- [x] 4.3 Validación de extensión: `contarPalabras(texto)` en `generarPdf.ts`; `PALABRAS_MINIMAS = 30`.

## 5. Frontend — Componentes y página

- [x] 5.1 `frontend/src/features/telegramas/components/GeneradorTelegrama.tsx`: componente con formulario y selector de número.
- [x] 5.2 `frontend/src/features/telegramas/hooks/useTelegramas.ts`: hook para listar y actualizar resultado de telegramas registrados.
- [x] 5.3 `frontend/src/features/telegramas/TelegramaPage.tsx`: reemplazado mock con datos reales. Carga `GET /casos/{id}` + `GET /clientes/{id}`, inicializa `useGeneradorTelegrama` con datos mapeados. "Generar PDF" → `hook.descargar`. "Guardar como documento" → genera PDF + sube a R2 (initUpload→PUT→registerDocumento) + llama `registrarTelegrama`. Diseño visual original preservado; agrega Card 1 para número y tipo de comunicación. Loading/error states visibles.
- [x] 5.4 Integrar `TelegramaPage` en `CasoLaboralPage` y rutear `/telegrama/:casoId` en `App.tsx` — ya hecho.

## 6. Documentación

- [x] 6.1 `docs/changemap.md`: RF-25.1-.3 y RF-25.4 marcados ✅ con referencia al change `telegramas`; entrada al changelog agregada (2026-07-01).
- [x] 6.2 `docs/04-api/contratos-api.md`: sección Telegramas expandida con `GET/POST /casos/{id}/telegramas`, `PATCH /telegramas/{id}`, `PUT /casos/{id}/telegramas/{numero}/resultado` y schema `TelegramaResponse` completo.
