# ADR-0008: Estados del caso modelados como datos (no como enum)

**Estado:** Aceptada · **Fecha:** 2026-06

## Contexto
El relevamiento reveló que el ciclo de vida de los casos es **específico por área** (Laboral y ART) y está compuesto por muchas etapas concretas del procedimiento jurídico, con subestados (resultados de telegramas), bifurcaciones (acuerdo/juicio, favorable/desfavorable) y nodos terminales propios. Un enum fijo de estados sería rígido, no contemplaría las diferencias por área y obligaría a modificar código ante cada ajuste del flujo.

## Decisión
Modelar los estados como **datos configurables**:
- `etapa`: catálogo de etapas por área y fase (extrajudicial/judicial), con orden y marca de terminal.
- `transicion_etapa`: grafo de transiciones permitidas entre etapas.
- `caso.etapa_actual_id`: estado actual del caso.

El avance valida contra `transicion_etapa`; el retroceso se habilita con confirmación a nivel de aplicación; cada movimiento se registra en `historial_caso` (inmutable). Los flujos reales se cargan vía seed (`seeds/`).

## Consecuencias
- (+) Agregar o ajustar etapas/transiciones es **cargar datos**, no modificar código.
- (+) Soporta ciclos de vida distintos por área y su evolución futura.
- (+) Habilita un *stepper*/timeline en el frontend manejado por datos.
- (−) La integridad "la etapa pertenece al área del caso" no la garantiza el esquema; se valida en la capa de servicio.
- Requiere un seed inicial de etapas y transiciones (provisto y verificado).
