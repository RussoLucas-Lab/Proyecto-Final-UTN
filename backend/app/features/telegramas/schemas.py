"""
Schemas Pydantic de la feature 'telegramas'.

TelegramaCreate         → payload de registro de un telegrama nuevo.
ResultadoUpdateRequest  → payload de actualización de resultado.
TelegramaResponse       → respuesta serializada del ORM.
"""

from datetime import date

from pydantic import BaseModel, ConfigDict, Field

from app.shared.enums import ResultadoTelegrama, TipoComunicacionTelegrama


class TelegramaCreate(BaseModel):
    numero: int = Field(ge=1, le=3)
    tipo_comunicacion: TipoComunicacionTelegrama
    destinatario: str | None = None
    domicilio_destino: str | None = None
    cuerpo: str | None = None


class ResultadoUpdateRequest(BaseModel):
    resultado: ResultadoTelegrama


class TelegramaResponse(BaseModel):
    id: int
    caso_id: int
    numero: int
    resultado: ResultadoTelegrama
    tipo_comunicacion: TipoComunicacionTelegrama
    destinatario: str | None
    domicilio_destino: str | None
    cuerpo: str | None
    codigo_seguimiento: str | None
    fecha_envio: date | None
    fecha_resultado: date | None
    model_config = ConfigDict(from_attributes=True)
