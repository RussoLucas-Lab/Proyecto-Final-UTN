"""
Pydantic schemas de la feature 'comunicaciones'.

- ActualizacionResponse : respuesta del POST /casos/{id}/actualizacion.
    Mapea el campo ORM `contenido` al campo JSON `borrador`.
- ContextoCasoResponse  : respuesta del GET /internal/casos/{id}/contexto.
    Solo datos seguros: nombre del cliente, etapa actual y últimas novedades.
    Sin DNI/CUIL, montos ni plazos (ADR-0004, D5).
"""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ActualizacionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: int
    borrador: str = Field(validation_alias="contenido")
    generado_en: datetime


class ContextoCasoResponse(BaseModel):
    cliente: str
    etapa: str
    ultimas_novedades: list[str]
