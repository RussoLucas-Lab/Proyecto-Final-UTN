"""
Tests de integración para el router de backups.

Cubre:
  GET /api/v1/backups:
    - 200 lista (SOCIO autenticado, con backups en DB)
    - 200 lista vacía (SOCIO autenticado, sin backups)
    - 403 ABOGADO (rol insuficiente)
    - 401 sin auth

  POST /api/v1/backups:
    - 202 SOCIO + CSRF + webhook OK (mock)
    - 503 webhook n8n falla
    - 403 ABOGADO
    - 403 sin CSRF header
    - 401 sin auth

  POST /api/v1/internal/backups:
    - 201 con tipo/estado/ubicacion completos
    - 201 con ubicacion null
    - 401 sin secreto
    - 422 payload inválido

Tests de integración (@pytest.mark.integration) requieren PostgreSQL.
Tests sin DB (401/403 sin cookie) usan client_no_db.
"""

from unittest.mock import patch

import pytest

from tests.fixtures.usuarios import (
    ABOGADO_EMAIL,
    ABOGADO_PASSWORD,
    SOCIO_EMAIL,
    SOCIO_PASSWORD,
)

pytestmark = pytest.mark.integration

# ── Helpers ────────────────────────────────────────────────────────────────────

TEST_SECRET = "test-secret-para-tests"
INTERNAL_SECRET_PATCH = "app.features.comunicaciones.dependencies.settings"


def _login(client, email, password):
    """Hace login y devuelve el CSRF token de las cookies."""
    resp = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert resp.status_code == 200, f"Login falló: {resp.text}"
    return client.cookies.get("csrf_token")


# ── GET /backups ───────────────────────────────────────────────────────────────


def test_get_backups_lista_socio(client, usuario_socio, backup_ok, backup_error):
    """200: SOCIO autenticado → lista con los backups en DB."""
    csrf = _login(client, SOCIO_EMAIL, SOCIO_PASSWORD)

    resp = client.get("/api/v1/backups", headers={"X-CSRF-Token": csrf})

    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) == 2
    ids = {b["id"] for b in data}
    assert backup_ok.id in ids
    assert backup_error.id in ids
    # Verificar estructura de BackupResponse
    for b in data:
        assert "id" in b
        assert "fecha" in b
        assert "tipo" in b
        assert "estado" in b
        assert "ubicacion" in b


def test_get_backups_lista_vacia_socio(client, usuario_socio):
    """200: SOCIO autenticado, sin backups → lista vacía."""
    csrf = _login(client, SOCIO_EMAIL, SOCIO_PASSWORD)

    resp = client.get("/api/v1/backups", headers={"X-CSRF-Token": csrf})

    assert resp.status_code == 200, resp.text
    assert resp.json() == []


def test_get_backups_403_abogado(client, usuario_abogado):
    """403: ABOGADO no tiene acceso a GET /backups (D6 — solo SOCIO)."""
    csrf = _login(client, ABOGADO_EMAIL, ABOGADO_PASSWORD)

    resp = client.get("/api/v1/backups", headers={"X-CSRF-Token": csrf})

    assert resp.status_code == 403, resp.text


def test_get_backups_401_sin_auth(client_no_db):
    """401: sin cookie de sesión → no autenticado."""
    resp = client_no_db.get("/api/v1/backups")

    assert resp.status_code == 401, resp.text


# ── POST /backups ──────────────────────────────────────────────────────────────


def test_post_backups_202_socio_csrf_ok(client, usuario_socio):
    """202: SOCIO + CSRF + webhook OK → acepta la solicitud."""
    csrf = _login(client, SOCIO_EMAIL, SOCIO_PASSWORD)

    with patch("app.features.backups.service.trigger_backup_manual") as mock_trigger:
        mock_trigger.return_value = None  # éxito silencioso

        resp = client.post(
            "/api/v1/backups",
            headers={"X-CSRF-Token": csrf},
        )

    assert resp.status_code == 202, resp.text
    data = resp.json()
    assert "mensaje" in data


def test_post_backups_503_webhook_falla(client, usuario_socio):
    """503: webhook de n8n falla → BackupN8nNoDisponible → 503."""
    csrf = _login(client, SOCIO_EMAIL, SOCIO_PASSWORD)

    from app.features.backups.service import BackupN8nNoDisponible

    with patch("app.features.backups.service.trigger_backup_manual") as mock_trigger:
        mock_trigger.side_effect = BackupN8nNoDisponible("n8n caído")

        resp = client.post(
            "/api/v1/backups",
            headers={"X-CSRF-Token": csrf},
        )

    assert resp.status_code == 503, resp.text


def test_post_backups_403_abogado(client, usuario_abogado):
    """403: ABOGADO no puede disparar respaldo manual (solo SOCIO)."""
    csrf = _login(client, ABOGADO_EMAIL, ABOGADO_PASSWORD)

    resp = client.post(
        "/api/v1/backups",
        headers={"X-CSRF-Token": csrf},
    )

    assert resp.status_code == 403, resp.text


def test_post_backups_403_sin_csrf(client, usuario_socio):
    """403: SOCIO autenticado pero sin CSRF header → rechazado por CSRFMiddleware."""
    _login(client, SOCIO_EMAIL, SOCIO_PASSWORD)

    resp = client.post("/api/v1/backups")

    assert resp.status_code == 403, resp.text


def test_post_backups_401_sin_auth(client_no_db):
    """401: sin cookie → no autenticado."""
    resp = client_no_db.post(
        "/api/v1/backups",
        headers={"X-CSRF-Token": "dummy-csrf"},
    )

    assert resp.status_code == 401, resp.text


# ── POST /internal/backups ─────────────────────────────────────────────────────


def test_post_internal_backups_201_completo(client, db_session):
    """201: payload completo (tipo/estado/ubicacion) → registro creado."""
    with patch("app.features.comunicaciones.dependencies.settings") as mock_settings:
        mock_settings.N8N_INTERNAL_SECRET = TEST_SECRET

        resp = client.post(
            "/api/v1/internal/backups",
            json={
                "tipo": "AUTOMATICO",
                "estado": "OK",
                "ubicacion": "backup_2026-07-01.xlsx",
            },
            headers={"X-Internal-Secret": TEST_SECRET},
        )

    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["tipo"] == "AUTOMATICO"
    assert data["estado"] == "OK"
    assert data["ubicacion"] == "backup_2026-07-01.xlsx"
    assert "id" in data
    assert "fecha" in data


def test_post_internal_backups_201_ubicacion_null(client, db_session):
    """201: ubicacion null (backup con error) → registro creado sin ubicacion."""
    with patch("app.features.comunicaciones.dependencies.settings") as mock_settings:
        mock_settings.N8N_INTERNAL_SECRET = TEST_SECRET

        resp = client.post(
            "/api/v1/internal/backups",
            json={
                "tipo": "MANUAL",
                "estado": "ERROR",
                "ubicacion": None,
            },
            headers={"X-Internal-Secret": TEST_SECRET},
        )

    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["tipo"] == "MANUAL"
    assert data["estado"] == "ERROR"
    assert data["ubicacion"] is None


def test_post_internal_backups_401_sin_secreto(client):
    """401: sin header X-Internal-Secret → verify_internal_secret rechaza."""
    resp = client.post(
        "/api/v1/internal/backups",
        json={"tipo": "AUTOMATICO", "estado": "OK"},
    )

    assert resp.status_code == 401, resp.text


def test_post_internal_backups_422_payload_invalido(client):
    """422: payload con tipo inválido → Pydantic rechaza."""
    with patch("app.features.comunicaciones.dependencies.settings") as mock_settings:
        mock_settings.N8N_INTERNAL_SECRET = TEST_SECRET

        resp = client.post(
            "/api/v1/internal/backups",
            json={"tipo": "INVALIDO", "estado": "OK"},
            headers={"X-Internal-Secret": TEST_SECRET},
        )

    assert resp.status_code == 422, resp.text
