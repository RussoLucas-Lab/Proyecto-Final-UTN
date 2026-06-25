---
name: etapas-y-transiciones
description: >-
  Patrón correcto para trabajar con el modelo "estados como datos" de Iuris (ADR-0008): tablas
  etapa y transicion_etapa configurables por área (Laboral / ART), seeds idempotentes, unicidad
  (area, nombre) y registro inmutable en historial_caso. Usá esta skill SIEMPRE que se vaya a
  agregar o modificar una etapa o una transición, tocar un seed de estados, cambiar el flujo de un
  caso, mover un caso de etapa, o cuando aparezca la tentación de hardcodear un enum de estados o
  nombres de etapa en backend o frontend. También cuando se mencione "etapa", "transición",
  "estado del caso", "flujo Laboral/ART", "máquina de estados" o "seed de etapas". Su objetivo es
  que NADIE reintroduzca por accidente un enum fijo de estados.
---

# etapas-y-transiciones — estados como datos en Iuris

La decisión de arquitectura más original de Iuris es **modelar el ciclo de vida del caso como
datos configurables, no como un enum fijo** (ADR-0008). Los flujos de Laboral y ART son distintos
y dependientes del cliente; un enum hardcodeado en el código los volvería imposibles de mantener.
Por eso las etapas y las transiciones válidas viven en tablas, parametrizadas por área.

Esto también es lo más fácil de romper sin querer: alcanza con que alguien escriba
`if etapa == "En conciliación"` en un componente, o defina un `Enum` de estados en el backend,
para tirar abajo la abstracción. Esta skill existe para evitarlo.

**Antes de tocar nada:** leé el `ADR-0008`, el modelo `.dbml` (tablas `etapa`, `transicion_etapa`,
`historial_caso`, `caso`) y el seed real. Confirmá la ruta del seed en el repo (estuvo señalado
como ambiguo `docs/seeds` vs `backend/seeds`) antes de editar.

---

## El modelo (qué es qué)

- **`etapa`** — cada etapa posible del ciclo de vida. Está **scopeada por `area`** (Laboral, ART).
  Tiene un flag de etapa terminal. La clave natural es **`(area, nombre)` única**: el mismo nombre
  puede existir en dos áreas distintas, pero no repetirse dentro de la misma área.
- **`transicion_etapa`** — define qué movimientos son válidos: pares `(etapa_origen, etapa_destino)`
  **dentro de la misma área**. Una transición nunca cruza áreas.
- **`historial_caso`** — bitácora **inmutable**: cada cambio de etapa de un caso agrega una fila
  (no se actualiza ni se borra). Es la fuente de verdad del recorrido del caso.
- **`caso`** — referencia su etapa actual por id; el `area` del caso fija qué etapas y transiciones
  le aplican.

## Invariantes que hay que respetar siempre

1. **Cero enums de estado en el código.** Ni `Enum` en el backend, ni literales de nombre de etapa
   en el frontend. Las etapas se leen de la DB / del endpoint correspondiente.
2. **`(area, nombre)` único.** Toda etapa nueva valida que no exista ya en esa área.
3. **Las transiciones no cruzan área.** `etapa_origen.area == etapa_destino.area`.
4. **Mover un caso = validar + registrar.** Cambiar la etapa de un caso solo es válido si existe la
   `transicion_etapa` correspondiente para su área, y SIEMPRE agrega una fila a `historial_caso`.
5. **El historial es inmutable.** Se hace append, nunca update/delete.
6. Recordatorios de dominio: `telegrama` es solo de **Laboral**; `tipo_reclamo`
   (accidente / enfermedad) es solo de **ART**. No mezclar.

---

## Agregar una etapa nueva (procedimiento)

1. **¿Va en el seed o es runtime?** Si es parte del flujo base de un área, va en el **seed**
   (idempotente). Si fuera configurable por el usuario en runtime, va vía endpoint/service — pero
   igual respeta los mismos invariantes.
2. **Editar el seed** agregando la etapa con su `area`, `nombre`, flag terminal, y orden si aplica.
   Mantener el seed **idempotente** (re-ejecutable sin duplicar; upsert por `(area, nombre)`).
3. **Definir sus transiciones** en `transicion_etapa`: desde qué etapa(s) se entra y hacia cuál(es)
   se sale, todas de la misma área. Una etapa sin transiciones queda huérfana (inalcanzable o sin
   salida) — revisar que el grafo del área siga conexo.
4. **¿Migración?** Normalmente **no**: agregar una etapa es agregar *datos*, no cambiar el esquema.
   Solo se crea una migración Alembic si cambia la *estructura* de las tablas. Si te encontrás
   escribiendo una migración para meter una etapa, parate: probablemente va en el seed.
5. **Verificar `area`.** Que la etapa y todas sus transiciones tengan el área correcta y consistente.
6. **Frontend:** que la etapa nueva se renderice por dato (label que viene de la API), sin
   condicionales por nombre hardcodeado.

## Mover un caso de etapa (en el service)

```
1. Cargar el caso y su etapa actual.
2. Buscar transicion_etapa donde origen = etapa_actual y destino = etapa_pedida,
   con area = caso.area.  -> si no existe, es transición inválida: rechazar.
3. Actualizar caso.etapa_actual = etapa_pedida.
4. Append en historial_caso (caso, etapa_destino, timestamp, actor, nota opcional).
   Nunca update/delete sobre historial.
```

---

## Anti-patrones (si ves esto, frená)

- `class EstadoCaso(str, Enum): ...` en el backend → **NO**. Estados van a tabla.
- `if caso.etapa.nombre == "..."` para lógica de flujo → usar `transicion_etapa`, no comparar strings.
- Nombres de etapa hardcodeados en componentes React → renderizar por dato desde la API.
- Una migración Alembic que inserta filas de etapas → eso es seed, no migración de esquema.
- Una transición entre etapas de áreas distintas → inválido por diseño.
- Update o delete sobre `historial_caso` → el historial es append-only.

## Checklist antes de cerrar el cambio

- [ ] La etapa/transición nueva está en el seed (no en una migración), y el seed sigue idempotente.
- [ ] `(area, nombre)` no se duplica dentro del área.
- [ ] Todas las transiciones nuevas son intra-área y dejan el grafo del área coherente (sin etapas huérfanas no intencionales).
- [ ] Mover de etapa valida contra `transicion_etapa` y hace append en `historial_caso`.
- [ ] No se introdujo ningún enum/literal de estado en backend ni frontend.
- [ ] Si tocaste algo de Laboral/ART, respeté que telegrama=solo Laboral y tipo_reclamo=solo ART.
- [ ] Lo reflejé en el `changemap.md` si la trazabilidad lo exige.
