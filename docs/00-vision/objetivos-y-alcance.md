# Objetivos y Alcance del Proyecto

## Objetivo general

Diseñar, desarrollar e implementar una plataforma integral de gestión jurídica (Iuris) que, mediante la centralización de la información en una base de datos relacional y la orquestación de procesos automatizados con n8n, junto con el uso asistencial de modelos de lenguaje, permita a un estudio jurídico de las áreas **Laboral** y **ART** simplificar y agilizar sus tareas administrativas repetitivas.

## Objetivos específicos

| ID | Objetivo |
|----|----------|
| OBJ-01 | Centralizar en una única fuente de verdad la información de casos, clientes, documentos y comunicaciones. |
| OBJ-02 | Reducir el tiempo y los pasos manuales de las tareas administrativas críticas. |
| OBJ-03 | Asistir la comunicación con clientes mediante IA, conservando la decisión humana. |
| OBJ-04 | Automatizar respaldos con trazabilidad y auditoría. |
| OBJ-05 | Garantizar confidencialidad y control de acceso sobre datos sensibles. |

## Alcance

### Áreas del derecho

El sistema cubre **Laboral** y **ART (Riesgos del Trabajo)**. El área de **Tránsito queda fuera de alcance** (posible incorporación futura). Cada área tiene su propio ciclo de vida de casos (ver `02-comportamiento/` y `03-arquitectura/diagramas.md`).

### Dentro del alcance (MVP)

- Autenticación, sesiones seguras y roles (SOCIO, ABOGADO).
- Gestión de clientes con formulario de admisión estructurado.
- Gestión de casos con ciclo de vida configurable por área (etapas y transiciones).
- Gestión documental con carga *drag & drop* (PDF, Word, imagen) en object storage (Cloudflare R2).
- Generación asistida por IA de borradores de comunicaciones, individual y por lote cada 15 días (sin envío automático).
- Generador de telegramas (Ley 23.789) para casos Laborales.
- Agenda de vencimientos / movimientos pendientes (vista calendario, sin notificaciones).
- Respaldo automático con n8n e historial de backups.

### Fuera del alcance

- **Reportes y facturación** (retirado del alcance por el estudio).
- OCR para lectura de códigos de expediente.
- Portal de autoconsulta para clientes.
- Integración directa con sistemas judiciales (IOL, sistema notarial): sin APIs públicas; se documenta como restricción.
- Envío automático de comunicaciones (siempre hay revisión humana).

## Supuestos

- Los usuarios profesionales operan desde navegador de escritorio.
- En desarrollo y demostración se usa una **base de datos sintética** (datos ficticios) que replica la estructura real.

## Restricciones

- La IA **nunca** envía comunicaciones de forma autónoma (RN-10).
- Toda la IA vive en n8n; el backend no integra IA (ADR-0003).
- El tratamiento de datos se ajusta a la Ley 25.326.
- Stack fijo: React, FastAPI, PostgreSQL, n8n, Docker; storage en R2; modelo OpenAI (en n8n).
