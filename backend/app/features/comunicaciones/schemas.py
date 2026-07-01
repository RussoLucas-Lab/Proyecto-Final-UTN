"""
Pydantic schemas de la feature 'comunicaciones'.

Flujo individual (WF-01, RF-16..18):
- ActualizacionResponse : respuesta del POST /casos/{id}/actualizacion.
    Mapea el campo ORM `contenido` al campo JSON `borrador`.
- ContextoCasoResponse  : respuesta del GET /internal/casos/{id}/contexto.
    Solo datos seguros: nombre del cliente, etapa actual y últimas novedades.
    Sin DNI/CUIL, montos ni plazos (ADR-0004, D5).

Flujo batch (WF-05, RF-26):
- PendientesActualizacionResponse  : respuesta del GET interno de pendientes.
- CrearComunicacionInternaRequest  : payload del POST interno de persistencia.
- ComunicacionInternaResponse      : respuesta del POST interno de persistencia.
- BorradorPendienteResponse        : respuesta enriquecida del GET /comunicaciones (D7).
- ComunicacionPatchRequest         : payload del PATCH /comunicaciones/{id}.
- ComunicacionPatchResponse        : respuesta del PATCH /comunicaciones/{id}.
"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.shared.enums import EstadoComunicacion


class ActualizacionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: int
    borrador: str = Field(validation_alias="contenido")
    generado_en: datetime


class ContextoCasoResponse(BaseModel):
    cliente: str
    etapa: str
    ultimas_novedades: list[str]


# ── Batch (WF-05, RF-26) — internos ───────────────────────────────────────────


class PendientesActualizacionResponse(BaseModel):
    """Respuesta de GET /internal/casos/pendientes-actualizacion (RF-26.1)."""

    casos_pendientes: list[int]


class CrearComunicacionInternaRequest(BaseModel):
    """Payload de POST /internal/casos/{id}/comunicaciones (RF-26.2)."""

    contenido: str = Field(min_length=1)


class ComunicacionInternaResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    estado: EstadoComunicacion
    generado_en: datetime


# ── Batch (WF-05, RF-26) — de usuario ─────────────────────────────────────────


class BorradorPendienteResponse(BaseModel):
    """Respuesta enriquecida de GET /comunicaciones (D7).

    Resuelve comunicacion -> caso -> cliente/etapa. Sin DNI/CUIL ni montos
    (ADR-0004). `preview` mapea el campo ORM `contenido`.
    """

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: int
    caso_id: int
    cliente: str
    area: str
    etapa: str
    preview: str = Field(validation_alias="contenido")
    estado: EstadoComunicacion
    generado_en: datetime


class ComunicacionPatchRequest(BaseModel):
    """Payload de PATCH /comunicaciones/{id}: solo aprobar o descartar (RN-10)."""

    estado: Literal["APROBADO", "DESCARTADO"]


class ComunicacionPatchResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    estado: EstadoComunicacion
    aprobado_por: int | None
    aprobado_en: datetime | None
