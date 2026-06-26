"""
Enumeraciones de dominio de Iuris.

Define los 12 enums del DBML v2 como clases Python y sus
tipos SQLAlchemy correspondientes (instancias compartidas).

Compartir la instancia `sa.Enum(...)` entre modelos garantiza
que SQLAlchemy registre el tipo una sola vez en `Base.metadata`.
"""

import enum

import sqlalchemy as sa


# ─────────────────────────────── Python enums ────────────────────────────────


class RolUsuario(str, enum.Enum):
    SOCIO = "SOCIO"
    ABOGADO = "ABOGADO"


class AreaDerecho(str, enum.Enum):
    LABORAL = "LABORAL"
    ART = "ART"


class FaseCaso(str, enum.Enum):
    EXTRAJUDICIAL = "EXTRAJUDICIAL"
    JUDICIAL = "JUDICIAL"


class TipoReclamoArt(str, enum.Enum):
    ACCIDENTE = "ACCIDENTE"
    ENFERMEDAD = "ENFERMEDAD"


class ResultadoTelegrama(str, enum.Enum):
    PENDIENTE = "PENDIENTE"
    ENTREGADO = "ENTREGADO"
    RECHAZADO = "RECHAZADO"
    EN_SUCURSAL = "EN_SUCURSAL"
    DOMICILIO_INEXISTENTE = "DOMICILIO_INEXISTENTE"
    CERRADO = "CERRADO"


class TipoComunicacionTelegrama(str, enum.Enum):
    RENUNCIA = "RENUNCIA"
    AUSENCIA = "AUSENCIA"
    OTRO = "OTRO"


class CategoriaDocumento(str, enum.Enum):
    DNI = "DNI"
    BONO_SUELDO = "BONO_SUELDO"
    HISTORIA_CLINICA = "HISTORIA_CLINICA"
    ACTA_NOTARIAL = "ACTA_NOTARIAL"
    PODER = "PODER"
    OTRO = "OTRO"


class FormatoDocumento(str, enum.Enum):
    PDF = "PDF"
    DOC = "DOC"
    IMAGEN = "IMAGEN"


class TipoComunicacion(str, enum.Enum):
    ACTUALIZACION_AUTOMATICA = "ACTUALIZACION_AUTOMATICA"
    MANUAL = "MANUAL"


class EstadoComunicacion(str, enum.Enum):
    PENDIENTE_REVISION = "PENDIENTE_REVISION"
    APROBADO = "APROBADO"
    DESCARTADO = "DESCARTADO"


class TipoBackup(str, enum.Enum):
    AUTOMATICO = "AUTOMATICO"
    MANUAL = "MANUAL"


class EstadoBackup(str, enum.Enum):
    OK = "OK"
    ERROR = "ERROR"


# ─────────────────── SQLAlchemy Enum type objects (compartidos) ───────────────
# Usar estas instancias en mapped_column() para evitar registros duplicados.

# create_type=False: DDL is owned by Alembic migrations, not metadata.create_all()
rol_usuario_sa = sa.Enum(RolUsuario, name="rol_usuario", create_type=False)
area_derecho_sa = sa.Enum(AreaDerecho, name="area_derecho", create_type=False)
fase_caso_sa = sa.Enum(FaseCaso, name="fase_caso", create_type=False)
tipo_reclamo_art_sa = sa.Enum(TipoReclamoArt, name="tipo_reclamo_art", create_type=False)
resultado_telegrama_sa = sa.Enum(
    ResultadoTelegrama, name="resultado_telegrama", create_type=False
)
tipo_comunicacion_telegrama_sa = sa.Enum(
    TipoComunicacionTelegrama, name="tipo_comunicacion_telegrama", create_type=False
)
categoria_documento_sa = sa.Enum(
    CategoriaDocumento, name="categoria_documento", create_type=False
)
formato_documento_sa = sa.Enum(FormatoDocumento, name="formato_documento", create_type=False)
tipo_comunicacion_sa = sa.Enum(TipoComunicacion, name="tipo_comunicacion", create_type=False)
estado_comunicacion_sa = sa.Enum(
    EstadoComunicacion, name="estado_comunicacion", create_type=False
)
tipo_backup_sa = sa.Enum(TipoBackup, name="tipo_backup", create_type=False)
estado_backup_sa = sa.Enum(EstadoBackup, name="estado_backup", create_type=False)
