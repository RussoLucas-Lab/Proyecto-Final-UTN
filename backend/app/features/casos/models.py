"""
Modelos ORM de la feature 'casos'.

Tablas DBML v2 (núcleo + ciclo de vida):
  caso              — núcleo del sistema. Índices: area, abogado, cliente, etapa,
                      codigo_expediente.
  ficha_laboral     — formulario de admisión laboral. 1:1 con caso (unique caso_id).
  etapa             — catálogo configurable de etapas por área.
                      Unique (area, nombre). Índice (area, orden).
  transicion_etapa  — transiciones permitidas entre etapas.
                      Unique (etapa_origen_id, etapa_destino_id).
  historial_caso    — registro INMUTABLE de movimientos. Índice caso_id.
                      Append-only por política de servicio (RN-05, RN-06).
"""

from datetime import date, datetime
from decimal import Decimal

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db_base import Base
from app.shared.enums import (
    AreaDerecho,
    FaseCaso,
    TipoReclamoArt,
    area_derecho_sa,
    fase_caso_sa,
    tipo_reclamo_art_sa,
)


# ─────────────────────────────────── etapa ───────────────────────────────────


class Etapa(Base):
    __tablename__ = "etapa"
    __table_args__ = (
        sa.UniqueConstraint("area", "nombre", name="uq_etapa_area_nombre"),
        sa.Index("ix_etapa_area_orden", "area", "orden"),
    )

    id: Mapped[int] = mapped_column(sa.Integer, primary_key=True, autoincrement=True)
    area: Mapped[AreaDerecho] = mapped_column(area_derecho_sa, nullable=False)
    fase: Mapped[FaseCaso] = mapped_column(fase_caso_sa, nullable=False)
    nombre: Mapped[str] = mapped_column(
        sa.String(80),
        nullable=False,
        comment="p.ej. Telegrama 1, Conciliación, Sentencia",
    )
    orden: Mapped[int] = mapped_column(
        sa.Integer,
        nullable=False,
        comment="Orden dentro del flujo del área",
    )
    es_terminal: Mapped[bool] = mapped_column(
        sa.Boolean,
        nullable=False,
        server_default=sa.text("false"),
        comment="Acuerdo / Indemnización / Sentencia",
    )


# ──────────────────────────────────── caso ───────────────────────────────────


class Caso(Base):
    __tablename__ = "caso"
    __table_args__ = (
        sa.Index("ix_caso_area", "area"),
        sa.Index("ix_caso_abogado_responsable_id", "abogado_responsable_id"),
        sa.Index("ix_caso_cliente_id", "cliente_id"),
        sa.Index("ix_caso_etapa_actual_id", "etapa_actual_id"),
        sa.Index("ix_caso_codigo_expediente", "codigo_expediente"),
    )

    id: Mapped[int] = mapped_column(sa.Integer, primary_key=True, autoincrement=True)
    cliente_id: Mapped[int] = mapped_column(
        sa.Integer,
        sa.ForeignKey("cliente.id"),
        nullable=False,
        comment="Un caso -> 1 cliente",
    )
    abogado_responsable_id: Mapped[int] = mapped_column(
        sa.Integer,
        sa.ForeignKey("usuario.id"),
        nullable=False,
        comment="Usuario responsable del caso",
    )
    area: Mapped[AreaDerecho] = mapped_column(area_derecho_sa, nullable=False)
    tipo_reclamo: Mapped[TipoReclamoArt | None] = mapped_column(
        tipo_reclamo_art_sa,
        nullable=True,
        comment="Solo ART: accidente o enfermedad. NULL en Laboral",
    )
    codigo_expediente: Mapped[str | None] = mapped_column(
        sa.String(50),
        nullable=True,
        comment="Otorgado por IOL (Iurix-IOL)",
    )
    etapa_actual_id: Mapped[int] = mapped_column(
        sa.Integer,
        sa.ForeignKey("etapa.id"),
        nullable=False,
        comment="Estado actual = etapa (datos, no enum)",
    )
    fecha_inicio: Mapped[date | None] = mapped_column(
        sa.Date,
        nullable=True,
        comment="Toma del cliente / firma de cuota litis",
    )
    observaciones: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    creado_en: Mapped[datetime] = mapped_column(
        sa.DateTime, nullable=False, server_default=sa.func.now()
    )


# ───────────────────────────────── ficha_laboral ─────────────────────────────


class FichaLaboral(Base):
    __tablename__ = "ficha_laboral"

    id: Mapped[int] = mapped_column(sa.Integer, primary_key=True, autoincrement=True)
    caso_id: Mapped[int] = mapped_column(
        sa.Integer,
        sa.ForeignKey("caso.id"),
        unique=True,
        nullable=False,
        comment="1:1 con caso",
    )
    empleador_nombre: Mapped[str | None] = mapped_column(sa.String(160), nullable=True)
    ramo_actividad: Mapped[str | None] = mapped_column(
        sa.String(160),
        nullable=True,
        comment="Ramo o actividad principal del empleador (telegrama Ley 23.789)",
    )
    direccion_trabajo: Mapped[str | None] = mapped_column(sa.String(255), nullable=True)
    direccion_trabajo_cp: Mapped[str | None] = mapped_column(
        sa.String(20), nullable=True
    )
    direccion_trabajo_localidad: Mapped[str | None] = mapped_column(
        sa.String(120), nullable=True
    )
    direccion_trabajo_provincia: Mapped[str | None] = mapped_column(
        sa.String(120), nullable=True
    )
    razon_social: Mapped[str | None] = mapped_column(sa.String(160), nullable=True)
    motivo_cese: Mapped[str | None] = mapped_column(sa.String(255), nullable=True)
    fecha_inicio_laboral: Mapped[date | None] = mapped_column(sa.Date, nullable=True)
    jornada: Mapped[str | None] = mapped_column(sa.String(120), nullable=True)
    tareas: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    remuneracion: Mapped[Decimal | None] = mapped_column(
        sa.Numeric(14, 2), nullable=True
    )
    cct_aplicable: Mapped[str | None] = mapped_column(
        sa.String(120),
        nullable=True,
        comment="Convenio Colectivo de Trabajo",
    )
    registrado: Mapped[bool | None] = mapped_column(sa.Boolean, nullable=True)
    fecha_alta: Mapped[date | None] = mapped_column(sa.Date, nullable=True)
    sueldo_coincide_bono: Mapped[bool | None] = mapped_column(sa.Boolean, nullable=True)
    jornada_coincide_bono: Mapped[bool | None] = mapped_column(
        sa.Boolean, nullable=True
    )
    estado_aportes: Mapped[str | None] = mapped_column(sa.String(255), nullable=True)
    accidentes: Mapped[str | None] = mapped_column(
        sa.Text,
        nullable=True,
        comment="Detalle de accidentes (si hay)",
    )
    enfermedades: Mapped[str | None] = mapped_column(
        sa.Text,
        nullable=True,
        comment="Enfermedades profesionales (si hay)",
    )
    notas: Mapped[str | None] = mapped_column(sa.Text, nullable=True)


# ───────────────────────────── transicion_etapa ──────────────────────────────


class TransicionEtapa(Base):
    __tablename__ = "transicion_etapa"
    __table_args__ = (
        sa.UniqueConstraint(
            "etapa_origen_id",
            "etapa_destino_id",
            name="uq_transicion_etapa_etapa_origen_id_etapa_destino_id",
        ),
    )

    id: Mapped[int] = mapped_column(sa.Integer, primary_key=True, autoincrement=True)
    etapa_origen_id: Mapped[int] = mapped_column(
        sa.Integer,
        sa.ForeignKey("etapa.id"),
        nullable=False,
    )
    etapa_destino_id: Mapped[int] = mapped_column(
        sa.Integer,
        sa.ForeignKey("etapa.id"),
        nullable=False,
    )


# ─────────────────────────────── historial_caso ──────────────────────────────


class HistorialCaso(Base):
    __tablename__ = "historial_caso"
    __table_args__ = (sa.Index("ix_historial_caso_caso_id", "caso_id"),)

    id: Mapped[int] = mapped_column(sa.Integer, primary_key=True, autoincrement=True)
    caso_id: Mapped[int] = mapped_column(
        sa.Integer,
        sa.ForeignKey("caso.id"),
        nullable=False,
    )
    etapa_anterior_id: Mapped[int | None] = mapped_column(
        sa.Integer,
        sa.ForeignKey("etapa.id"),
        nullable=True,
        comment="NULL en la creación del caso",
    )
    etapa_nueva_id: Mapped[int] = mapped_column(
        sa.Integer,
        sa.ForeignKey("etapa.id"),
        nullable=False,
    )
    evento: Mapped[str] = mapped_column(
        sa.String(255),
        nullable=False,
        comment="p.ej. avance / retroceso de etapa",
    )
    autor_id: Mapped[int] = mapped_column(
        sa.Integer,
        sa.ForeignKey("usuario.id"),
        nullable=False,
    )
    ocurrido_en: Mapped[datetime] = mapped_column(
        sa.DateTime, nullable=False, server_default=sa.func.now()
    )
