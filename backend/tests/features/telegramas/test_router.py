"""
Tests de integración para el router de telegramas.

Cubre:
  GET /api/v1/casos/{id}/telegramas:
    - 200 lista vacía (lectura amplia — caso sin telegramas)
    - 200 lista con telegramas registrados
    - 401 sin cookie de sesión

  POST /api/v1/casos/{id}/telegramas:
    - 201 creación exitosa (caso LABORAL, payload válido)
    - 422 caso de área ART rechazado (RN-15)
    - 409 número duplicado en el caso (RN-16)
    - 409 límite de 3 telegramas alcanzado (RN-16)
    - 422 payload inválido (numero fuera de rango 1–3)
    - 401 sin cookie de sesión
    - 403 sin CSRF header

  PATCH /api/v1/telegramas/{id}:
    - 200 actualización de resultado exitosa
    - 404 telegrama inexistente
    - 422 resultado PENDIENTE no permitido manualmente
    - 401 sin cookie de sesión
    - 403 sin CSRF header

Tests de integración (@pytest.mark.integration) requieren PostgreSQL.
Tests sin DB (401/403) usan client_no_db y no requieren base de datos.
"""

import pytest

from tests.fixtures.usuarios import ABOGADO_EMAIL, ABOGADO_PASSWORD

pytestmark = pytest.mark.integration


# ── Helpers ────────────────────────────────────────────────────────────────────


def _login(client, email: str, password: str) -> str:
    """Hace login y devuelve el CSRF token de la cookie."""
    resp = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert resp.status_code == 200, f"Login fallido: {resp.text}"
    return client.cookies.get("csrf_token")


# ── GET /casos/{id}/telegramas ─────────────────────────────────────────────────


def test_get_telegramas_lista_vacia(client, usuario_abogado, caso_laboral):
    """200: caso sin telegramas devuelve lista vacía."""
    _login(client, ABOGADO_EMAIL, ABOGADO_PASSWORD)

    resp = client.get(f"/api/v1/casos/{caso_laboral.id}/telegramas")

    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) == 0


def test_get_telegramas_con_datos(client, usuario_abogado, caso_laboral, telegrama_fixture):
    """200: devuelve los telegramas registrados en el caso."""
    _login(client, ABOGADO_EMAIL, ABOGADO_PASSWORD)

    resp = client.get(f"/api/v1/casos/{caso_laboral.id}/telegramas")

    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) == 1
    assert data[0]["numero"] == 1
    assert data[0]["resultado"] == "PENDIENTE"
    assert data[0]["caso_id"] == caso_laboral.id


def test_get_telegramas_sin_cookie_401(client_no_db):
    """401: sin sesión activa → no puede leer."""
    resp = client_no_db.get("/api/v1/casos/1/telegramas")
    assert resp.status_code == 401


# ── POST /casos/{id}/telegramas ────────────────────────────────────────────────


def test_post_telegrama_exito_201(client, usuario_abogado, caso_laboral):
    """201: creación exitosa de un telegrama en caso LABORAL."""
    csrf = _login(client, ABOGADO_EMAIL, ABOGADO_PASSWORD)

    resp = client.post(
        f"/api/v1/casos/{caso_laboral.id}/telegramas",
        json={
            "numero": 1,
            "tipo_comunicacion": "OTRO",
            "destinatario": "Metalúrgica del Oeste S.A.",
            "domicilio_destino": "Av. San Martín 1450, Mendoza",
            "cuerpo": "Por la presente, intimo a Vuestra Empresa a regularizar...",
        },
        headers={"X-CSRF-Token": csrf},
    )

    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["numero"] == 1
    assert data["resultado"] == "PENDIENTE"
    assert data["caso_id"] == caso_laboral.id
    assert "id" in data


def test_post_telegrama_area_art_422(client, usuario_abogado, caso_art):
    """422: caso de área ART rechazado (RN-15 — telegramas solo en LABORAL)."""
    csrf = _login(client, ABOGADO_EMAIL, ABOGADO_PASSWORD)

    resp = client.post(
        f"/api/v1/casos/{caso_art.id}/telegramas",
        json={"numero": 1, "tipo_comunicacion": "OTRO"},
        headers={"X-CSRF-Token": csrf},
    )

    assert resp.status_code == 422, resp.text


def test_post_telegrama_numero_duplicado_409(client, usuario_abogado, caso_laboral, telegrama_fixture):
    """409: ya existe un telegrama con ese número en el caso (RN-16 — unicidad caso_id/numero)."""
    csrf = _login(client, ABOGADO_EMAIL, ABOGADO_PASSWORD)

    # telegrama_fixture ya tiene numero=1 en caso_laboral
    resp = client.post(
        f"/api/v1/casos/{caso_laboral.id}/telegramas",
        json={"numero": 1, "tipo_comunicacion": "OTRO"},
        headers={"X-CSRF-Token": csrf},
    )

    assert resp.status_code == 409, resp.text


def test_post_telegrama_limite_alcanzado_409(client, usuario_abogado, caso_laboral, db_session):
    """409: el caso ya tiene 3 telegramas registrados (RN-16 — máximo 3 por caso)."""
    from app.features.telegramas.models import Telegrama
    from app.shared.enums import ResultadoTelegrama, TipoComunicacionTelegrama

    # Insertar 3 telegramas directamente para alcanzar el límite
    for num in (1, 2, 3):
        tel = Telegrama(
            caso_id=caso_laboral.id,
            numero=num,
            tipo_comunicacion=TipoComunicacionTelegrama.OTRO,
            resultado=ResultadoTelegrama.PENDIENTE,
        )
        db_session.add(tel)
    db_session.commit()

    csrf = _login(client, ABOGADO_EMAIL, ABOGADO_PASSWORD)

    # El servicio verifica límite (>= 3) ANTES de verificar unicidad → 409
    resp = client.post(
        f"/api/v1/casos/{caso_laboral.id}/telegramas",
        json={"numero": 2, "tipo_comunicacion": "OTRO"},
        headers={"X-CSRF-Token": csrf},
    )

    assert resp.status_code == 409, resp.text


def test_post_telegrama_payload_invalido_422(client, usuario_abogado, caso_laboral):
    """422: numero fuera del rango 1–3 es rechazado por Pydantic (ge=1, le=3)."""
    csrf = _login(client, ABOGADO_EMAIL, ABOGADO_PASSWORD)

    resp = client.post(
        f"/api/v1/casos/{caso_laboral.id}/telegramas",
        json={"numero": 5, "tipo_comunicacion": "OTRO"},
        headers={"X-CSRF-Token": csrf},
    )

    assert resp.status_code == 422, resp.text


def test_post_telegrama_sin_cookie_401(client_no_db):
    """401: sin sesión activa (CSRF satisfecho por separado para aislar el 401)."""
    client_no_db.cookies.set("csrf_token", "fake-csrf")
    resp = client_no_db.post(
        "/api/v1/casos/1/telegramas",
        json={"numero": 1, "tipo_comunicacion": "OTRO"},
        headers={"X-CSRF-Token": "fake-csrf"},
    )
    assert resp.status_code == 401


def test_post_telegrama_sin_csrf_403(client, usuario_abogado, caso_laboral):
    """403: autenticado pero sin header X-CSRF-Token → CSRFMiddleware rechaza."""
    _login(client, ABOGADO_EMAIL, ABOGADO_PASSWORD)

    resp = client.post(
        f"/api/v1/casos/{caso_laboral.id}/telegramas",
        json={"numero": 1, "tipo_comunicacion": "OTRO"},
        # sin header X-CSRF-Token
    )

    assert resp.status_code == 403


# ── PATCH /telegramas/{id} ─────────────────────────────────────────────────────


def test_patch_resultado_exito_200(client, usuario_abogado, telegrama_fixture):
    """200: actualización exitosa del resultado a ENTREGADO."""
    csrf = _login(client, ABOGADO_EMAIL, ABOGADO_PASSWORD)

    resp = client.patch(
        f"/api/v1/telegramas/{telegrama_fixture.id}",
        json={"resultado": "ENTREGADO"},
        headers={"X-CSRF-Token": csrf},
    )

    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["resultado"] == "ENTREGADO"
    assert data["id"] == telegrama_fixture.id


def test_patch_resultado_telegrama_inexistente_404(client, usuario_abogado):
    """404: telegrama con ese id no existe."""
    csrf = _login(client, ABOGADO_EMAIL, ABOGADO_PASSWORD)

    resp = client.patch(
        "/api/v1/telegramas/99999",
        json={"resultado": "ENTREGADO"},
        headers={"X-CSRF-Token": csrf},
    )

    assert resp.status_code == 404


def test_patch_resultado_pendiente_422(client, usuario_abogado, telegrama_fixture):
    """422: resultado PENDIENTE no puede asignarse manualmente (es el estado inicial)."""
    csrf = _login(client, ABOGADO_EMAIL, ABOGADO_PASSWORD)

    resp = client.patch(
        f"/api/v1/telegramas/{telegrama_fixture.id}",
        json={"resultado": "PENDIENTE"},
        headers={"X-CSRF-Token": csrf},
    )

    assert resp.status_code == 422, resp.text


def test_patch_resultado_sin_cookie_401(client_no_db):
    """401: sin sesión activa (CSRF satisfecho por separado para aislar el 401)."""
    client_no_db.cookies.set("csrf_token", "fake-csrf")
    resp = client_no_db.patch(
        "/api/v1/telegramas/1",
        json={"resultado": "ENTREGADO"},
        headers={"X-CSRF-Token": "fake-csrf"},
    )
    assert resp.status_code == 401


def test_patch_resultado_sin_csrf_403(client, usuario_abogado, telegrama_fixture):
    """403: autenticado pero sin header X-CSRF-Token → CSRFMiddleware rechaza."""
    _login(client, ABOGADO_EMAIL, ABOGADO_PASSWORD)

    resp = client.patch(
        f"/api/v1/telegramas/{telegrama_fixture.id}",
        json={"resultado": "ENTREGADO"},
        # sin header X-CSRF-Token
    )

    assert resp.status_code == 403
