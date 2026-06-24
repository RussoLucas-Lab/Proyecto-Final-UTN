# ADR-0003: IA asistencial con humano en el bucle

**Estado:** Aceptada · **Fecha:** 2026-06

## Contexto
La IA puede redactar comunicaciones, pero el dominio jurídico exige responsabilidad profesional sobre todo mensaje enviado a un cliente. El envío autónomo introduciría riesgos legales.

## Decisión
La IA **solo genera borradores**. El abogado revisa, edita y aprueba; el envío es siempre una acción humana explícita (RN-10). Ningún flujo automatiza el envío.

## Detalle de implementación
Toda la IA se implementa con **nodos de agente (AI Agent) de n8n**. El **backend no integra IA** (sin credenciales de LLM, sin prompts, sin llamadas a modelos): solo dispara el webhook validando sesión y rol, y expone, a lo sumo, un endpoint de **solo lectura** que el agente consume como herramienta para obtener el contexto acotado del caso. El agente nunca accede a la base de datos directamente.

## Consecuencias
- (+) Elimina el riesgo de comunicaciones no supervisadas.
- (+) Diferenciador frente a chatbots autónomos.
- (−) No se automatiza el último paso; se asume deliberadamente.
