# CLAUDE.md — Frontend (Iuris)

Interfaz web del estudio, en **React**. Consume la API REST del backend (`/api/v1`). Interfaz en **español (Argentina)**. Specs en `docs/`.

> **Estilos y diseño:** esta sección la completa el equipo más adelante (paleta, tipografías, sistema de componentes). Mantener este archivo enfocado en arquitectura, comportamiento y seguridad hasta entonces.

## Reglas

- **Nunca** llames a n8n ni a OpenAI desde el frontend. Toda acción pasa por el backend.
- **Auth por cookies**: el access/refresh viajan en cookies `HttpOnly` (el frontend **no** lee ni guarda el token). Las peticiones envían la cookie automáticamente (`credentials: 'include'`). En las mutaciones, leer la cookie `csrf_token` (esta sí es legible por JS) y reenviarla en el header `X-CSRF-Token` (double-submit cookie). El token de sesión sigue siendo HttpOnly e inaccesible. (ver `docs/07-seguridad-y-despliegue/`)
- **No** usar `localStorage`/`sessionStorage` para el token ni para datos sensibles del caso.
- Lenguaje y mensajes **claros y simples** (el público del estudio es vulnerable y suele estar desinformado).

## Estructura (feature-first / vertical slice)

El código se organiza **por features**, no por tipos. Cada feature es una carpeta autocontenida con sus componentes, hooks, llamadas a la API y tipos. Lo transversal vive en `shared/`; el armazón de la app, en `app/`. Evitar carpetas globales tipo `components/` con todo mezclado.

```
frontend/src/
  app/               # entrypoint, router, providers y layout global (sidebar/topbar)
  shared/            # TRANSVERSAL: cliente HTTP (credentials + CSRF), UI base (botones,
                     #   badges, tabla, modal), hooks, utils y tipos comunes
  features/          # una carpeta por feature, autocontenida
    auth/
    dashboard/
    clientes/
    casos/           # listado, detalle, stepper de etapas, historial
    documentos/
    comunicaciones/  # modal IA + revisión del batch
    telegramas/      # generador con pdf-lib (client-side)
    vencimientos/    # agenda / calendario
    usuarios/        # solo SOCIO
    respaldos/       # solo SOCIO
```

Cada feature contiene típicamente: `components/`, `hooks/`, `api.ts` (llamadas de esa feature), `types.ts` y sus `pages`/`routes`. Los componentes verdaderamente reutilizables van en `shared/`, no dentro de una feature. (ADR-0009)

## Pantallas y comportamiento clave (ver `docs/02-comportamiento/`)

- **Dashboard**: métricas por área; bloque **"Mensajes listos para revisar"** (borradores del batch de 15 días, estado `PENDIENTE_REVISION`) con acciones revisar/aprobar/copiar; movimientos pendientes.
- **Detalle de caso** (pantalla estrella): cliente, área, código de expediente y **etapa actual**; un **stepper/timeline guiado por datos** (`etapa` + `transicion_etapa`) con botones **"Avanzar"** y **"Retroceder (con confirmación)"** — solo ofrecer las transiciones válidas que devuelve el backend; documentos, historial y vencimientos. Botón "Generar actualización" y, en Laboral, "Generar telegrama".
- **Modal de actualización IA**: muestra el borrador editable con la nota de que el abogado revisa y aprueba; botones Editar / Copiar / Aprobar. Nada se envía solo (RN-10).
- **Ingresar cliente**: formulario de admisión estructurado (datos de la persona + ficha laboral).
- **Documentos**: carga *drag & drop* mediante **URL prefirmada** (init en backend → PUT a R2 → registrar). **Solo el abogado sube** (no mostrar carga por el cliente). (RN-12)
- **Generador de telegramas**: feature **determinística, sin IA** — llena el formulario oficial (Ley 23.789) con **pdf-lib en el navegador**, prellenado desde el caso, editable, y genera/descarga el PDF. Ver `docs/08-features/generador-telegramas.md`.
- **Agenda**: vista tipo calendario con los movimientos a realizar (de todo el estudio); sin sistema de notificaciones.

## Estados del caso (badges)

Los nombres de etapa vienen del backend (datos), no hardcodear. Diferencian por área (Laboral / ART) y marcan las terminales (Acuerdo, Indemnización, Sentencia).

## Comandos

- `npm install` · `npm run dev` (`:3000`) · `npm run build` · `npm run lint` · `npm test`.
- Formateo **Prettier**, lint **ESLint** antes de commitear.

## No hacer

- No invocar n8n/OpenAI directamente. No leer/guardar tokens en JS. No persistir datos sensibles en el navegador.
- No hardcodear las etapas ni la lógica de transiciones (vienen del backend).
