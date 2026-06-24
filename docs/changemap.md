# Changemap — Tablero de Control de Cambios (Iuris)

> **Propósito.** Tablero único de trazabilidad entre las specs de `docs/` (fuente de verdad,
> SDD) y la implementación. Mapea cada funcionalidad del MVP a su RF/UC, capa, feature,
> prioridad y estado. Sirve para saber, de un vistazo, qué falta, qué está en curso y dónde
> el código se aparta de la spec.
>
> **Se actualiza en CADA PR.** Todo PR que toque una funcionalidad: (1) cambia el estado de su
> fila, (2) completa la columna Rama/PR, (3) agrega una línea al changelog y, si corresponde,
> (4) registra un desvío. Recordá la regla SDD: si código y spec divergen, **gana la spec** o
> se actualiza la spec **primero**, en el mismo PR.

## Leyenda de estados

🔲 Pendiente · 🟡 En progreso · ✅ Hecho · ⏸️ Bloqueado · 🔄 En revisión

**Prioridad** (deriva de MoSCoW en `01-requisitos/requisitos-funcionales.md`): **P0** = Must · **P1** = Should.
**Capa**: `backend` (FastAPI) · `frontend` (React) · `n8n` (orquestación/IA) · `db` (esquema/seed).

---

## Tabla de trazabilidad del MVP

### Plataforma / Infraestructura (base, sin RF propio — deriva de RNF-07, `07-seguridad-y-despliegue/`)

| ID spec | Funcionalidad | Capa | Feature | Prioridad | Estado | Rama/PR | Notas |
|---------|---------------|------|---------|-----------|--------|---------|-------|
| RNF-07 / 07-seg | Esqueleto del repo + `docker-compose` (frontend, backend, db, n8n) y `GET /health` | backend·frontend·db·n8n | plataforma | P0 | 🔲 | — | Prerequisito de todo. Volúmenes, redes privadas, env vars (sin secretos en repo). |
| RNF-09 / 10-seg | Migraciones Alembic + esquema base (DBML v2) | db·backend | plataforma | P0 | 🔲 | — | Fuente: `03-arquitectura/modelo-de-datos.dbml`. |
| ADR-0008 / RN-04 | Seed del ciclo de vida (18 etapas, 19 transiciones) | db·backend | casos | P0 | 🔲 | — | `docs/seeds/seed_etapas.sql` + `.py`. Requiere esquema migrado. |

### auth

| ID spec | Funcionalidad | Capa | Feature | Prioridad | Estado | Rama/PR | Notas |
|---------|---------------|------|---------|-----------|--------|---------|-------|
| RF-01 / UC-01 | Login: emite access (15m) + refresh (7d) en cookies HttpOnly/Secure/SameSite | backend·frontend | auth | P0 | 🔲 | — | `refresh_token` revocable en DB. Incluye renovación `POST /auth/refresh`. |
| RF-02 | RBAC: roles SOCIO/ABOGADO + cuenta activa por endpoint | backend | auth | P0 | 🔲 | — | RNF-01. |
| RF-04 / UC-01 | Logout: revoca refresh + limpia cookies + log del evento | backend·frontend | auth | P0 | 🔲 | — | — |
| RNF-11 | CSRF en mutaciones (token / double-submit) | backend·frontend | auth | P0 | 🔲 | — | Double-submit cookie: `csrf_token` (no HttpOnly) + header `X-CSRF-Token`. Ver §5 de `07-seguridad-y-despliegue/`. |

### usuarios

| ID spec | Funcionalidad | Capa | Feature | Prioridad | Estado | Rama/PR | Notas |
|---------|---------------|------|---------|-----------|--------|---------|-------|
| RF-03 | ABM de usuarios (alta / edición / desactivación) — solo SOCIO | backend·frontend | usuarios | P0 | 🔲 | — | RN-07. Endpoints `GET/POST /usuarios`, `PUT/PATCH /usuarios/{id}` en `contratos-api.md`; UC-13 en `casos-de-uso.md`. |

### clientes

| ID spec | Funcionalidad | Capa | Feature | Prioridad | Estado | Rama/PR | Notas |
|---------|---------------|------|---------|-----------|--------|---------|-------|
| RF-05 / UC-02 | Crear cliente (admisión, datos de la persona); DNI único → 409 | backend·frontend | clientes | P0 | 🔲 | — | RN-03. Body de `POST /clientes` debe incluir `cuil`, `domicilio_real` (faltan en el ejemplo de API). |
| RF-06 | Editar y consultar cliente | backend·frontend | clientes | P0 | 🔲 | — | `GET/PUT /clientes/{id}`. |
| RF-07 | Listar y buscar clientes (nombre/DNI) | backend·frontend | clientes | P1 | 🔲 | — | `GET /clientes?search=` (en API figura como RF-06; corregir etiqueta). |

### casos

| ID spec | Funcionalidad | Capa | Feature | Prioridad | Estado | Rama/PR | Notas |
|---------|---------------|------|---------|-----------|--------|---------|-------|
| RF-08 / UC-03 | Crear caso (cliente + abogado + área; ART → tipo_reclamo); etapa inicial + 1ª entrada de historial | backend·frontend | casos | P0 | 🔲 | — | RN-01, RN-05, RN-11. `etapa_actual_id` de la misma área (validar en servicio). |
| RF-09 / UC-03 | Registrar ficha laboral de admisión (1:1 con el caso) | backend·frontend | casos | P0 | 🔲 | — | Anidada en `POST /casos` (opcional); `PUT /casos/{id}/ficha-laboral` para crear/actualizar. |
| RF-10 / UC-04 | Avanzar etapa según transiciones válidas del área | backend·frontend | casos | P0 | 🔲 | — | RN-04, RN-05. `POST /casos/{id}/avanzar`. |
| RF-11 / UC-04 | Retroceder etapa con confirmación explícita | backend·frontend | casos | P0 | 🔲 | — | RN-09. `{ "confirmar": true }`. |
| RF-12 / UC-04 | Historial cronológico inmutable | backend·frontend | casos | P0 | 🔲 | — | RN-05, RN-06. `historial_caso` append-only. |
| RF-13 | Listar y filtrar casos (área/etapa/abogado/cliente) | backend·frontend | casos | P1 | 🔲 | — | Lectura amplia para todo usuario (RN-08). |

### documentos

| ID spec | Funcionalidad | Capa | Feature | Prioridad | Estado | Rama/PR | Notas |
|---------|---------------|------|---------|-----------|--------|---------|-------|
| RF-14 / UC-05 | Subir documentos (drag&drop, R2 URL prefirmada, init→PUT→registrar). Solo abogado | backend·frontend | documentos | P0 | 🔲 | — | RN-02, RN-12, ADR-0007. `415` formato no permitido. |
| RF-15 | Listar / previsualizar / descargar (URL prefirmada) | backend·frontend | documentos | P0 | 🔲 | — | `GET /documentos/{id}/url`. |

### comunicaciones (IA asistencial — vive en n8n)

| ID spec | Funcionalidad | Capa | Feature | Prioridad | Estado | Rama/PR | Notas |
|---------|---------------|------|---------|-----------|--------|---------|-------|
| RF-16 / UC-06 | Generar borrador de actualización (WF-01): backend dispara webhook n8n; agente usa `GET /internal/casos/{id}/contexto` | backend·n8n·frontend | comunicaciones | P0 | 🔲 | — | RN-10. `503` si IA no disponible. Backend SIN IA (ADR-0003). |
| RF-17 / UC-06 | Editar el borrador antes de usarlo | frontend | comunicaciones | P0 | 🔲 | — | `POST /casos/{id}/actualizacion` persiste el borrador (`tipo=MANUAL`, `estado=PENDIENTE_REVISION`) y lo devuelve con su id. |
| RF-18 | No enviar nada automáticamente (acción humana explícita) | backend·frontend·n8n | comunicaciones | P0 | 🔲 | — | RN-10, RNF-04. Restricción transversal. |
| RF-26 / UC-10 | Batch 15 días (WF-05): detectar pendientes, generar, persistir `PENDIENTE_REVISION`, revisar en dashboard | backend·n8n·frontend | comunicaciones | P1 | 🔲 | — | RN-19..23. Cadencia/idempotencia en backend (`GET /internal/casos/pendientes-actualizacion`). |

### telegramas (determinístico, sin IA, sin n8n)

| ID spec | Funcionalidad | Capa | Feature | Prioridad | Estado | Rama/PR | Notas |
|---------|---------------|------|---------|-----------|--------|---------|-------|
| RF-25.1-.3 / UC-09 | Generar telegrama Ley 23.789 prellenado y editable (pdf-lib en navegador) + descargar PDF | frontend | telegramas | P0 | 🔲 | — | RN-15 (solo Laboral), RN-17. Prellenado desde `GET /casos/{id}` + `ficha_laboral`. |
| RF-25.4 / RN-18 | Guardar PDF como documento del caso y registrar el `telegrama` (nº 1-3, resultado PENDIENTE) | backend·frontend | telegramas | P1 | 🔲 | — | RN-16. `POST /casos/{id}/telegramas` + `PATCH /telegramas/{id}`. |

### vencimientos / agenda

| ID spec | Funcionalidad | Capa | Feature | Prioridad | Estado | Rama/PR | Notas |
|---------|---------------|------|---------|-----------|--------|---------|-------|
| RF-19 | Registrar vencimientos/movimientos del caso | backend·frontend | vencimientos | P0 | 🔲 | — | `POST /casos/{id}/vencimientos` + `PATCH /vencimientos/{id}` (`{ "completado": true }`). |
| RF-20 / UC-11 | Vista calendario de movimientos (todo el estudio, sin notificaciones) | backend·frontend | vencimientos | P1 | 🔲 | — | `GET /vencimientos?desde=&hasta=`. |

### backups

| ID spec | Funcionalidad | Capa | Feature | Prioridad | Estado | Rama/PR | Notas |
|---------|---------------|------|---------|-----------|--------|---------|-------|
| RF-21 | Respaldo automático programado (cron, WF-02) + respaldo manual (SOCIO) | n8n·backend | backups | P0 | 🔲 | — | RN-13, RNF-08. `POST /backups`. n8n genera Excel → storage → registra. |
| RF-22 / UC-12 | Historial de respaldos (fecha, tipo, estado) — SOCIO | backend·frontend | backups | P0 | 🔲 | — | `GET /backups`. |

---

## Registro cronológico (changelog)

| Fecha | Qué cambió | Specs afectadas | Autor |
|-------|------------|-----------------|-------|
| 2026-06-24 | Creación del changemap: orientación inicial, análisis de consistencia y tabla de trazabilidad del MVP precargada (todas las filas 🔲 Pendiente). Sin código. | Todas las de `docs/` (lectura) | Lucas / Claude Code |
| 2026-06-24 | Correcciones de cosmética en docs: etiqueta RF-06→RF-07 en `contratos-api.md`; artefacto heredoc eliminado de `seguridad-y-despliegue.md`; referencia `07-operacion/` → `09-operacion/` en `arquitectura-del-sistema.md`; ruta del seed corregida a `backend/seeds/` en `CLAUDE.md`. Ítems 9-12 de pendientes cerrados. | `04-api/contratos-api.md`, `07-seguridad-y-despliegue/seguridad-y-despliegue.md`, `03-arquitectura/arquitectura-del-sistema.md`, `CLAUDE.md` | Lucas |
| 2026-06-24 | Sincronización docs #1-8: endpoints de usuarios (UC-13), ficha laboral (`PUT /casos/{id}/ficha-laboral`), telegramas (`POST/PATCH`), comunicación manual (persiste en BD), vencimientos (`PATCH /vencimientos/{id}`), CSRF (double-submit cookie) y campos de telegrama en modelo DBML. Todos los huecos de spec cerrados; RF-23/RF-24 confirmados intencionales. Sin huecos abiertos. | `04-api/contratos-api.md`, `02-comportamiento/casos-de-uso.md`, `07-seguridad-y-despliegue/seguridad-y-despliegue.md`, `03-arquitectura/modelo-de-datos.dbml`, `03-arquitectura/modelo-de-datos.md`, `08-features/generador-telegramas.md` | Lucas |

---

## Desvíos respecto de la spec

> Registrar acá cada vez que el código se aparte de una spec. Regla SDD: **gana la spec**, o se
> actualiza la spec **primero** (en el mismo PR). Un desvío sin ADR o sin actualización de spec
> es deuda que debe resolverse.

| Fecha | Funcionalidad | Spec afectada | Qué se desvía y por qué | ADR / spec actualizada | Estado |
|-------|---------------|---------------|-------------------------|------------------------|--------|
| — | — | — | (sin desvíos: aún no hay código) | — | — |

---

## Pendientes de confirmar (lista viva)

Hallazgos del análisis de consistencia. **B** = bloqueante para su feature (no para el arranque del MVP).
Marcar resuelto cuando se actualice la spec correspondiente.

### Huecos (spec incompleta)

1. ~~**[B] RF-03 sin contrato de API ni caso de uso.**~~ ✅ Resuelto 2026-06-24 — `GET/POST /usuarios`, `PUT/PATCH /usuarios/{id}` definidos en `04-api/contratos-api.md`; `UC-13` en `02-comportamiento/casos-de-uso.md`.
2. ~~**[B] RF-09 (ficha laboral) sin endpoint.**~~ ✅ Resuelto 2026-06-24 — `POST /casos` acepta `ficha_laboral` anidada (opcional); `PUT /casos/{id}/ficha-laboral` la crea o actualiza.
3. ~~**[B] Registro de telegrama sin endpoint (RF-25.4 / RN-18).**~~ ✅ Resuelto 2026-06-24 — `POST /casos/{id}/telegramas` (crea con `resultado=PENDIENTE`) + `PATCH /telegramas/{id}` (actualiza resultado).
4. ~~**Comunicación manual no se persiste.**~~ ✅ Resuelto 2026-06-24 — `POST /casos/{id}/actualizacion` persiste el borrador como `comunicacion` (`tipo=MANUAL`, `estado=PENDIENTE_REVISION`) y lo devuelve con su id.
5. ~~**Vencimiento `completado` sin endpoint.**~~ ✅ Resuelto 2026-06-24 — `PATCH /vencimientos/{id}` con `{ "completado": true }` entra en el MVP.
6. ~~**Mecanismo CSRF sin especificar.**~~ ✅ Resuelto 2026-06-24 — double-submit cookie: backend emite `csrf_token` (no HttpOnly); frontend reenvía en `X-CSRF-Token`. Especificado en §5 de `07-seguridad-y-despliegue/seguridad-y-despliegue.md`.
7. ~~**Campos de telegrama ausentes en el modelo.**~~ ✅ Resuelto 2026-06-24 — `ramo_actividad` y `direccion_trabajo_cp/_localidad/_provincia` agregados a `ficha_laboral`; `domicilio_real_cp/_localidad/_provincia` a `cliente`. Ver DBML v2 y `08-features/generador-telegramas.md`.

### Inconsistencias menores / cosméticas

8. ~~**Numeración de RF**: no existen RF-23 ni RF-24 (hueco por retiro de reportes/facturación).~~ ✅ Resuelto 2026-06-24 — confirmado intencional: RF-23 y RF-24 fueron descartados junto con el módulo de reportes/facturación. No hay hueco pendiente.
9. ~~**Etiquetas de RF en la API**: `GET /clientes` estaba etiquetado `RF-06`.~~ ✅ Resuelto 2026-06-24 — corregido a `RF-07` en `04-api/contratos-api.md`.
10. ~~**Artefacto de heredoc** al final de `seguridad-y-despliegue.md`.~~ ✅ Resuelto 2026-06-24 — eliminado.
11. ~~**Referencias a `07-operacion/`** en `arquitectura-del-sistema.md`.~~ ✅ Resuelto 2026-06-24 — corregido a `09-operacion/`.
12. ~~**Ruta del seed** en `CLAUDE.md` (raíz) apuntaba a `docs/seeds/`.~~ ✅ Resuelto 2026-06-24 — ahora `backend/seeds/seed_etapas.sql`.

### Coherencias verificadas (OK)

- Modelo de datos ↔ reglas de negocio: estados como datos (`etapa`/`transicion_etapa`), historial
  inmutable, `tipo_reclamo` solo ART, telegrama solo Laboral, documento siempre con `subido_por`,
  comunicación con aprobación humana — todos reflejados en DBML + invariantes de servicio.
- Etapas terminales (Acuerdo / Indemnización / Sentencia) coherentes entre RN-09, diagramas y `es_terminal`.
- IA confinada a n8n y humano en el bucle: coherente en arquitectura, API (`/internal/*`), agentes-ia y RNF-04.
