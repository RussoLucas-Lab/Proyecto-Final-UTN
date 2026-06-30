"""
Tests de endpoints de documentos: init, register, list, download URL.

Tests de integración (@pytest.mark.integration) requieren PostgreSQL.
Tests sin sesión usan client_no_db y corren sin DB.
"""

import pytest

from tests.fixtures.usuarios import ABOGADO_EMAIL, ABOGADO_PASSWORD


def _login_abogado(client):
    resp = client.post(
        "/api/v1/auth/login",
        json={"email": ABOGADO_EMAIL, "password": ABOGADO_PASSWORD},
    )
    assert resp.status_code == 200
    return client.cookies.get("csrf_token")


# ── POST /casos/{id}/documentos:init ──────────────────────────────────────────


@pytest.mark.integration
class TestDocumentosInit:
    def test_init_200_con_abogado(self, client, usuario_abogado, caso_con_abogado):
        csrf = _login_abogado(client)
        resp = client.post(
            f"/api/v1/casos/{caso_con_abogado}/documentos:init",
            json={"nombre_archivo": "dni.pdf", "categoria": "DNI", "formato": "PDF"},
            headers={"X-CSRF-Token": csrf},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert "upload_url" in body
        assert "object_key" in body
        assert body["object_key"].startswith(f"casos/{caso_con_abogado}/")
        assert body["expires_in"] == 300

    def test_init_404_caso_inexistente(self, client, usuario_abogado):
        csrf = _login_abogado(client)
        resp = client.post(
            "/api/v1/casos/99999/documentos:init",
            json={"nombre_archivo": "x.pdf", "categoria": "DNI", "formato": "PDF"},
            headers={"X-CSRF-Token": csrf},
        )
        assert resp.status_code == 404

    def test_init_422_formato_invalido(self, client, usuario_abogado, caso_con_abogado):
        csrf = _login_abogado(client)
        resp = client.post(
            f"/api/v1/casos/{caso_con_abogado}/documentos:init",
            json={"nombre_archivo": "x.xlsx", "categoria": "OTRO", "formato": "XLSX"},
            headers={"X-CSRF-Token": csrf},
        )
        assert resp.status_code == 422


class TestDocumentosInitSinSesion:
    def test_init_401_sin_sesion(self, client_no_db, caso_con_abogado=1):
        resp = client_no_db.post(
            "/api/v1/casos/1/documentos:init",
            json={"nombre_archivo": "x.pdf", "categoria": "DNI", "formato": "PDF"},
        )
        # CSRF middleware rechaza antes que el auth check en POSTs sin token
        assert resp.status_code in (401, 403)


# ── POST /casos/{id}/documentos ───────────────────────────────────────────────


@pytest.mark.integration
class TestDocumentosRegister:
    def test_register_201_con_abogado(self, client, usuario_abogado, caso_con_abogado, mock_storage):
        csrf = _login_abogado(client)
        resp = client.post(
            f"/api/v1/casos/{caso_con_abogado}/documentos",
            json={
                "object_key": f"casos/{caso_con_abogado}/test-uuid.pdf",
                "nombre_archivo": "dni_test.pdf",
                "categoria": "DNI",
                "formato": "PDF",
            },
            headers={"X-CSRF-Token": csrf},
        )
        assert resp.status_code == 201
        body = resp.json()
        assert body["object_key"] == f"casos/{caso_con_abogado}/test-uuid.pdf"
        assert body["caso_id"] == caso_con_abogado
        assert body["subido_por"] == usuario_abogado.id

    def test_register_404_caso_inexistente(self, client, usuario_abogado):
        csrf = _login_abogado(client)
        resp = client.post(
            "/api/v1/casos/99999/documentos",
            json={
                "object_key": "casos/99999/x.pdf",
                "nombre_archivo": "x.pdf",
                "categoria": "DNI",
                "formato": "PDF",
            },
            headers={"X-CSRF-Token": csrf},
        )
        assert resp.status_code == 404


class TestDocumentosRegisterCSRF:
    def test_register_403_sin_csrf(self, client_no_db):
        resp = client_no_db.post(
            "/api/v1/casos/1/documentos",
            json={
                "object_key": "casos/1/x.pdf",
                "nombre_archivo": "x.pdf",
                "categoria": "DNI",
                "formato": "PDF",
            },
        )
        assert resp.status_code in (401, 403)


# ── GET /casos/{id}/documentos ────────────────────────────────────────────────


@pytest.mark.integration
class TestDocumentosListar:
    def test_list_200_vacio(self, client, usuario_abogado, caso_con_abogado):
        _login_abogado(client)
        resp = client.get(f"/api/v1/casos/{caso_con_abogado}/documentos")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_list_200_con_documento(self, client, usuario_abogado, caso_con_abogado):
        csrf = _login_abogado(client)
        client.post(
            f"/api/v1/casos/{caso_con_abogado}/documentos",
            json={
                "object_key": f"casos/{caso_con_abogado}/z.pdf",
                "nombre_archivo": "dni.pdf",
                "categoria": "DNI",
                "formato": "PDF",
            },
            headers={"X-CSRF-Token": csrf},
        )
        resp = client.get(f"/api/v1/casos/{caso_con_abogado}/documentos")
        assert resp.status_code == 200
        assert len(resp.json()) == 1

    def test_list_404_caso_inexistente(self, client, usuario_abogado):
        _login_abogado(client)
        resp = client.get("/api/v1/casos/99999/documentos")
        assert resp.status_code == 404


class TestDocumentosListarSinSesion:
    def test_list_401_sin_sesion(self, client_no_db):
        resp = client_no_db.get("/api/v1/casos/1/documentos")
        assert resp.status_code == 401


# ── GET /documentos/{id}/url ──────────────────────────────────────────────────


@pytest.mark.integration
class TestDocumentosDownloadUrl:
    def test_download_url_200(self, client, usuario_abogado, caso_con_abogado, mock_storage):
        csrf = _login_abogado(client)
        reg = client.post(
            f"/api/v1/casos/{caso_con_abogado}/documentos",
            json={
                "object_key": f"casos/{caso_con_abogado}/dl.pdf",
                "nombre_archivo": "doc.pdf",
                "categoria": "DNI",
                "formato": "PDF",
            },
            headers={"X-CSRF-Token": csrf},
        )
        doc_id = reg.json()["id"]

        resp = client.get(f"/api/v1/documentos/{doc_id}/url")
        assert resp.status_code == 200
        body = resp.json()
        assert "download_url" in body
        assert body["expires_in"] == 3600

    def test_download_url_404_documento_inexistente(self, client, usuario_abogado):
        _login_abogado(client)
        resp = client.get("/api/v1/documentos/99999/url")
        assert resp.status_code == 404


class TestDocumentosDownloadSinSesion:
    def test_download_401_sin_sesion(self, client_no_db):
        resp = client_no_db.get("/api/v1/documentos/1/url")
        assert resp.status_code == 401
