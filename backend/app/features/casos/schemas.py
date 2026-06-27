"""
Schemas Pydantic del feature casos (RF-08 a RF-13, D6, D10).

Schemas de entrada:
  CasoCreate          — alta de caso con validación de área/tipo_reclamo
  FichaLaboralUpsert  — upsert de la ficha laboral (todos los campos opcionales)
  AvanzarRequest      — avanzar a una etapa destino
  RetrocederRequest   — retroceder con confirmación explícita

Schemas de salida (from_attributes=True para leer desde ORM):
  EtapaResponse          — etapa del catálogo
  FichaLaboralResponse   — ficha laboral completa
  CasoResponse           — resumen del caso (listado)
  CasoDetalleResponse    — detalle con etapa_actual, ficha y transiciones_validas
  HistorialItemResponse  — entrada del historial inmutable
"""

from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, model_validator

from app.shared.enums import AreaDerecho, FaseCaso, TipoReclamoArt


# ── Schemas de entrada ─────────────────────────────────────────────────────────


class FichaLaboralUpsert(BaseModel):
    """Payload para crear o actualizar la ficha laboral de un caso (RF-09).

    Todos los campos son opcionales — se pueden completar progresivamente.
    """

    empleador_nombre: str | None = None
    ramo_actividad: str | None = None
    direccion_trabajo: str | None = None
    direccion_trabajo_cp: str | None = None
    direccion_trabajo_localidad: str | None = None
    direccion_trabajo_provincia: str | None = None
    razon_social: str | None = None
    motivo_cese: str | None = None
    fecha_inicio_laboral: date | None = None
    jornada: str | None = None
    tareas: str | None = None
    remuneracion: Decimal | None = None
    cct_aplicable: str | None = None
    registrado: bool | None = None
    fecha_alta: date | None = None
    sueldo_coincide_bono: bool | None = None
    jornada_coincide_bono: bool | None = None
    estado_aportes: str | None = None
    accidentes: str | None = None
    enfermedades: str | None = None
    notas: str | None = None


class CasoCreate(BaseModel):
    """Payload para crear un caso nuevo (RF-08, RF-09, RN-01, D6, D10).

    Obligatorios: cliente_id, abogado_responsable_id, area.
    tipo_reclamo: obligatorio en ART (ACCIDENTE/ENFERMEDAD); nulo en LABORAL.
    ficha_laboral: puede viajar anidada o omitirse para completarla luego.
    """

    cliente_id: int
    abogado_responsable_id: int
    area: AreaDerecho
    tipo_reclamo: TipoReclamoArt | None = None
    codigo_expediente: str | None = None
    fecha_inicio: date | None = None
    observaciones: str | None = None
    ficha_laboral: FichaLaboralUpsert | None = None

    @model_validator(mode="after")
    def validar_tipo_reclamo(self) -> "CasoCreate":
        """Valida que tipo_reclamo sea consistente con el área (D6, RN-11)."""
        if self.area == AreaDerecho.ART and self.tipo_reclamo is None:
            raise ValueError(
                "tipo_reclamo es obligatorio para casos ART (ACCIDENTE o ENFERMEDAD)"
            )
        if self.area == AreaDerecho.LABORAL and self.tipo_reclamo is not None:
            raise ValueError(
                "tipo_reclamo no aplica para casos LABORAL (debe ser nulo)"
            )
        return self


class AvanzarRequest(BaseModel):
    """Payload para avanzar a una etapa destino (RF-10, RN-04)."""

    etapa_destino_id: int


class RetrocederRequest(BaseModel):
    """Payload para retroceder de etapa (RF-11, RN-09).

    confirmar=true es requerido cuando el caso está en etapa terminal (RN-09).
    """

    etapa_destino_id: int
    confirmar: bool = False


# ── Schemas de salida ──────────────────────────────────────────────────────────


class EtapaResponse(BaseModel):
    """Etapa del catálogo (área + fase + nombre + orden + es_terminal)."""

    model_config = {"from_attributes": True}

    id: int
    area: AreaDerecho
    fase: FaseCaso
    nombre: str
    orden: int
    es_terminal: bool


class FichaLaboralResponse(BaseModel):
    """Ficha laboral completa del caso (1:1 con caso)."""

    model_config = {"from_attributes": True}

    id: int
    caso_id: int
    empleador_nombre: str | None
    ramo_actividad: str | None
    direccion_trabajo: str | None
    direccion_trabajo_cp: str | None
    direccion_trabajo_localidad: str | None
    direccion_trabajo_provincia: str | None
    razon_social: str | None
    motivo_cese: str | None
    fecha_inicio_laboral: date | None
    jornada: str | None
    tareas: str | None
    remuneracion: Decimal | None
    cct_aplicable: str | None
    registrado: bool | None
    fecha_alta: date | None
    sueldo_coincide_bono: bool | None
    jornada_coincide_bono: bool | None
    estado_aportes: str | None
    accidentes: str | None
    enfermedades: str | None
    notas: str | None


class CasoResponse(BaseModel):
    """Resumen del caso — usado en listado y en respuestas de avanzar/retroceder."""

    model_config = {"from_attributes": True}

    id: int
    cliente_id: int
    cliente_nombre: str | None = None
    abogado_responsable_id: int
    area: AreaDerecho
    tipo_reclamo: TipoReclamoArt | None
    codigo_expediente: str | None
    etapa_actual_id: int
    etapa_actual_nombre: str | None = None
    fecha_inicio: date | None
    observaciones: str | None
    creado_en: datetime


class CasoDetalleResponse(BaseModel):
    """Detalle completo del caso (RF-13, D3).

    Incluye la etapa actual (objeto Etapa), la ficha laboral y las
    transiciones válidas desde la etapa actual (para el stepper del frontend).
    Los datos de etapa_actual y transiciones_validas se resuelven en el servicio
    — no se hardcodean en el frontend ni en el backend.
    """

    id: int
    cliente_id: int
    cliente_nombre: str | None = None
    abogado_responsable_id: int
    area: AreaDerecho
    tipo_reclamo: TipoReclamoArt | None
    codigo_expediente: str | None
    etapa_actual_id: int
    fecha_inicio: date | None
    observaciones: str | None
    creado_en: datetime
    etapa_actual: EtapaResponse
    ficha: FichaLaboralResponse | None
    transiciones_validas: list[EtapaResponse]


class HistorialItemResponse(BaseModel):
    """Entrada del historial inmutable del caso (RN-05, RN-06)."""

    model_config = {"from_attributes": True}

    id: int
    caso_id: int
    etapa_anterior_id: int | None
    etapa_nueva_id: int
    evento: str
    autor_id: int
    ocurrido_en: datetime
