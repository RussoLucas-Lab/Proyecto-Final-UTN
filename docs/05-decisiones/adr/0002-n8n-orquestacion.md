# ADR-0002: n8n como motor de orquestación (BPA)

**Estado:** Aceptada · **Fecha:** 2026-06

## Contexto
Se requieren procesos asíncronos y programados: generación de comunicaciones, reportes y respaldos. Incluirlos en el backend acoplaría lógica heterogénea y dificultaría su mantenimiento.

## Decisión
Delegar la orquestación de procesos a **n8n** (open source, autoalojable), disparado por webhooks (desde el backend) y por cron.

## Consecuencias
- (+) Separación clara entre lo sincrónico (API) y lo asíncrono/programado (n8n).
- (+) Flujos visuales fáciles de auditar y modificar.
- (+) Autoalojamiento, deseable para datos sensibles.
- (−) Una pieza más que desplegar y monitorear.
