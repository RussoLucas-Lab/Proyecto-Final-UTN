# Iuris — Base de Conocimiento del Proyecto

Especificaciones de **Iuris**, plataforma de gestión jurídica (áreas Laboral y ART) con automatización de procesos (n8n), inteligencia asistencial y almacenamiento en Cloudflare R2.

Este repositorio es la **fuente única de verdad** del desarrollo. Sigue **Spec Driven Development (SDD)**: cada funcionalidad se especifica antes de implementarse, y estas specs son tanto documentación del equipo como contexto para las herramientas de IA (Claude Code, Cursor, Copilot). Los `CLAUDE.md` (raíz, `backend/`, `frontend/`) resumen las reglas y apuntan a estas specs.

## Estructura

| Carpeta | Contenido |
|---------|-----------|
| `00-vision/` | Objetivos, alcance y glosario del dominio |
| `01-requisitos/` | Requisitos funcionales, no funcionales y reglas de negocio |
| `02-comportamiento/` | Casos de uso e historias de usuario |
| `03-arquitectura/` | Arquitectura, modelo de datos (`.md`, `.dbml`, `README.md`), diagramas y agentes de IA |
| `04-api/` | Contratos de la API REST |
| `05-decisiones/adr/` | Architecture Decision Records (ADR-0001 … ADR-0009) |
| `06-desarrollo/` | Convenciones de desarrollo |
| `07-seguridad-y-despliegue/` | Seguridad, autenticación, RBAC, Docker y despliegue |
| `08-features/` | Generador de telegramas y batch de actualizaciones |
| `09-operacion/` | Documentación técnica y operativa |
| (seeds) | El seed del ciclo de vida (etapas + transiciones) vive en `backend/seeds/`. |

## Convención de identificadores

- `OBJ-xx` objetivos · `RF-xx` requisitos funcionales · `RNF-xx` requisitos no funcionales
- `RN-xx` reglas de negocio · `UC-xx` casos de uso · `US-xx` historias de usuario
- `ADR-xxxx` decisiones de arquitectura · `WF-xx` workflows de n8n

## Decisiones clave (resumen)

- **IA solo en n8n** (nodos AI Agent + OpenAI); el backend no integra IA (ADR-0003, ADR-0006).
- **Humano en el bucle**: ninguna comunicación se envía sola (RN-10).
- **Estados como datos**: etapas y transiciones configurables por área (ADR-0008).
- **Documentos en R2** (S3-compatible), bucket privado + URLs prefirmadas (ADR-0007).
- **Código feature-first** (vertical slice) en backend y frontend (ADR-0009).
- **Confidencialidad**: datos sintéticos en pruebas (ADR-0004); seguridad en `07-`.
- **Fuera de alcance**: reportes/facturación, OCR, portal de clientes, integración judicial.

## Flujo SDD

Necesidad → Especificación → Validación → Diseño → Implementación → Pruebas → Despliegue.
Si código y spec divergen, **gana la spec** (o se actualiza la spec primero, en el mismo PR).
