# Guía rápida del Changemap

## ¿Qué es el Changemap?

El Changemap es la matriz de trazabilidad del proyecto. Su objetivo es vincular los requisitos definidos en la documentación (SDD) con su implementación, permitiendo conocer en todo momento:

* Qué funcionalidades existen.
* Dónde están especificadas.
* Qué componentes del sistema las implementan.
* Su prioridad dentro del MVP.
* Su estado actual de desarrollo.

Siguiendo la metodología **Specification-Driven Development (SDD)**, la documentación es la fuente de verdad del proyecto.

---

## Regla principal

> Si el código y la especificación divergen, la especificación tiene prioridad.

Ante cualquier cambio funcional:

1. Actualizar la especificación correspondiente.
2. Implementar el cambio en el código.
3. Reflejar el avance en el Changemap.

---

## Cómo leer una fila

Ejemplo:

| ID spec       | Funcionalidad | Capa             | Feature | Prioridad | Estado |
| ------------- | ------------- | ---------------- | ------- | --------- | ------ |
| RF-01 / UC-01 | Login         | backend·frontend | auth    | P0        | 🔲     |

Interpretación:

* **RF-01**: Requisito Funcional asociado.
* **UC-01**: Caso de Uso asociado.
* **Funcionalidad**: comportamiento esperado.
* **Capa**: componentes involucrados.
* **Feature**: módulo funcional.
* **Prioridad**: importancia dentro del MVP.
* **Estado**: situación actual de implementación.

---

## Estados

| Estado | Significado |
| ------ | ----------- |
| 🔲     | Pendiente   |
| 🟡     | En progreso |
| 🔄     | En revisión |
| ✅      | Completado  |
| ⏸️     | Bloqueado   |

---

## Prioridades

| Prioridad | Descripción                                 |
| --------- | ------------------------------------------- |
| P0        | Funcionalidad obligatoria para el MVP       |
| P1        | Funcionalidad importante pero no bloqueante |

La clasificación deriva de la metodología MoSCoW definida en los requisitos.

---

## Estructura general

Las funcionalidades se agrupan por módulos:

* Plataforma / Infraestructura
* Auth
* Usuarios
* Clientes
* Casos
* Documentos
* Comunicaciones
* Telegramas
* Vencimientos / Agenda
* Backups

Cada módulo contiene los requisitos funcionales asociados y su estado de implementación.

---

## Actualización obligatoria en cada PR

Todo Pull Request que modifique una funcionalidad debe:

1. Actualizar el estado correspondiente.
2. Completar la columna **Rama/PR**.
3. Registrar el cambio en el **Changelog**.
4. Registrar cualquier desvío respecto de la especificación.

---

## Changelog

El registro cronológico permite conocer:

* Qué se modificó.
* Cuándo se modificó.
* Qué especificaciones fueron afectadas.
* Quién realizó el cambio.

Esto garantiza trazabilidad y facilita auditorías técnicas del proyecto.

---

## Registro de desvíos

Si una implementación se aparta de la especificación:

1. Debe documentarse en la sección **Desvíos respecto de la spec**.
2. Debe existir una justificación técnica.
3. Debe actualizarse la especificación o registrarse mediante ADR.

No deben existir cambios funcionales sin trazabilidad documental.

---

## Objetivo

El Changemap permite que cualquier integrante del equipo pueda responder rápidamente:

* ¿Qué funcionalidades forman parte del MVP?
* ¿Qué está implementado?
* ¿Qué falta desarrollar?
* ¿Dónde está especificado cada comportamiento?
* ¿Existe algún desvío entre documentación e implementación?

En resumen, es el punto central de seguimiento y trazabilidad del proyecto.
