"""
Modelos ORM del grupo 'acceso': usuario y refresh_token.

Tablas DBML v2:
  usuario       — todo el personal (SOCIO / ABOGADO). Email único.
  refresh_token — tokens de refresco revocables. Token único; índice usuario_id.
"""

from datetime import datetime

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db_base import Base
from app.shared.enums import AreaDerecho, RolUsuario, area_derecho_sa, rol_usuario_sa


class Usuario(Base):
    __tablename__ = "usuario"

    id: Mapped[int] = mapped_column(sa.Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(sa.String(120), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(
        sa.String(255), nullable=False, comment="Hash, nunca texto plano"
    )
    nombre: Mapped[str] = mapped_column(sa.String(120), nullable=False)
    rol: Mapped[RolUsuario] = mapped_column(rol_usuario_sa, nullable=False)
    area: Mapped[AreaDerecho | None] = mapped_column(
        area_derecho_sa,
        nullable=True,
        comment="Área del profesional. NULL para socios (transversales)",
    )
    matricula: Mapped[str | None] = mapped_column(sa.String(50), nullable=True)
    activo: Mapped[bool] = mapped_column(
        sa.Boolean, nullable=False, server_default=sa.text("true")
    )
    creado_en: Mapped[datetime] = mapped_column(
        sa.DateTime, nullable=False, server_default=sa.func.now()
    )


class RefreshToken(Base):
    __tablename__ = "refresh_token"

    id: Mapped[int] = mapped_column(sa.Integer, primary_key=True, autoincrement=True)
    usuario_id: Mapped[int] = mapped_column(
        sa.Integer,
        sa.ForeignKey("usuario.id"),
        nullable=False,
        index=True,
    )
    token: Mapped[str] = mapped_column(
        sa.String(255),
        unique=True,
        nullable=False,
        comment="Hash del refresh token",
    )
    issued_at: Mapped[datetime] = mapped_column(
        sa.DateTime, nullable=False, server_default=sa.func.now()
    )
    expires_at: Mapped[datetime] = mapped_column(sa.DateTime, nullable=False)
    revoked: Mapped[bool] = mapped_column(
        sa.Boolean, nullable=False, server_default=sa.text("false")
    )
