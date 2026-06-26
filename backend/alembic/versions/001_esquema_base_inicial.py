"""esquema base inicial

Revision ID: 001
Revises:
Create Date: 2026-06-25

Migración inicial de Iuris: crea los 12 enums y las 13 tablas del DBML v2.

Orden de upgrade():
  1. Enums (antes que las tablas que los usan)
  2. Tablas en orden de dependencias FK:
       usuario → cliente → etapa → caso → ficha_laboral
       → transicion_etapa → historial_caso → telegrama
       → documento → vencimiento → comunicacion
       → refresh_token → backup
  3. Índices y unique constraints adicionales (declarados en __table_args__)

Orden de downgrade():
  Inverso: backup → refresh_token → comunicacion → vencimiento
           → documento → telegrama → historial_caso → transicion_etapa
           → ficha_laboral → caso → etapa → cliente → usuario
  Luego: DROP TYPE para todos los enums.

NOTA: Esta migración NO inserta ningún dato de seed.
      Las etapas, transiciones y demás datos de referencia pertenecen
      al change posterior (ADR-0008 / RN-04).
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# ─────────────────── definiciones de enums (para upgrade/downgrade) ───────────

def _create_enum(name: str, values: list) -> None:
    """Crea un tipo ENUM de PostgreSQL de forma idempotente via DO block.

    Usar op.execute() en lugar de sa.Enum.create() asegura que el DDL corra
    dentro de la transacción de Alembic. Con sa.Enum.create(bind) en
    SQLAlchemy 2.x el DDL puede auto-commitearse, dejando los tipos creados
    si la migración falla después — lo que rompe el re-intento.
    """
    values_sql = ", ".join(f"'{v}'" for v in values)
    op.execute(sa.text(
        f"DO $$ BEGIN "
        f"CREATE TYPE {name} AS ENUM ({values_sql}); "
        f"EXCEPTION WHEN duplicate_object THEN null; "
        f"END $$;"
    ))


def _drop_enum(name: str) -> None:
    """Elimina un tipo ENUM de PostgreSQL si existe."""
    op.execute(sa.text(f"DROP TYPE IF EXISTS {name}"))


def _create_enums() -> None:
    _create_enum("rol_usuario", ["SOCIO", "ABOGADO"])
    _create_enum("area_derecho", ["LABORAL", "ART"])
    _create_enum("fase_caso", ["EXTRAJUDICIAL", "JUDICIAL"])
    _create_enum("tipo_reclamo_art", ["ACCIDENTE", "ENFERMEDAD"])
    _create_enum("resultado_telegrama", [
        "PENDIENTE", "ENTREGADO", "RECHAZADO", "EN_SUCURSAL",
        "DOMICILIO_INEXISTENTE", "CERRADO",
    ])
    _create_enum("tipo_comunicacion_telegrama", ["RENUNCIA", "AUSENCIA", "OTRO"])
    _create_enum("categoria_documento", [
        "DNI", "BONO_SUELDO", "HISTORIA_CLINICA", "ACTA_NOTARIAL", "PODER", "OTRO",
    ])
    _create_enum("formato_documento", ["PDF", "DOC", "IMAGEN"])
    _create_enum("tipo_comunicacion", ["ACTUALIZACION_AUTOMATICA", "MANUAL"])
    _create_enum("estado_comunicacion", ["PENDIENTE_REVISION", "APROBADO", "DESCARTADO"])
    _create_enum("tipo_backup", ["AUTOMATICO", "MANUAL"])
    _create_enum("estado_backup", ["OK", "ERROR"])


def _drop_enums() -> None:
    _drop_enum("estado_backup")
    _drop_enum("tipo_backup")
    _drop_enum("estado_comunicacion")
    _drop_enum("tipo_comunicacion")
    _drop_enum("formato_documento")
    _drop_enum("categoria_documento")
    _drop_enum("tipo_comunicacion_telegrama")
    _drop_enum("resultado_telegrama")
    _drop_enum("tipo_reclamo_art")
    _drop_enum("fase_caso")
    _drop_enum("area_derecho")
    _drop_enum("rol_usuario")


# ────────────────────────────────── upgrade ───────────────────────────────────


def upgrade() -> None:
    # Los 12 enums se crean automáticamente por Alembic via _on_table_create
    # al procesar la primera tabla que usa cada tipo (memo-based dedup).
    # checkfirst=True en env.py garantiza idempotencia ante reinicios.

    # ── Tablas en orden de dependencias FK ─────────────────────────────────

    # 2.1 usuario — sin dependencias externas
    op.create_table(
        "usuario",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("email", sa.String(120), nullable=False),
        sa.Column(
            "password_hash",
            sa.String(255),
            nullable=False,
            comment="Hash, nunca texto plano",
        ),
        sa.Column("nombre", sa.String(120), nullable=False),
        sa.Column(
            "rol",
            sa.Enum(
                "SOCIO", "ABOGADO",
                name="rol_usuario",

            ),
            nullable=False,
        ),
        sa.Column(
            "area",
            sa.Enum(
                "LABORAL", "ART",
                name="area_derecho",

            ),
            nullable=True,
            comment="Área del profesional. NULL para socios (transversales)",
        ),
        sa.Column("matricula", sa.String(50), nullable=True),
        sa.Column(
            "activo",
            sa.Boolean,
            nullable=False,
            server_default=sa.text("true"),
        ),
        sa.Column(
            "creado_en",
            sa.DateTime,
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint("email", name="uq_usuario_email"),
    )

    # 2.2 cliente — sin dependencias externas
    op.create_table(
        "cliente",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("nombre", sa.String(120), nullable=False),
        sa.Column(
            "dni",
            sa.String(20),
            nullable=False,
            comment="Único en el estudio (RN-03)",
        ),
        sa.Column("cuil", sa.String(20), nullable=True),
        sa.Column("telefono", sa.String(30), nullable=True),
        sa.Column("email", sa.String(120), nullable=True),
        sa.Column("domicilio_real", sa.String(255), nullable=True),
        sa.Column("domicilio_real_cp", sa.String(20), nullable=True),
        sa.Column("domicilio_real_localidad", sa.String(120), nullable=True),
        sa.Column("domicilio_real_provincia", sa.String(120), nullable=True),
        sa.Column("domicilio_coincide_dni", sa.Boolean, nullable=True),
        sa.Column(
            "creado_en",
            sa.DateTime,
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint("dni", name="uq_cliente_dni"),
    )

    # 2.3 etapa — sin dependencias externas
    op.create_table(
        "etapa",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column(
            "area",
            sa.Enum(
                "LABORAL", "ART",
                name="area_derecho",

            ),
            nullable=False,
        ),
        sa.Column(
            "fase",
            sa.Enum(
                "EXTRAJUDICIAL", "JUDICIAL",
                name="fase_caso",

            ),
            nullable=False,
        ),
        sa.Column(
            "nombre",
            sa.String(80),
            nullable=False,
            comment="p.ej. Telegrama 1, Conciliación, Sentencia",
        ),
        sa.Column(
            "orden",
            sa.Integer,
            nullable=False,
            comment="Orden dentro del flujo del área",
        ),
        sa.Column(
            "es_terminal",
            sa.Boolean,
            nullable=False,
            server_default=sa.text("false"),
            comment="Acuerdo / Indemnización / Sentencia",
        ),
        sa.UniqueConstraint("area", "nombre", name="uq_etapa_area_nombre"),
    )
    op.create_index("ix_etapa_area_orden", "etapa", ["area", "orden"])

    # 2.4 caso — depende de: cliente, usuario, etapa
    op.create_table(
        "caso",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column(
            "cliente_id",
            sa.Integer,
            sa.ForeignKey("cliente.id"),
            nullable=False,
            comment="Un caso -> 1 cliente",
        ),
        sa.Column(
            "abogado_responsable_id",
            sa.Integer,
            sa.ForeignKey("usuario.id"),
            nullable=False,
            comment="Usuario responsable del caso",
        ),
        sa.Column(
            "area",
            sa.Enum(
                "LABORAL", "ART",
                name="area_derecho",

            ),
            nullable=False,
        ),
        sa.Column(
            "tipo_reclamo",
            sa.Enum(
                "ACCIDENTE", "ENFERMEDAD",
                name="tipo_reclamo_art",

            ),
            nullable=True,
            comment="Solo ART: accidente o enfermedad. NULL en Laboral",
        ),
        sa.Column(
            "codigo_expediente",
            sa.String(50),
            nullable=True,
            comment="Otorgado por IOL (Iurix-IOL)",
        ),
        sa.Column(
            "etapa_actual_id",
            sa.Integer,
            sa.ForeignKey("etapa.id"),
            nullable=False,
            comment="Estado actual = etapa (datos, no enum)",
        ),
        sa.Column(
            "fecha_inicio",
            sa.Date,
            nullable=True,
            comment="Toma del cliente / firma de cuota litis",
        ),
        sa.Column("observaciones", sa.Text, nullable=True),
        sa.Column(
            "creado_en",
            sa.DateTime,
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index("ix_caso_area", "caso", ["area"])
    op.create_index("ix_caso_abogado_responsable_id", "caso", ["abogado_responsable_id"])
    op.create_index("ix_caso_cliente_id", "caso", ["cliente_id"])
    op.create_index("ix_caso_etapa_actual_id", "caso", ["etapa_actual_id"])
    op.create_index("ix_caso_codigo_expediente", "caso", ["codigo_expediente"])

    # 2.5 ficha_laboral — depende de: caso (1:1)
    op.create_table(
        "ficha_laboral",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column(
            "caso_id",
            sa.Integer,
            sa.ForeignKey("caso.id"),
            nullable=False,
            comment="1:1 con caso",
        ),
        sa.Column("empleador_nombre", sa.String(160), nullable=True),
        sa.Column(
            "ramo_actividad",
            sa.String(160),
            nullable=True,
            comment="Ramo o actividad principal del empleador (telegrama Ley 23.789)",
        ),
        sa.Column("direccion_trabajo", sa.String(255), nullable=True),
        sa.Column("direccion_trabajo_cp", sa.String(20), nullable=True),
        sa.Column("direccion_trabajo_localidad", sa.String(120), nullable=True),
        sa.Column("direccion_trabajo_provincia", sa.String(120), nullable=True),
        sa.Column("razon_social", sa.String(160), nullable=True),
        sa.Column("motivo_cese", sa.String(255), nullable=True),
        sa.Column("fecha_inicio_laboral", sa.Date, nullable=True),
        sa.Column("jornada", sa.String(120), nullable=True),
        sa.Column("tareas", sa.Text, nullable=True),
        sa.Column("remuneracion", sa.Numeric(14, 2), nullable=True),
        sa.Column(
            "cct_aplicable",
            sa.String(120),
            nullable=True,
            comment="Convenio Colectivo de Trabajo",
        ),
        sa.Column("registrado", sa.Boolean, nullable=True),
        sa.Column("fecha_alta", sa.Date, nullable=True),
        sa.Column("sueldo_coincide_bono", sa.Boolean, nullable=True),
        sa.Column("jornada_coincide_bono", sa.Boolean, nullable=True),
        sa.Column("estado_aportes", sa.String(255), nullable=True),
        sa.Column(
            "accidentes",
            sa.Text,
            nullable=True,
            comment="Detalle de accidentes (si hay)",
        ),
        sa.Column(
            "enfermedades",
            sa.Text,
            nullable=True,
            comment="Enfermedades profesionales (si hay)",
        ),
        sa.Column("notas", sa.Text, nullable=True),
        sa.UniqueConstraint("caso_id", name="uq_ficha_laboral_caso_id"),
    )

    # 2.6 transicion_etapa — depende de: etapa (x2)
    op.create_table(
        "transicion_etapa",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column(
            "etapa_origen_id",
            sa.Integer,
            sa.ForeignKey("etapa.id"),
            nullable=False,
        ),
        sa.Column(
            "etapa_destino_id",
            sa.Integer,
            sa.ForeignKey("etapa.id"),
            nullable=False,
        ),
        sa.UniqueConstraint(
            "etapa_origen_id",
            "etapa_destino_id",
            name="uq_transicion_etapa_etapa_origen_id_etapa_destino_id",
        ),
    )

    # 2.7 historial_caso — depende de: caso, etapa (x2), usuario
    op.create_table(
        "historial_caso",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column(
            "caso_id",
            sa.Integer,
            sa.ForeignKey("caso.id"),
            nullable=False,
        ),
        sa.Column(
            "etapa_anterior_id",
            sa.Integer,
            sa.ForeignKey("etapa.id"),
            nullable=True,
            comment="NULL en la creación del caso",
        ),
        sa.Column(
            "etapa_nueva_id",
            sa.Integer,
            sa.ForeignKey("etapa.id"),
            nullable=False,
        ),
        sa.Column(
            "evento",
            sa.String(255),
            nullable=False,
            comment="p.ej. avance / retroceso de etapa",
        ),
        sa.Column(
            "autor_id",
            sa.Integer,
            sa.ForeignKey("usuario.id"),
            nullable=False,
        ),
        sa.Column(
            "ocurrido_en",
            sa.DateTime,
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index("ix_historial_caso_caso_id", "historial_caso", ["caso_id"])

    # 2.8 telegrama — depende de: caso
    op.create_table(
        "telegrama",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column(
            "caso_id",
            sa.Integer,
            sa.ForeignKey("caso.id"),
            nullable=False,
        ),
        sa.Column("numero", sa.Integer, nullable=False, comment="1, 2 o 3"),
        sa.Column(
            "resultado",
            sa.Enum(
                "PENDIENTE", "ENTREGADO", "RECHAZADO", "EN_SUCURSAL",
                "DOMICILIO_INEXISTENTE", "CERRADO",
                name="resultado_telegrama",

            ),
            nullable=False,
            server_default=sa.text("'PENDIENTE'"),
        ),
        sa.Column(
            "tipo_comunicacion",
            sa.Enum(
                "RENUNCIA", "AUSENCIA", "OTRO",
                name="tipo_comunicacion_telegrama",

            ),
            nullable=False,
            server_default=sa.text("'OTRO'"),
            comment="Radio 'Opciones de comunicación' del PDF oficial",
        ),
        sa.Column(
            "destinatario",
            sa.String(160),
            nullable=True,
            comment="Empleador",
        ),
        sa.Column("domicilio_destino", sa.String(255), nullable=True),
        sa.Column(
            "cuerpo",
            sa.Text,
            nullable=True,
            comment="Texto del reclamo (para generar el PDF Ley 23.789)",
        ),
        sa.Column(
            "codigo_seguimiento",
            sa.String(60),
            nullable=True,
            comment="Código que entrega el correo",
        ),
        sa.Column("fecha_envio", sa.Date, nullable=True),
        sa.Column("fecha_resultado", sa.Date, nullable=True),
        sa.UniqueConstraint("caso_id", "numero", name="uq_telegrama_caso_id_numero"),
    )

    # 2.9 documento — depende de: caso, usuario
    op.create_table(
        "documento",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column(
            "caso_id",
            sa.Integer,
            sa.ForeignKey("caso.id"),
            nullable=False,
            comment="Siempre asociado a un caso (RN-02)",
        ),
        sa.Column(
            "categoria",
            sa.Enum(
                "DNI", "BONO_SUELDO", "HISTORIA_CLINICA", "ACTA_NOTARIAL",
                "PODER", "OTRO",
                name="categoria_documento",

            ),
            nullable=False,
        ),
        sa.Column(
            "formato",
            sa.Enum(
                "PDF", "DOC", "IMAGEN",
                name="formato_documento",

            ),
            nullable=False,
        ),
        sa.Column(
            "nombre_archivo",
            sa.String(255),
            nullable=False,
            comment="Convención: categoria_Apellido_Nombre",
        ),
        sa.Column("ruta_almacenamiento", sa.String(500), nullable=False),
        sa.Column(
            "subido_por",
            sa.Integer,
            sa.ForeignKey("usuario.id"),
            nullable=False,
            comment="Solo un usuario/abogado sube documentos",
        ),
        sa.Column(
            "subido_en",
            sa.DateTime,
            nullable=False,
            server_default=sa.func.now(),
        ),
    )

    # 2.10 vencimiento — depende de: caso, usuario
    op.create_table(
        "vencimiento",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column(
            "caso_id",
            sa.Integer,
            sa.ForeignKey("caso.id"),
            nullable=False,
        ),
        sa.Column(
            "descripcion",
            sa.String(255),
            nullable=False,
            comment="p.ej. Presentar demanda",
        ),
        sa.Column("fecha", sa.Date, nullable=False),
        sa.Column(
            "completado",
            sa.Boolean,
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column(
            "creado_por",
            sa.Integer,
            sa.ForeignKey("usuario.id"),
            nullable=True,
        ),
        sa.Column(
            "creado_en",
            sa.DateTime,
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index("ix_vencimiento_fecha", "vencimiento", ["fecha"])

    # 2.11 comunicacion — depende de: caso, usuario
    op.create_table(
        "comunicacion",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column(
            "caso_id",
            sa.Integer,
            sa.ForeignKey("caso.id"),
            nullable=False,
        ),
        sa.Column(
            "contenido",
            sa.Text,
            nullable=False,
            comment="Borrador generado por la IA (n8n)",
        ),
        sa.Column(
            "tipo",
            sa.Enum(
                "ACTUALIZACION_AUTOMATICA", "MANUAL",
                name="tipo_comunicacion",

            ),
            nullable=False,
        ),
        sa.Column(
            "estado",
            sa.Enum(
                "PENDIENTE_REVISION", "APROBADO", "DESCARTADO",
                name="estado_comunicacion",

            ),
            nullable=False,
            server_default=sa.text("'PENDIENTE_REVISION'"),
        ),
        sa.Column(
            "generado_en",
            sa.DateTime,
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "aprobado_por",
            sa.Integer,
            sa.ForeignKey("usuario.id"),
            nullable=True,
            comment="Usuario que revisó/aprobó. El envío por WhatsApp es manual",
        ),
        sa.Column("aprobado_en", sa.DateTime, nullable=True),
    )
    op.create_index("ix_comunicacion_caso_id", "comunicacion", ["caso_id"])
    op.create_index("ix_comunicacion_estado", "comunicacion", ["estado"])

    # 2.12 refresh_token — depende de: usuario
    op.create_table(
        "refresh_token",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column(
            "usuario_id",
            sa.Integer,
            sa.ForeignKey("usuario.id"),
            nullable=False,
        ),
        sa.Column(
            "token",
            sa.String(255),
            nullable=False,
            comment="Hash del refresh token",
        ),
        sa.Column(
            "issued_at",
            sa.DateTime,
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("expires_at", sa.DateTime, nullable=False),
        sa.Column(
            "revoked",
            sa.Boolean,
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.UniqueConstraint("token", name="uq_refresh_token_token"),
    )
    op.create_index("ix_refresh_token_usuario_id", "refresh_token", ["usuario_id"])

    # 2.13 backup — sin dependencias externas
    op.create_table(
        "backup",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column(
            "fecha",
            sa.DateTime,
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "tipo",
            sa.Enum(
                "AUTOMATICO", "MANUAL",
                name="tipo_backup",

            ),
            nullable=False,
        ),
        sa.Column(
            "estado",
            sa.Enum(
                "OK", "ERROR",
                name="estado_backup",

            ),
            nullable=False,
        ),
        sa.Column("ubicacion", sa.String(500), nullable=True),
    )


# ─────────────────────────────────── downgrade ────────────────────────────────


def downgrade() -> None:
    # ── 1. Drop tablas en orden inverso de dependencias FK ─────────────────
    op.drop_table("backup")
    op.drop_index("ix_refresh_token_usuario_id", table_name="refresh_token")
    op.drop_table("refresh_token")
    op.drop_index("ix_comunicacion_estado", table_name="comunicacion")
    op.drop_index("ix_comunicacion_caso_id", table_name="comunicacion")
    op.drop_table("comunicacion")
    op.drop_index("ix_vencimiento_fecha", table_name="vencimiento")
    op.drop_table("vencimiento")
    op.drop_table("documento")
    op.drop_table("telegrama")
    op.drop_index("ix_historial_caso_caso_id", table_name="historial_caso")
    op.drop_table("historial_caso")
    op.drop_table("transicion_etapa")
    op.drop_table("ficha_laboral")
    op.drop_index("ix_caso_codigo_expediente", table_name="caso")
    op.drop_index("ix_caso_etapa_actual_id", table_name="caso")
    op.drop_index("ix_caso_cliente_id", table_name="caso")
    op.drop_index("ix_caso_abogado_responsable_id", table_name="caso")
    op.drop_index("ix_caso_area", table_name="caso")
    op.drop_table("caso")
    op.drop_index("ix_etapa_area_orden", table_name="etapa")
    op.drop_table("etapa")
    op.drop_table("cliente")
    op.drop_table("usuario")

    # ── 2. Drop enums (después de las tablas que los usan) ─────────────────
    _drop_enums()
