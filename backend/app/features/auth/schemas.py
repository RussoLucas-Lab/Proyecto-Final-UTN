"""Schemas Pydantic del feature auth."""

from pydantic import BaseModel, EmailStr, Field

from app.shared.enums import RolUsuario


class LoginRequest(BaseModel):
    """Credenciales de acceso enviadas al endpoint de login."""

    email: EmailStr
    password: str = Field(min_length=1)


class PerfilResponse(BaseModel):
    """Perfil del usuario devuelto tras login/refresh exitoso."""

    rol: RolUsuario
    nombre: str
