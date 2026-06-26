"""
Datos sintéticos y helpers para fixtures de usuarios en tests de auth.

Provee constantes (email/password) y una función de hash rápida (bcrypt
cost=4) para agilizar tests sin sacrificar compatibilidad con verify_password.

NO contiene datos reales ni credenciales de producción (ADR-0004).
"""

from passlib.context import CryptContext

# ── Constantes de usuarios sintéticos ─────────────────────────────────────────

SOCIO_EMAIL = "test-socio@iuris.test"
SOCIO_PASSWORD = "SocioPass1!"
SOCIO_NOMBRE = "Socio Test"

ABOGADO_EMAIL = "test-abogado@iuris.test"
ABOGADO_PASSWORD = "AbogadoPass1!"
ABOGADO_NOMBRE = "Abogado Test"

INACTIVO_EMAIL = "test-inactivo@iuris.test"
INACTIVO_PASSWORD = "InactivoPass1!"
INACTIVO_NOMBRE = "Inactivo Test"

# ── Hash rápido para fixtures (bcrypt cost=4 para agilizar tests) ──────────────

_test_pwd_ctx = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
    bcrypt__rounds=4,  # costo mínimo — válido para verify_password (lee rounds del hash)
)


def hash_test_password(password: str) -> str:
    """Hash bcrypt con cost=4 para tests: válido para verify_password, mucho más rápido."""
    return _test_pwd_ctx.hash(password)
