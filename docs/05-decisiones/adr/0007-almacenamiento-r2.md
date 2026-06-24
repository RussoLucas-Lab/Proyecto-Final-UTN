# ADR-0007: Almacenamiento de documentos en object storage S3-compatible (Cloudflare R2)

**Estado:** Aceptada · **Fecha:** 2026-06

## Contexto
El sistema gestiona documentos por caso (DNI, bonos de sueldo, historias clínicas, actas notariales), que son datos sensibles. Los archivos no deben guardarse en la base de datos: PostgreSQL almacena solo la metadata y la clave del objeto (`documento.ruta_almacenamiento`). Se busca una solución **gestionada (sin mantenimiento)**, con control de acceso y costos acotados.

## Decisión
Almacenar los archivos en un **object storage S3-compatible**, con **Cloudflare R2** como proveedor. Características de la solución:
- El **bucket es privado**. El acceso se realiza mediante **URLs prefirmadas** de vencimiento corto, emitidas por el backend **tras validar sesión y rol**.
- El backend programa contra la **API estándar de S3** (boto3 / aioboto3), de modo que migrar a otro proveedor S3-compatible sea un cambio de configuración, no de código (portabilidad, RNF-07).
- El **cliente nunca sube documentos**; solo el abogado (Relevamiento §6).

## Consecuencias
- (+) Sin mantenimiento: servicio gestionado. R2 ofrece capa gratuita amplia y **egress sin costo**.
- (+) Portabilidad por la abstracción S3.
- (+) Confidencialidad: bucket privado + URLs prefirmadas con expiración; cifrado en tránsito (HTTPS) y en reposo.
- (−) Dependencia de un proveedor externo; los datos no residen en Argentina por defecto (R2 permite sugerir ubicación). Aceptable en el MVP (pruebas con datos sintéticos); revisar si el estudio exige residencia local.
- Implica **extender la estrategia de respaldo** para cubrir también el bucket de documentos, no solo la base (ver WF-02 / operación).
