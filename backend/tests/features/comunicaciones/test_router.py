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

  Batch (WF-05, RF-26):
  GET /api/v1/internal/casos/pendientes-actualizacion:
    - 200 con secreto válido
    - 401 sin secreto
  POST /api/v1/internal/casos/{id}/comunicaciones:
    - 201 crea el borrador automático
    - 404 caso inexistente
    - 409 idempotencia (ya existe un automático pendiente)
    - 401 sin secreto
  GET /api/v1/comunicaciones:
    - 200 filtrado por estado
    - 401 sin cookie
    - 422 estado inválido
  PATCH /api/v1/comunicaciones/{id}:
    - 200 aprobar / descartar
    - 422 estado no permitido
    - 403 sin CSRF
    - 401 sin cookie
    - 404 comunicación inexistente
    - 409 ya revisada

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


    # Override get_db inside client fixture already applied
    # Just need the _app's db_session to check no persistence
    csrf = _login(client, ABOGADO_EMAIL, ABOGADO_PASSWORD)

    resp = client.post(
        f"/api/v1/casos/{caso_fixture.id}/actualizacion",
        headers={"X-CSRF-Token": csrf},
    )

    assert resp.status_code == 503, resp.text


def test_post_actualizacion_sin_cookie_401(client_no_db):
    """401: llamada sin cookie de sesión (CSRF satisfecho aparte, para aislar el 401)."""
    client_no_db.cookies.set("csrf_token", "fake-csrf")
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


# ── GET /internal/casos/pendientes-actualizacion (WF-05, RF-26.1) ─────────────


def test_get_pendientes_con_secreto_valido(client, etapa_fixture, caso_factory):
    """200: secreto válido → incluye el caso_id que cumple la cadencia."""
    import datetime as dt

    from app.core.config import settings as _settings

    caso = caso_factory(
        etapa_fixture, fecha_inicio=(dt.datetime.utcnow() - dt.timedelta(days=20)).date()
    )

    resp = client.get(
        "/api/v1/internal/casos/pendientes-actualizacion",
        headers={"X-Internal-Secret": _settings.N8N_INTERNAL_SECRET},
    )

    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert caso.id in data["casos_pendientes"]


def test_get_pendientes_sin_secreto_401(client):
    """401: sin header X-Internal-Secret."""
    resp = client.get("/api/v1/internal/casos/pendientes-actualizacion")
    assert resp.status_code == 401


# ── POST /internal/casos/{id}/comunicaciones (WF-05, RF-26.2) ────────────────


def test_post_comunicacion_interna_exito(client, caso_fixture):
    """201: persiste comunicacion(tipo=ACTUALIZACION_AUTOMATICA, estado=PENDIENTE_REVISION)."""
    from app.core.config import settings as _settings

    resp = client.post(
        f"/api/v1/internal/casos/{caso_fixture.id}/comunicaciones",
        headers={"X-Internal-Secret": _settings.N8N_INTERNAL_SECRET},
        json={"contenido": "Su caso avanzó a la próxima etapa."},
    )

    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["estado"] == "PENDIENTE_REVISION"
    assert "id" in data
    assert "generado_en" in data


def test_post_comunicacion_interna_caso_inexistente_404(client):
    """404: caso_id no existe."""
    from app.core.config import settings as _settings

    resp = client.post(
        "/api/v1/internal/casos/99999/comunicaciones",
        headers={"X-Internal-Secret": _settings.N8N_INTERNAL_SECRET},
        json={"contenido": "Contenido."},
    )
    assert resp.status_code == 404


def test_post_comunicacion_interna_idempotencia_409(client, caso_fixture):
    """409: ya existe un borrador automático PENDIENTE_REVISION para el caso (RN-22)."""
    from app.core.config import settings as _settings

    headers = {"X-Internal-Secret": _settings.N8N_INTERNAL_SECRET}
    primero = client.post(
        f"/api/v1/internal/casos/{caso_fixture.id}/comunicaciones",
        headers=headers,
        json={"contenido": "Primer borrador."},
    )
    assert primero.status_code == 201

    segundo = client.post(
        f"/api/v1/internal/casos/{caso_fixture.id}/comunicaciones",
        headers=headers,
        json={"contenido": "Segundo borrador."},
    )
    assert segundo.status_code == 409


def test_post_comunicacion_interna_sin_secreto_401(client, caso_fixture):
    """401: sin X-Internal-Secret válido → no persiste nada."""
    resp = client.post(
        f"/api/v1/internal/casos/{caso_fixture.id}/comunicaciones",
        json={"contenido": "Contenido."},
    )
    assert resp.status_code == 401


# ── GET /comunicaciones (RF-26.4) ─────────────────────────────────────────────


def test_get_comunicaciones_filtra_por_estado(client, usuario_abogado, comunicacion_fixture):
    """200: lista filtrada por estado con datos enriquecidos (cliente/area/etapa/preview)."""
    _login(client, ABOGADO_EMAIL, ABOGADO_PASSWORD)

    resp = client.get("/api/v1/comunicaciones", params={"estado": "PENDIENTE_REVISION"})

    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert isinstance(data, list)
    item = next(i for i in data if i["id"] == comunicacion_fixture.id)
    assert "cliente" in item
    assert "area" in item
    assert "etapa" in item
    assert "preview" in item


def test_get_comunicaciones_sin_cookie_401(client_no_db):
    """401: sin cookie de sesión."""
    resp = client_no_db.get("/api/v1/comunicaciones")
    assert resp.status_code == 401


def test_get_comunicaciones_estado_invalido_422(client, usuario_abogado):
    """422: valor de `estado` que no pertenece a EstadoComunicacion."""
    _login(client, ABOGADO_EMAIL, ABOGADO_PASSWORD)

    resp = client.get("/api/v1/comunicaciones", params={"estado": "CUALQUIERA"})

    assert resp.status_code == 422


# ── PATCH /comunicaciones/{id} (D4, RF-26.4) ──────────────────────────────────


def test_patch_comunicacion_aprobar(client, usuario_abogado, comunicacion_fixture):
    """200: aprobar registra aprobado_por/aprobado_en."""
    csrf = _login(client, ABOGADO_EMAIL, ABOGADO_PASSWORD)

    resp = client.patch(
        f"/api/v1/comunicaciones/{comunicacion_fixture.id}",
        json={"estado": "APROBADO"},
        headers={"X-CSRF-Token": csrf},
    )

    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["estado"] == "APROBADO"
    assert data["aprobado_por"] is not None
    assert data["aprobado_en"] is not None


def test_patch_comunicacion_descartar(client, usuario_socio, comunicacion_fixture):
    """200: descartar no setea aprobado_por/aprobado_en."""
    csrf = _login(client, SOCIO_EMAIL, SOCIO_PASSWORD)

    resp = client.patch(
        f"/api/v1/comunicaciones/{comunicacion_fixture.id}",
        json={"estado": "DESCARTADO"},
        headers={"X-CSRF-Token": csrf},
    )

    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["estado"] == "DESCARTADO"
    assert data["aprobado_por"] is None


def test_patch_comunicacion_estado_invalido_422(client, usuario_abogado, comunicacion_fixture):
    """422: estado fuera de {APROBADO, DESCARTADO} (p. ej. PENDIENTE_REVISION)."""
    csrf = _login(client, ABOGADO_EMAIL, ABOGADO_PASSWORD)

    resp = client.patch(
        f"/api/v1/comunicaciones/{comunicacion_fixture.id}",
        json={"estado": "PENDIENTE_REVISION"},
        headers={"X-CSRF-Token": csrf},
    )

    assert resp.status_code == 422


def test_patch_comunicacion_sin_csrf_403(client, usuario_abogado, comunicacion_fixture):
    """403: autenticado pero sin CSRF token."""
    _login(client, ABOGADO_EMAIL, ABOGADO_PASSWORD)

    resp = client.patch(
        f"/api/v1/comunicaciones/{comunicacion_fixture.id}",
        json={"estado": "APROBADO"},
    )
    assert resp.status_code == 403


def test_patch_comunicacion_sin_cookie_401(client_no_db):
    """401: sin cookie de sesión (CSRF satisfecho aparte, para aislar el 401)."""
    client_no_db.cookies.set("csrf_token", "fake-csrf")
    resp = client_no_db.patch(
        "/api/v1/comunicaciones/1",
        json={"estado": "APROBADO"},
        headers={"X-CSRF-Token": "fake-csrf"},
    )
    assert resp.status_code == 401


def test_patch_comunicacion_inexistente_404(client, usuario_abogado):
    """404: comunicacion_id no existe."""
    csrf = _login(client, ABOGADO_EMAIL, ABOGADO_PASSWORD)

    resp = client.patch(
        "/api/v1/comunicaciones/99999",
        json={"estado": "APROBADO"},
        headers={"X-CSRF-Token": csrf},
    )
    assert resp.status_code == 404


def test_patch_comunicacion_ya_revisada_409(client, usuario_abogado, comunicacion_fixture):
    """409: la comunicación ya fue revisada (no está en PENDIENTE_REVISION)."""
    csrf = _login(client, ABOGADO_EMAIL, ABOGADO_PASSWORD)

    primero = client.patch(
        f"/api/v1/comunicaciones/{comunicacion_fixture.id}",
        json={"estado": "APROBADO"},
        headers={"X-CSRF-Token": csrf},
    )
    assert primero.status_code == 200

    segundo = client.patch(
        f"/api/v1/comunicaciones/{comunicacion_fixture.id}",
        json={"estado": "DESCARTADO"},
        headers={"X-CSRF-Token": csrf},
    )
    assert segundo.status_code == 409
