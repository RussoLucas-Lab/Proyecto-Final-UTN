---
name: n8n-workflow
description: >-
  Patrón correcto para armar y conectar workflows de n8n en Iuris (WF-XX): cómo autenticar
  n8n↔backend con X-Internal-Secret, cómo manejar env vars y secretos dentro de tool sub-nodes de un
  AI Agent, y cómo editar workflows de forma segura vía la API REST de n8n. Usá esta skill SIEMPRE
  que se vaya a crear o editar un workflow de n8n, agregar un tool node o un nodo AI Agent, conectar
  un nodo contra el backend, gestionar un secreto/credencial en un nodo, o tocar `n8n/workflows/*.json`
  — aunque no se diga la palabra "n8n". También cuando se mencione "workflow", "AI Agent", "webhook",
  "tool node", "X-Internal-Secret" o "N8N_API_KEY". Su objetivo es que nadie hardcodee un secreto en
  un nodo n8n, ni intente resolver `$env` directo dentro de un tool sub-node (no funciona), ni agregue
  IA fuera de n8n.
---

# n8n-workflow — armar y conectar workflows n8n en Iuris

n8n es el **único** lugar donde vive la IA en Iuris (ADR-0003, ADR-0006) — nunca se agrega un LLM,
una clave de OpenAI ni un prompt al backend o al frontend. Cada workflow genera **borradores**; el
envío al cliente siempre pasa por revisión humana (RN-10). Esta skill nace de un bug real en WF-01:
un secreto quedó hardcodeado en un nodo porque `$env` no se resuelve donde uno esperaría, y de los
detalles no obvios de editar workflows por API. Existe para que no se repita.

**Antes de tocar un workflow:** confirmá `BACKEND_URL`, `N8N_INTERNAL_SECRET` y `N8N_API_KEY` en
`.env`, y mirá el servicio `n8n` en `docker-compose.yml` (env vars, `N8N_BLOCK_ENV_ACCESS_IN_NODE=false`).
Los workflows se versionan como export JSON en `n8n/workflows/*.json` — todo cambio en n8n debe
reflejarse ahí (backup versionado en el repo).

---

## Invariantes que hay que respetar siempre

1. **Cero secretos en texto plano en un nodo.** Ningún header, credencial ni valor de nodo lleva el
   secreto pegado literal — siempre se lee de una env var del contenedor (`$env.X`).
2. **`$env` directo NO funciona dentro de un tool sub-node.** Ver patrón abajo.
3. **La IA vive solo en n8n.** Nada de OpenAI/prompts/LLM en `backend/` ni `frontend/`.
4. **Humano en el bucle (RN-10).** El workflow arma el borrador; nunca envía la comunicación
   directo al cliente sin aprobación de un abogado.
5. **n8n → backend se autentica con `X-Internal-Secret`** contra endpoints `/api/v1/internal/...`,
   nunca contra endpoints normales de usuario.

---

## Gotcha: `$env` no se resuelve dentro de un tool sub-node

Un tool sub-node (nodo conectado al AI Agent por conexión **`ai_tool`**, ej.
`@n8n/n8n-nodes-langchain.toolHttpRequest`) es invocado dinámicamente por el LLM, en un sandbox de
expresiones **distinto** al de la cadena principal (`main`). Ahí `={{ $env.N8N_INTERNAL_SECRET }}`
puesto directo **no resuelve**, aunque `N8N_BLOCK_ENV_ACCESS_IN_NODE=false` esté seteado. En cambio,
referenciar datos de un nodo ya ejecutado en la cadena principal con `$('NodeName').first()...` **sí
funciona** dentro del tool sub-node (así es como ya se accede a `$('Webhook Trigger')` para leer el
body del webhook).

**Patrón correcto:** resolvé la env var en un nodo **Set** (`n8n-nodes-base.set`, "Edit Fields",
typeVersion 3.4) puesto en la cadena principal, y hacé que el tool sub-node referencie ese nodo en
vez de `$env`:

```
Webhook Trigger → Set Internal Secret → AI Agent → Respond to Webhook
                                            │
                                            ├─(ai_languageModel)── OpenAI Chat Model
                                            └─(ai_tool)─────────── tool_http_request
```

- **Set Internal Secret** → campo `internal_secret` = `={{ $env.N8N_INTERNAL_SECRET }}`
- **tool_http_request**, header `X-Internal-Secret` = `={{ $('Set Internal Secret').first().json.internal_secret }}`

Esto aplica a cualquier env var (no solo el secreto interno) que un tool sub-node necesite leer.

---

## Editar un workflow vía API REST de n8n

Con `N8N_API_KEY` (`.env`) se puede leer/editar workflows sin pasar por la UI:

```bash
curl -H "X-N8N-API-KEY: $N8N_API_KEY" http://localhost:5678/api/v1/workflows/<id>
```

El `PUT` es más estricto que lo que devuelve el `GET` — reenviar el objeto tal cual falla con
`"request/body/X must NOT have additional properties"`. Antes de hacer `PUT`:

- El body solo lleva `name`, `nodes`, `connections`, `settings` (no todo el objeto del `GET`).
- Borrar el campo `description` de cada nodo (el `GET` lo devuelve, el `PUT` lo rechaza).
- Reducir `settings` a los campos mínimos aceptados (p. ej. `{ "executionOrder": "v1" }`) — campos
  como `binaryMode` que trae el `GET` hacen fallar el `PUT`.

Después de un `PUT`, volvé a hacer `GET` para regenerar el backup en `n8n/workflows/*.json`
(envolviendo el resultado en un array, mismo formato que usa `n8n export:workflow`). El CLI
`n8n export:workflow` dentro del container puede fallar en este entorno (Windows + Docker Desktop,
error `ENOENT` con un path de Windows) — si pasa, usar el `GET` de la API como alternativa.

---

## Anti-patrones (si ves esto, frená)

- Un valor de secreto pegado literal en un header/credencial de un nodo n8n.
- `={{ $env.ALGO }}` puesto directo en un parámetro de un nodo conectado por `ai_tool`.
- Reenviar el `GET` completo de un workflow al `PUT` sin limpiar `description`/`settings`.
- Un nodo que llama a un endpoint normal del backend (con cookie/JWT de usuario) en vez de al
  `/api/v1/internal/...` con `X-Internal-Secret`.
- Un workflow que dispara el envío de la comunicación sin pasar por aprobación humana (RN-10).
- Un nodo AI Agent / Chat Model agregado fuera de n8n, o una clave de OpenAI fuera de `.env`/n8n.

## Checklist antes de cerrar un workflow nuevo o editado

- [ ] Ningún secreto en texto plano en un nodo — todo sale de env vars del `docker-compose.yml`/`.env`.
- [ ] Si un tool sub-node necesita una env var, pasa por un nodo Set en la cadena principal (no `$env` directo).
- [ ] Las llamadas al backend usan `/api/v1/internal/...` con `X-Internal-Secret`.
- [ ] El workflow no envía nada al cliente sin revisión humana (RN-10).
- [ ] Se re-exportó el workflow a `n8n/workflows/*.json` y no quedó ningún secreto en texto plano ahí (grep antes de commitear).
- [ ] Si se editó vía API REST, se verificó con `GET` tras el `PUT` que los cambios quedaron aplicados, y se probó con un trigger real.
