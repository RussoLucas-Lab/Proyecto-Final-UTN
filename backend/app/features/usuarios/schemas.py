"""Schemas Pydantic del feature usuarios."""

from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.shared.enums import AreaDerecho, RolUsuario


class UsuarioCreate(BaseModel):
    """Datos para crear un usuario nuevo. El SOCIO provee la contraseña inicial.

    Validación de contraseña: solo min_length=1 (igual que LoginRequest en auth).
    La política de complejidad queda como deuda técnica hasta que exista una
    validación centralizada en auth (registro/cambio de password). Ver changemap.md.
    """

    email: EmailStr
    password: str = Field(min_length=1)
    nombre: str = Field(min_length=1, max_length=120)
    rol: RolUsuario
    area: AreaDerecho | None = None
    matricula: str | None = Field(default=None, max_length=50)


class UsuarioUpdate(BaseModel):
    """Datos de edición de usuario (PUT — reemplaza nombre, rol, area, matricula).

    No incluye password ni email: el email es inmutable en el MVP y el cambio
    de contraseña es un flujo aparte (fuera de RF-03).
    """

    nombre: str = Field(min_length=1, max_length=120)
    rol: RolUsuario
    area: AreaDerecho | None = None
    matricula: str | None = Field(default=None, max_length=50)


class UsuarioActivacion(BaseModel):
    """Payload para cambiar el estado activo de un usuario (baja/alta lógica)."""

    activo: bool


class UsuarioResponse(BaseModel):
    """Datos públicos del usuario. Nunca incluye password_hash."""

    model_config = {"from_attributes": True}

    id: int
    email: str
    nombre: str
    rol: RolUsuario
    area: AreaDerecho | None
    matricula: str | None
    activo: bool
    creado_en: datetime
