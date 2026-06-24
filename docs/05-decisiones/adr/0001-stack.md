# ADR-0001: Stack React + FastAPI + PostgreSQL + Docker

**Estado:** Aceptada · **Fecha:** 2026-06

## Contexto
El sistema requiere una aplicación web con interfaz rica (drag & drop, dashboards), una API clara y una base de datos relacional para datos estructurados y sensibles. El equipo ya domina este stack del proyecto previo.

## Decisión
Usar **React** (frontend), **FastAPI** (backend/API), **PostgreSQL** (persistencia) y **Docker** (empaquetado).

## Consecuencias
- (+) Reutilización de conocimiento y herramientas del equipo.
- (+) FastAPI genera OpenAPI automáticamente, alineado con los contratos de API.
- (+) PostgreSQL aporta integridad referencial que las planillas no tenían.
- (−) Mayor esfuerzo de frontend que una solución no-code; se asume por la necesidad de UX a medida.
