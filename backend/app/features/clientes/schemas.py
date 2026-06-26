"""Schemas Pydantic del feature clientes."""

from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class ClienteCreate(BaseModel):
    """Datos para crear un cliente nuevo (admisión).

    Campos obligatorios: nombre, dni (únicos que tienen NOT NULL sin default).
    El resto son opcionales según el DBML v2 (D2, D7).
    """

    nombre: str = Field(min_length=1, max_length=120)
    dni: str = Field(min_length=1, max_length=20)
    cuil: str | None = Field(default=None, max_length=20)
    telefono: str | None = Field(default=None, max_length=30)
    email: EmailStr | None = None
    domicilio_real: str | None = Field(default=None, max_length=255)
    domicilio_real_cp: str | None = Field(default=None, max_length=20)
    domicilio_real_localidad: str | None = Field(default=None, max_length=120)
    domicilio_real_provincia: str | None = Field(default=None, max_length=120)
    domicilio_coincide_dni: bool | None = None


class ClienteUpdate(BaseModel):
    """Datos editables de un cliente.

    `dni` es editable pero sujeto a unicidad (RN-03). Si el nuevo dni
    colisiona con otro cliente distinto → DniDuplicado → 409 (D3).
    """

    nombre: str = Field(min_length=1, max_length=120)
    dni: str = Field(min_length=1, max_length=20)
    cuil: str | None = Field(default=None, max_length=20)
    telefono: str | None = Field(default=None, max_length=30)
    email: EmailStr | None = None
    domicilio_real: str | None = Field(default=None, max_length=255)
    domicilio_real_cp: str | None = Field(default=None, max_length=20)
    domicilio_real_localidad: str | None = Field(default=None, max_length=120)
    domicilio_real_provincia: str | None = Field(default=None, max_length=120)
    domicilio_coincide_dni: bool | None = None


class ClienteResponse(BaseModel):
    """Datos públicos de un cliente tal como los devuelve el backend."""

    model_config = {"from_attributes": True}

    id: int
    nombre: str
    dni: str
    cuil: str | None
    telefono: str | None
    email: str | None
    domicilio_real: str | None
    domicilio_real_cp: str | None
    domicilio_real_localidad: str | None
    domicilio_real_provincia: str | None
    domicilio_coincide_dni: bool | None
    creado_en: datetime
