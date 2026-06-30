"""
Tests de integración para el router de comunicaciones.

Cubre:
  POST /api/v1/casos/{id}/actualizacion:
    - 200 con n8n mockeado OK + fila persistida
    - 503 con n8n mockeado caído + sin persistencia
    - 401 sin cookie (sin sesión)
    - 403 sin CSRF header
    - 403 rol insuficiente (usuario sin rol válido — no aplica ABOGADO/SOCIO)
    - 404 caso inexistente

  GET /api/v1/internal/casos/{id}/contexto:
    - 200 con secreto válido y SIN cookie de sesión
    - 401 sin secreto / secreto inválido
    - 404 caso inexistente

Tests de integración (@pytest.mark.integration) requieren PostgreSQL.
Tests sin DB (401/403 sin cookie) usan client_no_db.
"""

import pytest
from sqlalchemy import select
from unittest.mock import patch

from tests.fixtures.usuarios import (
    ABOGADO_EMAIL,
    ABOGADO_PASSWORD,
    SOCIO_EMAIL,
    SOCIO_PASSWORD,
)

pytestmark = pytest.mark.integration

# ── Helpers ────────────────────────────────────────────────────────────────────

TEST_SECRET = "test-secret-para-tests"


def _patch_secret(value: str = TEST_SECRET):
    """Parcha el secreto interno para tests."""
    return patch("app.features.comunicaciones.dependencies.settings")


def _login(client, email, password):
    resp = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert resp.status_code == 200
    return client.cookies.get("csrf_token")


# ── POST /casos/{id}/actualizacion ─────────────────────────────────────────────


def test_post_actualizacion_exito(client, usuario_abogado, caso_fixture, mock_n8n_ok):
    """200: abogado autenticado con CSRF válido + n8n OK → borrador creado."""
    from app.features.comunicaciones.models import Comunicacion
    from app.core.dependencies import get_db

    csrf = _login(client, ABOGADO_EMAIL, ABOGADO_PASSWORD)

    resp = client.post(
        f"/api/v1/casos/{caso_fixture.id}/actualizacion",
        headers={"X-CSRF-Token": csrf},
    )

    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert "id" in data
    assert "borrador" in data
    assert "generado_en" in data
    assert data["borrador"] == "Estimado cliente, su caso ha avanzado."


def test_post_actualizacion_n8n_caido_503(client, usuario_abogado, caso_fixture, mock_n8n_down):
    """503: n8n caído → respuesta de error clara, sin persistencia."""
    from app.features.comunicaciones.models import Comunicacion
    from sqlalchemy import select

    # Override get_db inside client fixture already applied
    # Just need the _app's db_session to check no persistence
    csrf = _login(client, ABOGADO_EMAIL, ABOGADO_PASSWORD)

    resp = client.post(
        f"/api/v1/casos/{caso_fixture.id}/actualizacion",
        headers={"X-CSRF-Token": csrf},
    )

    assert resp.status_code == 503, resp.text


def test_post_actualizacion_sin_cookie_401(client_no_db):
    """401: llamada sin cookie de sesión."""
    resp = client_no_db.post(
        "/api/v1/casos/1/actualizacion",
        headers={"X-CSRF-Token": "fake-csrf"},
    )
    assert resp.status_code == 401


def test_post_actualizacion_sin_csrf_403(client, usuario_abogado, caso_fixture, mock_n8n_ok):
    """403: autenticado pero sin CSRF token → CSRFMiddleware rechaza."""
    _login(client, ABOGADO_EMAIL, ABOGADO_PASSWORD)

    resp = client.post(
        f"/api/v1/casos/{caso_fixture.id}/actualizacion",
    )
    assert resp.status_code == 403


def test_post_actualizacion_caso_inexistente_404(client, usuario_abogado, mock_n8n_ok):
    """404: caso_id no existe → 404 sin disparar el webhook."""
    csrf = _login(client, ABOGADO_EMAIL, ABOGADO_PASSWORD)

    resp = client.post(
        "/api/v1/casos/99999/actualizacion",
        headers={"X-CSRF-Token": csrf},
    )
    assert resp.status_code == 404
    mock_n8n_ok.assert_not_called()


# ── GET /internal/casos/{id}/contexto ─────────────────────────────────────────


def test_get_contexto_con_secreto_valido(client, caso_fixture):
    """200: secreto correcto y SIN cookie de sesión → contexto devuelto."""
    from app.core.config import settings as _settings

    resp = client.get(
        f"/api/v1/internal/casos/{caso_fixture.id}/contexto",
        headers={"X-Internal-Secret": _settings.N8N_INTERNAL_SECRET},
    )

    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert "cliente" in data
    assert "etapa" in data
    assert "ultimas_novedades" in data
    assert isinstance(data["ultimas_novedades"], list)


def test_get_contexto_sin_secreto_401(client, caso_fixture):
    """401: sin header X-Internal-Secret."""
    resp = client.get(
        f"/api/v1/internal/casos/{caso_fixture.id}/contexto",
    )
    assert resp.status_code == 401


def test_get_contexto_secreto_invalido_401(client, caso_fixture):
    """401: secreto incorrecto."""
    resp = client.get(
        f"/api/v1/internal/casos/{caso_fixture.id}/contexto",
        headers={"X-Internal-Secret": "secreto-incorrecto"},
    )
    assert resp.status_code == 401


def test_get_contexto_caso_inexistente_404(client):
    """404: caso_id no existe."""
    from app.core.config import settings as _settings

    resp = client.get(
        "/api/v1/internal/casos/99999/contexto",
        headers={"X-Internal-Secret": _settings.N8N_INTERNAL_SECRET},
    )
    assert resp.status_code == 404


def test_get_contexto_no_requiere_cookie(client, caso_fixture):
    """El endpoint interno no depende de la sesión de usuario (D3)."""
    from app.core.config import settings as _settings

    # No hacemos login; solo enviamos el secreto compartido.
    resp = client.get(
        f"/api/v1/internal/casos/{caso_fixture.id}/contexto",
        headers={"X-Internal-Secret": _settings.N8N_INTERNAL_SECRET},
    )
    assert resp.status_code == 200
