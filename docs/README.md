<div align="center">

# ⚖️ IURIS

### Sistema de Gestión Jurídica para Estudios Laborales y ART

[![SDD](https://img.shields.io/badge/Metodología-SDD-blue)]()
[![Backend](https://img.shields.io/badge/Backend-FastAPI-green)]()
[![Frontend](https://img.shields.io/badge/Frontend-React-61DAFB)]()
[![Database](https://img.shields.io/badge/Database-PostgreSQL-blue)]()
[![Docker](https://img.shields.io/badge/Deploy-Docker-2496ED)]()

---

### 👥 Equipo de Desarrollo

| Integrante | Rol |
|------------|------|
| **Lucas Russo** | Desarrollador Backend / Arquitectura |
| **Facundo Bustamante** | Desarrollador Frontend |
| **Lisandro Romero** | Desarrollador Full Stack |

---

**Universidad Tecnológica Nacional - FRM**  
**Proyecto Final — Comisión 3**

</div>

---

# 📘 Modelo de Datos

El modelo de datos de Iuris fue diseñado para soportar la gestión integral de expedientes laborales y ART, priorizando:

- Trazabilidad completa de cada caso
- Auditabilidad de los cambios realizados
- Configuración flexible de procesos jurídicos
- Conservación histórica de la información
- Separación clara entre reglas de negocio y estructura persistente

La base de datos constituye el núcleo transaccional del sistema y soporta tanto las operaciones diarias de los abogados como los procesos automatizados ejecutados por servicios externos.
---

# 🎯 Objetivo del Modelo

El sistema permite administrar expedientes jurídicos del ámbito **Laboral** y **ART**, proporcionando:

- 👤 Gestión de clientes
- 📂 Administración de casos
- 🔄 Seguimiento de etapas procesales
- 📝 Registro histórico de movimientos
- 📎 Gestión documental
- 📅 Control de vencimientos
- 🤖 Generación asistida de comunicaciones mediante IA

---

# 🏗️ Principios de Diseño

## 🔄 Estados configurables

Los estados del sistema son datos persistidos y no enums de código.

Las tablas:

- `etapa`
- `transicion_etapa`

permiten modificar flujos sin necesidad de desplegar nuevas versiones del sistema.

---

## 📜 Historial inmutable

La tabla `historial_caso` es **append-only**.

No se permiten:

- UPDATE
- DELETE

Únicamente inserciones.

---

## 🤖 IA bajo supervisión humana

La IA genera borradores de comunicación.

La aprobación y envío siempre requiere intervención de un abogado.

---

## 📎 Gestión documental controlada

Todos los documentos son cargados por usuarios internos del estudio.

Los clientes nunca suben archivos al sistema.

---

# 🧩 Entidades Principales

| Tabla | Función |
|---------|---------|
| `usuario` | Personal del estudio jurídico |
| `cliente` | Persona representada |
| `caso` | Expediente principal |
| `ficha_laboral` | Información de admisión |
| `etapa` | Catálogo de etapas |
| `transicion_etapa` | Flujo permitido entre etapas |
| `historial_caso` | Registro histórico inmutable |
| `telegrama` | Telegramas laborales |
| `documento` | Archivos asociados al caso |
| `vencimiento` | Agenda y recordatorios |
| `comunicacion` | Comunicaciones con clientes |
| `backup` | Registro de respaldos automáticos |

---

# 🔗 Relaciones Principales

| Relación | Cardinalidad |
|------------|------------|
| Cliente → Caso | 1:N |
| Usuario → Caso | 1:N |
| Caso → Ficha Laboral | 1:1 |
| Caso → Documento | 1:N |
| Caso → Vencimiento | 1:N |
| Caso → Comunicación | 1:N |
| Caso → Historial | 1:N |
| Etapa → Caso | 1:N |
| Etapa ↔ Etapa | N:M mediante Transición |

---

# 📊 Diagrama Entidad-Relación

```mermaid
erDiagram
    USUARIO ||--o{ CASO : "responsable"
    CLIENTE ||--o{ CASO : "titulariza"
    CASO ||--|| FICHA_LABORAL : "admisión"
    CASO ||--o{ TELEGRAMA : "tiene (<=3)"
    CASO ||--o{ DOCUMENTO : "contiene"
    CASO ||--o{ VENCIMIENTO : "agenda"
    CASO ||--o{ COMUNICACION : "genera"
    CASO ||--o{ HISTORIAL_CASO : "registra"
    ETAPA ||--o{ CASO : "etapa actual"
    ETAPA ||--o{ TRANSICION_ETAPA : "origen"
    ETAPA ||--o{ TRANSICION_ETAPA : "destino"
    ETAPA ||--o{ HISTORIAL_CASO : "anterior/nueva"
    USUARIO ||--o{ DOCUMENTO : "sube"
    USUARIO ||--o{ COMUNICACION : "aprueba"
    USUARIO ||--o{ HISTORIAL_CASO : "autor"
    USUARIO ||--o{ VENCIMIENTO : "crea"
