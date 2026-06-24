# ADR-0004: Base de datos sintética en pruebas y demostración

**Estado:** Aceptada · **Fecha:** 2026-06

## Contexto
Los datos del estudio son sensibles (Ley 25.326, secreto profesional). Usarlos en desarrollo, pruebas o en la defensa del trabajo expondría información real.

## Decisión
Las pruebas y demostraciones operan sobre una **base de datos sintética** con datos ficticios que replican la estructura real.

## Consecuencias
- (+) Cumple el principio de finalidad y confidencialidad.
- (+) Permite mostrar el sistema públicamente sin riesgo.
- (−) Requiere mantener un set de datos de prueba representativo.
