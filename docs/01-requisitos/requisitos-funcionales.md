# Requisitos Funcionales (RF)

Prioridad MoSCoW: **M** (Must), **S** (Should), **C** (Could). Roles: **SOCIO**, **ABOGADO**.

## Autenticación, sesiones y roles

| ID | Requisito | Actor | Prioridad |
|----|-----------|-------|-----------|
| RF-01 | Iniciar sesión con credenciales; emitir access y refresh token en cookies seguras (ver `07-seguridad-y-despliegue/`). | Todos | M |
| RF-02 | Distinguir roles SOCIO y ABOGADO y restringir operaciones por rol (RBAC). | Sistema | M |
| RF-03 | El SOCIO puede dar de alta, editar y desactivar usuarios. | SOCIO | M |
| RF-04 | Cerrar sesión: invalidar refresh token y limpiar cookies. | Todos | M |

## Gestión de clientes

| ID | Requisito | Actor | Prioridad |
|----|-----------|-------|-----------|
| RF-05 | Crear un cliente mediante el formulario de admisión (datos de la persona). | Abogado | M |
| RF-06 | Editar y consultar los datos de un cliente. | Abogado | M |
| RF-07 | Listar y buscar clientes por nombre o DNI. | Abogado | S |

## Gestión de casos

| ID | Requisito | Actor | Prioridad |
|----|-----------|-------|-----------|
| RF-08 | Crear un caso vinculado a un cliente y a un abogado responsable, indicando el área. | Abogado | M |
| RF-09 | Registrar la ficha laboral de admisión asociada al caso. | Abogado | M |
| RF-10 | Avanzar la etapa del caso según las transiciones válidas de su área (acción manual). | Abogado | M |
| RF-11 | Retroceder de etapa con confirmación explícita. | Abogado | M |
| RF-12 | Consultar el historial cronológico (inmutable) de movimientos del caso. | Abogado | M |
| RF-13 | Listar y filtrar casos por área, etapa, abogado o cliente. | Abogado | S |

## Gestión documental

| ID | Requisito | Actor | Prioridad |
|----|-----------|-------|-----------|
| RF-14 | Subir documentos (PDF, Word, imagen) por *drag & drop*, asociados a un caso, a R2 (URLs prefirmadas). Solo el abogado sube. | Abogado | M |
| RF-15 | Listar, previsualizar y descargar los documentos de un caso (URL prefirmada). | Abogado | M |

## Comunicación asistida por IA

| ID | Requisito | Actor | Prioridad |
|----|-----------|-------|-----------|
| RF-16 | Generar, desde un caso, un borrador de actualización para el cliente mediante IA (n8n, WF-01). | Abogado | M |
| RF-17 | Editar el borrador antes de su uso. | Abogado | M |
| RF-18 | No enviar ninguna comunicación de forma automática; requiere acción humana explícita. | Sistema | M |

## Vencimientos / agenda

| ID | Requisito | Actor | Prioridad |
|----|-----------|-------|-----------|
| RF-19 | Registrar vencimientos/movimientos asociados a un caso. | Abogado | M |
| RF-20 | Mostrar una vista de calendario con los movimientos a realizar, compartida por todo el estudio. | Abogado | S |

## Exportación y respaldo

| ID | Requisito | Actor | Prioridad |
|----|-----------|-------|-----------|
| RF-21 | Ejecutar respaldos automáticos programados (cron) con n8n (WF-02). | Sistema | M |
| RF-22 | Consultar el historial de respaldos (fecha, tipo, estado). | SOCIO | M |

## Features específicas

| ID | Requisito | Actor | Prioridad |
|----|-----------|-------|-----------|
| RF-25 | Generar el telegrama oficial (Ley 23.789) prellenado para casos Laborales. Ver `08-features/generador-telegramas.md`. | Abogado | M |
| RF-26 | Generar automáticamente borradores de actualización por lote cada 15 días (WF-05). Ver `08-features/batch-actualizaciones.md`. | Sistema / Abogado | S |

> Reportes y facturación: **fuera de alcance** (retirado por el estudio).
