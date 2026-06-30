from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class VencimientoCreate(BaseModel):
    descripcion: str = Field(min_length=1, max_length=255)
    fecha: date


class VencimientoCompletar(BaseModel):
    completado: bool


class VencimientoResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    caso_id: int
    descripcion: str
    fecha: date
    completado: bool
    creado_por: int | None
    creado_en: datetime
