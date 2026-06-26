"""
Tests de endpoints de clientes: CRUD, RBAC, CSRF, unicidad de DNI y búsqueda.

Organización:
  TestCrearCliente     — POST /clientes (4.2)
  TestObtenerCliente   — GET /clientes/{id} (4.3)
  TestEditarCliente    — PUT /clientes/{id} (4.4)
  TestListarClientes   — GET /clientes?search= (4.5)
  TestCSRFClientes     — CSRF en mutaciones (sin DB)

Tests de integración (@pytest.mark.integration) requieren PostgreSQL.
Tests de CSRF y sin sesión usan client_no_db y corren sin DB.
"""

import pytest

from tests.fixtures.usuarios import (
    ABOGADO_EMAIL,
    ABOGADO_PASSWORD,
    SOCIO_EMAIL,
    SOCIO_PASSWORD,
)
from tests.features.clientes.conftest import CLIENTE_DATOS, CLIENTE_DATOS_2

# ── Helpers ────────────────────────────────────────────────────────────────────


def _login_socio(client):
    """Realiza login como SOCIO y devuelve el CSRF token."""
    resp = client.post(
        "/api/v1/auth/login",
        json={"email": SOCIO_EMAIL, "password": SOCIO_PASSWORD},
    )
    assert resp.status_code == 200
    return client.cookies.get("csrf_token")


def _login_abogado(client):
    """Realiza login como ABOGADO y devuelve el CSRF token."""
    resp = client.post(
        "/api/v1/auth/login",
        json={"email": ABOGADO_EMAIL, "password": ABOGADO_PASSWORD},
    )
    assert resp.status_code == 200
    return client.cookies.get("csrf_token")


def _crear_cliente(client, csrf, datos=None):
    """Helper para crear un cliente y devolver el body de la respuesta."""
    payload = datos or CLIENTE_DATOS
    return client.post(
        "/api/v1/clientes",
        json=payload,
        headers={"X-CSRF-Token": csrf},
    )


# ── POST /clientes ─────────────────────────────────────────────────────────────


@pytest.mark.integration
class TestCrearCliente:
    def test_post_cliente_socio_201(self, client, usuario_socio):
        """SOCIO crea un cliente → 201 con datos del nuevo cliente."""
        csrf = _login_socio(client)
        resp = _crear_cliente(client, csrf)
        assert resp.status_code == 201
        body = resp.json()
        assert body["nombre"] == CLIENTE_DATOS["nombre"]
        assert body["dni"] == CLIENTE_DATOS["dni"]
        assert body["id"] is not None
        assert "creado_en" in body

    def test_post_cliente_abogado_201(self, client, usuario_abogado):
        """ABOGADO también puede crear clientes (D4, RF-05) → 201."""
        csrf = _login_abogado(client)
        resp = _crear_cliente(client, csrf)
        assert resp.status_code == 201
        assert resp.json()["dni"] == CLIENTE_DATOS["dni"]

    def test_post_cliente_persiste_cuil_y_domicilio(self, client, usuario_socio):
        """cuil y domicilio_real* se persisten correctamente (D2)."""
        csrf = _login_socio(client)
        resp = _crear_cliente(client, csrf)
        assert resp.status_code == 201
        body = resp.json()
        assert body["cuil"] == CLIENTE_DATOS["cuil"]
        assert body["domicilio_real"] == CLIENTE_DATOS["domicilio_real"]
        assert body["domicilio_real_cp"] == CLIENTE_DATOS["domicilio_real_cp"]
        assert body["domicilio_real_localidad"] == CLIENTE_DATOS["domicilio_real_localidad"]
        assert body["domicilio_real_provincia"] == CLIENTE_DATOS["domicilio_real_provincia"]
        assert body["domicilio_coincide_dni"] == CLIENTE_DATOS["domicilio_coincide_dni"]

    def test_post_cliente_dni_duplicado_409(self, client, usuario_socio):
        """DNI ya registrado → 409 Conflict (RN-03)."""
        csrf = _login_socio(client)
        # Crear por primera vez
        _crear_cliente(client, csrf)
        # Intentar crear con el mismo DNI
        resp = _crear_cliente(client, csrf)
        assert resp.status_code == 409

    def test_post_cliente_sin_nombre_422(self, client, usuario_socio):
        """Payload sin nombre → 422 Unprocessable Entity."""
        csrf = _login_socio(client)
        resp = client.post(
            "/api/v1/clientes",
            json={"dni": "99887766"},
            headers={"X-CSRF-Token": csrf},
        )
        assert resp.status_code == 422

    def test_post_cliente_sin_dni_422(self, client, usuario_socio):
        """Payload sin dni → 422 Unprocessable Entity."""
        csrf = _login_socio(client)
        resp = client.post(
            "/api/v1/clientes",
            json={"nombre": "Test Sin DNI"},
            headers={"X-CSRF-Token": csrf},
        )
        assert resp.status_code == 422

    def test_post_cliente_email_malformado_422(self, client, usuario_socio):
        """Email malformado → 422."""
        csrf = _login_socio(client)
        resp = client.post(
            "/api/v1/clientes",
            json={"nombre": "Test", "dni": "12345678", "email": "no-es-email"},
            headers={"X-CSRF-Token": csrf},
        )
        assert resp.status_code == 422

    def test_post_cliente_sin_sesion_401(self, client):
        """POST /clientes sin sesión activa → 401."""
        resp = client.post(
            "/api/v1/clientes",
            json=CLIENTE_DATOS,
            headers={"X-CSRF-Token": "dummy"},
        )
        assert resp.status_code == 401

    def test_post_cliente_sin_csrf_403(self, client, usuario_socio):
        """POST /clientes sin X-CSRF-Token → 403 del middleware CSRF."""
        _login_socio(client)
        resp = client.post(
            "/api/v1/clientes",
            json=CLIENTE_DATOS,
            # Sin header X-CSRF-Token
        )
        assert resp.status_code == 403


# ── GET /clientes/{id} ─────────────────────────────────────────────────────────


@pytest.mark.integration
class TestObtenerCliente:
    def test_get_cliente_200(self, client, usuario_socio):
        """GET /clientes/{id} con sesión activa → 200."""
        csrf = _login_socio(client)
        creado = _crear_cliente(client, csrf).json()
        resp = client.get(f"/api/v1/clientes/{creado['id']}")
        assert resp.status_code == 200
        assert resp.json()["id"] == creado["id"]
        assert resp.json()["nombre"] == CLIENTE_DATOS["nombre"]

    def test_get_cliente_abogado_200(self, client, usuario_socio, usuario_abogado):
        """ABOGADO también puede leer un cliente (RN-08)."""
        csrf = _login_socio(client)
        creado = _crear_cliente(client, csrf).json()
        _login_abogado(client)
        resp = client.get(f"/api/v1/clientes/{creado['id']}")
        assert resp.status_code == 200

    def test_get_cliente_inexistente_404(self, client, usuario_socio):
        """GET /clientes/99999 → 404."""
        _login_socio(client)
        resp = client.get("/api/v1/clientes/99999")
        assert resp.status_code == 404

    def test_get_cliente_sin_sesion_401(self, client):
        """GET /clientes/{id} sin sesión → 401."""
        resp = client.get("/api/v1/clientes/1")
        assert resp.status_code == 401


# ── PUT /clientes/{id} ─────────────────────────────────────────────────────────


@pytest.mark.integration
class TestEditarCliente:
    def test_put_cliente_200(self, client, usuario_socio):
        """SOCIO edita un cliente → 200 con datos actualizados."""
        csrf = _login_socio(client)
        creado = _crear_cliente(client, csrf).json()
        nuevo_nombre = "García Rodríguez, Juan Carlos"
        resp = client.put(
            f"/api/v1/clientes/{creado['id']}",
            json={**CLIENTE_DATOS, "nombre": nuevo_nombre},
            headers={"X-CSRF-Token": csrf},
        )
        assert resp.status_code == 200
        assert resp.json()["nombre"] == nuevo_nombre

    def test_put_cliente_abogado_200(self, client, usuario_abogado):
        """ABOGADO también puede editar clientes (D4)."""
        csrf = _login_abogado(client)
        creado = _crear_cliente(client, csrf).json()
        resp = client.put(
            f"/api/v1/clientes/{creado['id']}",
            json={**CLIENTE_DATOS, "nombre": "Editado por abogado"},
            headers={"X-CSRF-Token": csrf},
        )
        assert resp.status_code == 200

    def test_put_cliente_inexistente_404(self, client, usuario_socio):
        """PUT /clientes/99999 → 404."""
        csrf = _login_socio(client)
        resp = client.put(
            "/api/v1/clientes/99999",
            json=CLIENTE_DATOS,
            headers={"X-CSRF-Token": csrf},
        )
        assert resp.status_code == 404

    def test_put_cliente_dni_de_otro_409(self, client, usuario_socio):
        """Cambiar al DNI de otro cliente → 409 (D3)."""
        csrf = _login_socio(client)
        # Crear dos clientes
        cliente1 = _crear_cliente(client, csrf).json()
        _crear_cliente(client, csrf, datos=CLIENTE_DATOS_2)
        # Intentar asignar el DNI del cliente2 al cliente1
        resp = client.put(
            f"/api/v1/clientes/{cliente1['id']}",
            json={**CLIENTE_DATOS, "dni": CLIENTE_DATOS_2["dni"]},
            headers={"X-CSRF-Token": csrf},
        )
        assert resp.status_code == 409

    def test_put_cliente_sin_csrf_403(self, client, usuario_socio):
        """PUT /clientes/{id} sin X-CSRF-Token → 403."""
        csrf = _login_socio(client)
        creado = _crear_cliente(client, csrf).json()
        resp = client.put(
            f"/api/v1/clientes/{creado['id']}",
            json=CLIENTE_DATOS,
            # Sin header X-CSRF-Token
        )
        assert resp.status_code == 403


# ── GET /clientes?search= ──────────────────────────────────────────────────────


@pytest.mark.integration
class TestListarClientes:
    def test_get_clientes_200(self, client, usuario_socio):
        """GET /clientes con sesión activa → 200 y lista."""
        csrf = _login_socio(client)
        _crear_cliente(client, csrf)
        resp = client.get("/api/v1/clientes")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)
        assert len(resp.json()) >= 1

    def test_get_clientes_sin_sesion_401(self, client):
        """GET /clientes sin sesión → 401."""
        resp = client.get("/api/v1/clientes")
        assert resp.status_code == 401

    def test_get_clientes_busqueda_por_nombre(self, client, usuario_socio):
        """Búsqueda por nombre parcial (case-insensitive) devuelve el cliente correcto."""
        csrf = _login_socio(client)
        _crear_cliente(client, csrf)
        _crear_cliente(client, csrf, datos=CLIENTE_DATOS_2)
        resp = client.get("/api/v1/clientes?search=garcia")
        assert resp.status_code == 200
        body = resp.json()
        assert len(body) >= 1
        assert any(CLIENTE_DATOS["nombre"] in c["nombre"] for c in body)

    def test_get_clientes_busqueda_por_dni(self, client, usuario_socio):
        """Búsqueda por DNI devuelve el cliente correcto."""
        csrf = _login_socio(client)
        _crear_cliente(client, csrf)
        _crear_cliente(client, csrf, datos=CLIENTE_DATOS_2)
        resp = client.get(f"/api/v1/clientes?search={CLIENTE_DATOS['dni']}")
        assert resp.status_code == 200
        body = resp.json()
        assert len(body) >= 1
        assert any(c["dni"] == CLIENTE_DATOS["dni"] for c in body)

    def test_get_clientes_paginacion(self, client, usuario_socio):
        """page=2 con pocos registros devuelve lista vacía."""
        csrf = _login_socio(client)
        _crear_cliente(client, csrf)
        resp = client.get("/api/v1/clientes?page=2")
        assert resp.status_code == 200
        # Con solo 1 cliente, la página 2 debe estar vacía
        assert resp.json() == []

    def test_get_clientes_busqueda_sin_resultados(self, client, usuario_socio):
        """Búsqueda sin coincidencias devuelve lista vacía."""
        csrf = _login_socio(client)
        _crear_cliente(client, csrf)
        resp = client.get("/api/v1/clientes?search=xyzinexistente")
        assert resp.status_code == 200
        assert resp.json() == []


# ── CSRF en mutaciones ─────────────────────────────────────────────────────────


class TestCSRFClientes:
    def test_post_sin_csrf_403(self, client_no_db):
        """POST /clientes sin X-CSRF-Token → 403 del middleware."""
        resp = client_no_db.post(
            "/api/v1/clientes",
            json=CLIENTE_DATOS,
        )
        assert resp.status_code == 403

    def test_put_sin_csrf_403(self, client_no_db):
        """PUT /clientes/{id} sin X-CSRF-Token → 403 del middleware."""
        resp = client_no_db.put(
            "/api/v1/clientes/1",
            json=CLIENTE_DATOS,
        )
        assert resp.status_code == 403

    def test_get_sin_sesion_401(self, client_no_db):
        """GET /clientes sin sesión activa → 401."""
        resp = client_no_db.get("/api/v1/clientes")
        assert resp.status_code == 401

    def test_get_id_sin_sesion_401(self, client_no_db):
        """GET /clientes/{id} sin sesión activa → 401."""
        resp = client_no_db.get("/api/v1/clientes/1")
        assert resp.status_code == 401
