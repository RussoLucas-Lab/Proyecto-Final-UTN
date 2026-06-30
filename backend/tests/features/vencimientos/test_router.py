"""Tests de integración del router de vencimientos."""

import pytest

from tests.fixtures.usuarios import ABOGADO_EMAIL, ABOGADO_PASSWORD


def _login(client):
    resp = client.post(
        "/api/v1/auth/login",
        json={"email": ABOGADO_EMAIL, "password": ABOGADO_PASSWORD},
    )
    assert resp.status_code == 200
    return resp.cookies.get("csrf_token", "")


# ── POST /casos/{caso_id}/vencimientos ────────────────────────────────────────


class TestCrearVencimiento:
    def test_201_con_abogado(self, client, usuario_abogado, caso_con_abogado):
        csrf = _login(client)
        resp = client.post(
            f"/api/v1/casos/{caso_con_abogado}/vencimientos",
            json={"descripcion": "Presentar demanda", "fecha": "2026-07-15"},
            headers={"X-CSRF-Token": csrf},
        )
        assert resp.status_code == 201
        body = resp.json()
        assert body["descripcion"] == "Presentar demanda"
        assert body["fecha"] == "2026-07-15"
        assert body["completado"] is False
        assert body["caso_id"] == caso_con_abogado

    def test_401_sin_sesion(self, client_no_db):
        resp = client_no_db.post(
            "/api/v1/casos/1/vencimientos",
            json={"descripcion": "Test", "fecha": "2026-07-15"},
            headers={"X-CSRF-Token": "fake"},
        )
        assert resp.status_code in (401, 403)

    def test_404_caso_inexistente(self, client, usuario_abogado):
        csrf = _login(client)
        resp = client.post(
            "/api/v1/casos/9999/vencimientos",
            json={"descripcion": "Test", "fecha": "2026-07-15"},
            headers={"X-CSRF-Token": csrf},
        )
        assert resp.status_code == 404

    def test_422_descripcion_vacia(self, client, usuario_abogado, caso_con_abogado):
        csrf = _login(client)
        resp = client.post(
            f"/api/v1/casos/{caso_con_abogado}/vencimientos",
            json={"descripcion": "", "fecha": "2026-07-15"},
            headers={"X-CSRF-Token": csrf},
        )
        assert resp.status_code == 422


# ── GET /casos/{caso_id}/vencimientos ─────────────────────────────────────────


class TestListarVencimientosCaso:
    def test_200_lista_vacia(self, client, usuario_abogado, caso_con_abogado):
        _login(client)
        resp = client.get(f"/api/v1/casos/{caso_con_abogado}/vencimientos")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_200_con_vencimiento(self, client, usuario_abogado, caso_con_abogado):
        csrf = _login(client)
        client.post(
            f"/api/v1/casos/{caso_con_abogado}/vencimientos",
            json={"descripcion": "Audiencia", "fecha": "2026-08-01"},
            headers={"X-CSRF-Token": csrf},
        )
        resp = client.get(f"/api/v1/casos/{caso_con_abogado}/vencimientos")
        assert resp.status_code == 200
        assert len(resp.json()) == 1
        assert resp.json()[0]["descripcion"] == "Audiencia"

    def test_404_caso_inexistente(self, client, usuario_abogado):
        _login(client)
        resp = client.get("/api/v1/casos/9999/vencimientos")
        assert resp.status_code == 404

    def test_401_sin_sesion(self, client_no_db):
        resp = client_no_db.get("/api/v1/casos/1/vencimientos")
        assert resp.status_code == 401


# ── GET /vencimientos?desde=&hasta= ──────────────────────────────────────────


class TestListarVencimientosRango:
    def test_200_rango_valido(self, client, usuario_abogado, caso_con_abogado):
        csrf = _login(client)
        client.post(
            f"/api/v1/casos/{caso_con_abogado}/vencimientos",
            json={"descripcion": "Demanda", "fecha": "2026-07-10"},
            headers={"X-CSRF-Token": csrf},
        )
        resp = client.get("/api/v1/vencimientos?desde=2026-07-01&hasta=2026-07-31")
        assert resp.status_code == 200
        assert len(resp.json()) == 1

    def test_422_sin_params(self, client, usuario_abogado):
        _login(client)
        resp = client.get("/api/v1/vencimientos")
        assert resp.status_code == 422

    def test_401_sin_sesion(self, client_no_db):
        resp = client_no_db.get("/api/v1/vencimientos?desde=2026-07-01&hasta=2026-07-31")
        assert resp.status_code == 401


# ── PATCH /vencimientos/{id} ──────────────────────────────────────────────────


class TestCompletarVencimiento:
    def test_200_completado(self, client, usuario_abogado, caso_con_abogado):
        csrf = _login(client)
        create_resp = client.post(
            f"/api/v1/casos/{caso_con_abogado}/vencimientos",
            json={"descripcion": "Notificación", "fecha": "2026-07-20"},
            headers={"X-CSRF-Token": csrf},
        )
        venc_id = create_resp.json()["id"]

        resp = client.patch(
            f"/api/v1/vencimientos/{venc_id}",
            json={"completado": True},
            headers={"X-CSRF-Token": csrf},
        )
        assert resp.status_code == 200
        assert resp.json()["completado"] is True

    def test_404_inexistente(self, client, usuario_abogado):
        csrf = _login(client)
        resp = client.patch(
            "/api/v1/vencimientos/9999",
            json={"completado": True},
            headers={"X-CSRF-Token": csrf},
        )
        assert resp.status_code == 404

    def test_401_sin_sesion(self, client_no_db):
        resp = client_no_db.patch(
            "/api/v1/vencimientos/1",
            json={"completado": True},
            headers={"X-CSRF-Token": "fake"},
        )
        assert resp.status_code in (401, 403)
