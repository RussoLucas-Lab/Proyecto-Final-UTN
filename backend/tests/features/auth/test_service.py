"""
Tests de integración de app/features/auth/service.py.

Requieren PostgreSQL (marcados @pytest.mark.integration).
En Windows sin DB local: corren únicamente dentro de Docker o con
TEST_DATABASE_URL apuntando a una instancia disponible.

Cubre: autenticar, emitir_sesion, renovar, revocar.
"""
import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_refresh_token
from app.features.auth.models import RefreshToken
from app.features.auth.service import (
    CredencialesInvalidas,
    SesionInvalida,
    autenticar,
    emitir_sesion,
    renovar,
    revocar,
)
from tests.fixtures.usuarios import (
    ABOGADO_EMAIL,
    ABOGADO_PASSWORD,
    INACTIVO_EMAIL,
    INACTIVO_PASSWORD,
    SOCIO_EMAIL,
    SOCIO_PASSWORD,
)


# ── autenticar ─────────────────────────────────────────────────────────────────


@pytest.mark.integration
class TestAutenticar:
    def test_autenticar_exito(self, db_session: Session, usuario_socio):
        """Credenciales válidas → retorna el usuario."""
        user = autenticar(db_session, email=SOCIO_EMAIL, password=SOCIO_PASSWORD)
        assert user.id == usuario_socio.id
        assert user.email == SOCIO_EMAIL

    def test_autenticar_password_incorrecto(self, db_session: Session, usuario_socio):
        """Contraseña incorrecta → lanza CredencialesInvalidas."""
        with pytest.raises(CredencialesInvalidas):
            autenticar(db_session, email=SOCIO_EMAIL, password="PasswordMalo!")

    def test_autenticar_email_inexistente(self, db_session: Session):
        """Email que no existe en DB → lanza CredencialesInvalidas (sin revelar detalle)."""
        with pytest.raises(CredencialesInvalidas):
            autenticar(db_session, email="noexiste@iuris.test", password="Pass1!")

    def test_autenticar_usuario_inactivo(self, db_session: Session, usuario_inactivo):
        """Usuario con activo=False → lanza CredencialesInvalidas."""
        with pytest.raises(CredencialesInvalidas):
            autenticar(
                db_session, email=INACTIVO_EMAIL, password=INACTIVO_PASSWORD
            )

    def test_autenticar_abogado_activo(self, db_session: Session, usuario_abogado):
        """ABOGADO activo con contraseña correcta → retorna usuario."""
        user = autenticar(db_session, email=ABOGADO_EMAIL, password=ABOGADO_PASSWORD)
        assert user.id == usuario_abogado.id


# ── emitir_sesion ──────────────────────────────────────────────────────────────


@pytest.mark.integration
class TestEmitirSesion:
    def test_emite_tres_tokens(self, db_session: Session, usuario_socio):
        """emitir_sesion retorna (access_token, refresh_raw, csrf_token) no vacíos."""
        access, refresh_raw, csrf = emitir_sesion(db_session, usuario=usuario_socio)

        assert access, "access_token vacío"
        assert refresh_raw, "refresh_token vacío"
        assert csrf, "csrf_token vacío"

    def test_persiste_refresh_token_hasheado_en_db(
        self, db_session: Session, usuario_socio
    ):
        """El refresh token se persiste en DB como hash (nunca en claro)."""
        _, refresh_raw, _ = emitir_sesion(db_session, usuario=usuario_socio)
        token_hash = hash_refresh_token(refresh_raw)

        db_token = db_session.scalar(
            select(RefreshToken).where(RefreshToken.token == token_hash)
        )
        assert db_token is not None
        assert db_token.token != refresh_raw, "El refresh token NO debe guardarse en claro"
        assert not db_token.revoked

    def test_refresh_token_vinculado_al_usuario(
        self, db_session: Session, usuario_socio
    ):
        """El RefreshToken en DB apunta al usuario correcto."""
        _, refresh_raw, _ = emitir_sesion(db_session, usuario=usuario_socio)
        token_hash = hash_refresh_token(refresh_raw)

        db_token = db_session.scalar(
            select(RefreshToken).where(RefreshToken.token == token_hash)
        )
        assert db_token.usuario_id == usuario_socio.id


# ── renovar ────────────────────────────────────────────────────────────────────


@pytest.mark.integration
class TestRenovar:
    def test_rota_refresh_token(self, db_session: Session, usuario_socio):
        """renovar emite nuevos tokens y revoca el anterior."""
        _, refresh_raw, _ = emitir_sesion(db_session, usuario=usuario_socio)

        new_access, new_refresh, new_csrf, user = renovar(
            db_session, refresh_token_raw=refresh_raw
        )

        assert new_access
        assert new_refresh != refresh_raw, "El refresh token debe rotar"
        assert new_csrf
        assert user.id == usuario_socio.id

    def test_token_revocado_tras_renovar(self, db_session: Session, usuario_socio):
        """El refresh original queda revocado después de renovar."""
        _, refresh_raw, _ = emitir_sesion(db_session, usuario=usuario_socio)
        renovar(db_session, refresh_token_raw=refresh_raw)

        old_hash = hash_refresh_token(refresh_raw)
        old_db_token = db_session.scalar(
            select(RefreshToken).where(RefreshToken.token == old_hash)
        )
        assert old_db_token.revoked

    def test_renovar_token_ya_revocado_lanza_error(
        self, db_session: Session, usuario_socio
    ):
        """Renovar un token revocado lanza SesionInvalida."""
        _, refresh_raw, _ = emitir_sesion(db_session, usuario=usuario_socio)
        revocar(db_session, refresh_token_raw=refresh_raw)

        with pytest.raises(SesionInvalida):
            renovar(db_session, refresh_token_raw=refresh_raw)

    def test_renovar_token_inexistente_lanza_error(self, db_session: Session):
        """Renovar con un token que no existe en DB lanza SesionInvalida."""
        with pytest.raises(SesionInvalida):
            renovar(db_session, refresh_token_raw="token-que-no-existe-en-db")


# ── revocar ────────────────────────────────────────────────────────────────────


@pytest.mark.integration
class TestRevocar:
    def test_revocar_marca_revoked_en_db(self, db_session: Session, usuario_socio):
        """revocar pone revoked=True en el RefreshToken correspondiente."""
        _, refresh_raw, _ = emitir_sesion(db_session, usuario=usuario_socio)
        revocar(db_session, refresh_token_raw=refresh_raw)

        token_hash = hash_refresh_token(refresh_raw)
        db_token = db_session.scalar(
            select(RefreshToken).where(RefreshToken.token == token_hash)
        )
        assert db_token.revoked

    def test_revocar_none_es_idempotente(self, db_session: Session):
        """revocar(refresh_token_raw=None) no lanza error (idempotente)."""
        revocar(db_session, refresh_token_raw=None)  # no debe lanzar

    def test_revocar_token_ya_revocado_es_idempotente(
        self, db_session: Session, usuario_socio
    ):
        """Revocar dos veces no lanza error."""
        _, refresh_raw, _ = emitir_sesion(db_session, usuario=usuario_socio)
        revocar(db_session, refresh_token_raw=refresh_raw)
        revocar(db_session, refresh_token_raw=refresh_raw)  # segunda vez: no debe lanzar
