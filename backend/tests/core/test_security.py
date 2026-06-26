"""
Tests unitarios de app/core/security.py.

Sin dependencias de base de datos — todos corren en cualquier entorno,
incluido Windows sin PostgreSQL (ADR-0004, tarea 6.2).

Cubre:
  hash_password / verify_password  — bcrypt round-trip
  hash_refresh_token               — HMAC-SHA256 determinista
  create_access_token              — JWT emitido con claims correctos
  decode_access_token              — decode feliz y con token expirado
"""
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import jwt
import pytest

# Asegurar backend/ en sys.path para imports de app/
BACKEND_DIR = Path(__file__).parent.parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.core.config import settings
from app.core.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    hash_refresh_token,
    verify_password,
)


# ── Contraseñas ────────────────────────────────────────────────────────────────


class TestHashPassword:
    def test_hash_password_and_verify(self):
        """hash_password + verify_password: round-trip exitoso."""
        plain = "MiContraseña123!"
        hashed = hash_password(plain)

        assert hashed != plain, "El hash no debe ser igual a la contraseña en claro"
        assert verify_password(plain, hashed) is True

    def test_wrong_password_fails(self):
        """verify_password retorna False para una contraseña incorrecta."""
        hashed = hash_password("PasswordCorrecto1!")
        assert verify_password("PasswordIncorrecto!", hashed) is False

    def test_hash_is_not_deterministic(self):
        """Dos hashes del mismo password son distintos (bcrypt usa salt)."""
        pw = "Mismo1!"
        assert hash_password(pw) != hash_password(pw)


# ── Refresh token ──────────────────────────────────────────────────────────────


class TestHashRefreshToken:
    def test_hash_refresh_token_deterministic(self):
        """hash_refresh_token es determinista: misma entrada → mismo hash."""
        token = "un-refresh-token-de-ejemplo-abc123"
        assert hash_refresh_token(token) == hash_refresh_token(token)

    def test_hash_refresh_token_different_inputs(self):
        """Entradas distintas producen hashes distintos."""
        assert hash_refresh_token("token-A") != hash_refresh_token("token-B")

    def test_hash_refresh_token_length(self):
        """El resultado es un hexdigest SHA-256 de 64 caracteres."""
        result = hash_refresh_token("cualquier-token")
        assert len(result) == 64
        assert all(c in "0123456789abcdef" for c in result)


# ── JWT access token ───────────────────────────────────────────────────────────


class TestAccessToken:
    def test_create_and_decode_access_token(self):
        """create_access_token emite un JWT decodificable con los claims correctos."""
        claims = {"sub": "42", "rol": "SOCIO"}
        token = create_access_token(claims)

        payload = decode_access_token(token)

        assert payload["sub"] == "42"
        assert payload["rol"] == "SOCIO"
        assert "exp" in payload

    def test_decoded_exp_is_in_the_future(self):
        """El claim 'exp' del token recién emitido es futuro."""
        token = create_access_token({"sub": "1", "rol": "ABOGADO"})
        payload = decode_access_token(token)

        exp_dt = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
        assert exp_dt > datetime.now(timezone.utc)

    def test_expired_token_raises(self):
        """decode_access_token lanza jwt.InvalidTokenError para un token vencido."""
        past_exp = datetime.now(timezone.utc) - timedelta(minutes=5)
        expired_payload = {"sub": "999", "rol": "SOCIO", "exp": past_exp}
        expired_token = jwt.encode(
            expired_payload,
            settings.JWT_SECRET,
            algorithm=settings.JWT_ALGORITHM,
        )

        with pytest.raises(jwt.InvalidTokenError):
            decode_access_token(expired_token)

    def test_tampered_token_raises(self):
        """Un token con firma alterada lanza jwt.InvalidTokenError."""
        valid_token = create_access_token({"sub": "1", "rol": "SOCIO"})
        tampered = valid_token[:-4] + "xxxx"

        with pytest.raises(jwt.InvalidTokenError):
            decode_access_token(tampered)

    def test_wrong_secret_raises(self):
        """Un token firmado con otro secreto lanza jwt.InvalidTokenError."""
        token_other_secret = jwt.encode(
            {"sub": "1", "rol": "SOCIO"},
            "otro-secreto-completamente-distinto",
            algorithm=settings.JWT_ALGORITHM,
        )

        with pytest.raises(jwt.InvalidTokenError):
            decode_access_token(token_other_secret)
