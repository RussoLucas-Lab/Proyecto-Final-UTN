# ADR-0006: OpenAI como proveedor del modelo de lenguaje

**Estado:** Aceptada · **Fecha:** 2026-06

## Contexto
El sub-nodo *Chat Model* del nodo AI Agent de n8n (ver ADR-0003) necesita un proveedor de LLM para la redacción de borradores de comunicaciones.

## Decisión
Usar **OpenAI** a través del nodo `OpenAI Chat Model` de n8n. Modelo por defecto `gpt-4o-mini` (económico y suficiente para redacción breve), con opción de `gpt-4o` si se requiere mayor calidad. Credencial gestionada en n8n (`IA_API_KEY`).

## Consecuencias
- (+) Buena calidad de redacción en español; integración nativa con n8n.
- (+) Costo controlado con `gpt-4o-mini`.
- (−) Dependencia de un proveedor externo y costo por uso.
- (−) El contexto del caso (acotado) sale hacia la API de OpenAI. **Mitigación:** solo se envía el contexto mínimo necesario (no la base completa); en pruebas se usan datos sintéticos (ADR-0004); evaluar opciones de no-entrenamiento del proveedor. La alternativa de modelos locales queda como trabajo futuro.
