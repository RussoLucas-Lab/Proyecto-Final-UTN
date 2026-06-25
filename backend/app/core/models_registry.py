"""
Registro central de modelos ORM.

Importa todos los módulos `features/*/models.py` para que sus clases
queden registradas en `Base.metadata` antes de que Alembic las lea.

Uso típico (en alembic/env.py):
    from app.core.models_registry import *   # noqa: F401, F403
    from app.core.db_base import Base
    target_metadata = Base.metadata

Regla: cada nueva feature que cree un `models.py` DEBE agregar su
import acá, de lo contrario Alembic no detectará las tablas nuevas
al autogenerar revisiones.
"""

# ── Acceso ────────────────────────────────────────────────────────────────────
from app.features.auth import models as _auth_models  # noqa: F401

# ── Clientes ──────────────────────────────────────────────────────────────────
from app.features.clientes import models as _clientes_models  # noqa: F401

# ── Casos (núcleo + ciclo de vida) ────────────────────────────────────────────
from app.features.casos import models as _casos_models  # noqa: F401

# ── Telegramas ────────────────────────────────────────────────────────────────
from app.features.telegramas import models as _telegramas_models  # noqa: F401

# ── Documentos ────────────────────────────────────────────────────────────────
from app.features.documentos import models as _documentos_models  # noqa: F401

# ── Vencimientos ──────────────────────────────────────────────────────────────
from app.features.vencimientos import models as _vencimientos_models  # noqa: F401

# ── Comunicaciones ────────────────────────────────────────────────────────────
from app.features.comunicaciones import models as _comunicaciones_models  # noqa: F401

# ── Backups ───────────────────────────────────────────────────────────────────
from app.features.backups import models as _backups_models  # noqa: F401
