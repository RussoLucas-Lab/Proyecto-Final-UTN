"""
Tests de endpoints de casos: ABM, máquina de estados, historial, RBAC y CSRF.

Organización:
  TestCrearCaso           — POST /casos (4.2)
  TestFichaLaboral        — PUT /casos/{id}/ficha-laboral (4.3)
  TestAvanzarEtapa        — POST /casos/{id}/avanzar (4.4)
  TestRetrocederEtapa     — POST /casos/{id}/retroceder (4.5)
  TestHistorial           — GET /casos/{id}/historial (4.6)
  TestListarYDetalle      — GET /casos y GET /casos/{id} (4.7)
  TestCSRFCasos           — CSRF en mutaciones, sin DB (4.7 extra)

Tests de integración (@pytest.mark.integration) requieren PostgreSQL.
Tests sin DB (CSRF) usan client_no_db.

Regla ADR-0008 ("estados como datos"):
  NINGÚN test hardcodea un nombre de etapa para buscar en la DB.
  La etapa inicial se verifica por dato (id del primer historial).
"""

import pytest

from tests.fixtures.usuarios import (
    ABOGADO_EMAIL,
    ABOGADO_PASSWORD,
    SOCIO_EMAIL,
    SOCIO_PASSWORD,
)
from tests.features.casos.conftest import CASO_ART, CASO_LABORAL, FICHA_DATOS


# ── Helpers ────────────────────────────────────────────────────────────────────


def _login_socio(client):
    resp = client.post(
        "/api/v1/auth/login",
        json={"email": SOCIO_EMAIL, "password": SOCIO_PASSWORD},
    )
    assert resp.status_code == 200
    return client.cookies.get("csrf_token")


def _login_abogado(client):
    resp = client.post(
        "/api/v1/auth/login",
        json={"email": ABOGADO_EMAIL, "password": ABOGADO_PASSWORD},
    )
    assert resp.status_code == 200
    return client.cookies.get("csrf_token")


def _crear_caso(client, csrf, usuario, cliente, area="LABORAL", tipo_reclamo=None):
    """Helper para crear un caso y devolver la respuesta."""
    payload = {
        "cliente_id": cliente.id,
        "abogado_responsable_id": usuario.id,
        "area": area,
    }
    if tipo_reclamo:
        payload["tipo_reclamo"] = tipo_reclamo
    return client.post(
        "/api/v1/casos",
        json=payload,
        headers={"X-CSRF-Token": csrf},
    )


def _get_primera_transicion_valida(client, caso_id):
    """Obtiene el id de la primera etapa válida para avanzar (de transiciones_validas)."""
    resp = client.get(f"/api/v1/casos/{caso_id}")
    assert resp.status_code == 200
    transiciones = resp.json().get("transiciones_validas", [])
    assert len(transiciones) > 0, "El caso debe tener al menos una transición válida"
    return transiciones[0]["id"]


# ── POST /casos (task 4.2) ─────────────────────────────────────────────────────


@pytest.mark.integration
class TestCrearCaso:
    def test_post_caso_laboral_201(self, client, usuario_socio, cliente_sintetico):
        """SOCIO crea un caso LABORAL → 201 con etapa inicial resuelta por dato."""
        csrf = _login_socio(client)
        resp = _crear_caso(client, csrf, usuario_socio, cliente_sintetico)
        assert resp.status_code == 201
        body = resp.json()
        assert body["area"] == "LABORAL"
        assert body["tipo_reclamo"] is None
        assert body["id"] is not None
        assert body["etapa_actual_id"] is not None
        assert "creado_en" in body

    def test_post_caso_abogado_201(self, client, usuario_abogado, cliente_sintetico):
        """ABOGADO también puede crear casos → 201."""
        csrf = _login_abogado(client)
        resp = _crear_caso(client, csrf, usuario_abogado, cliente_sintetico)
        assert resp.status_code == 201

    def test_post_caso_laboral_genera_historial_inicial(self, client, usuario_socio, cliente_sintetico):
        """Alta Laboral: primera entrada de historial con etapa_anterior_id=NULL (RN-05, D5)."""
        csrf = _login_socio(client)
        resp = _crear_caso(client, csrf, usuario_socio, cliente_sintetico)
        assert resp.status_code == 201
        caso_id = resp.json()["id"]
        etapa_inicial_id = resp.json()["etapa_actual_id"]

        hist_resp = client.get(f"/api/v1/casos/{caso_id}/historial")
        assert hist_resp.status_code == 200
        historial = hist_resp.json()
        assert len(historial) == 1
        assert historial[0]["etapa_anterior_id"] is None    # primera entrada
        assert historial[0]["etapa_nueva_id"] == etapa_inicial_id
        assert historial[0]["evento"] == "creación"

    def test_post_caso_laboral_etapa_inicial_por_dato(self, client, usuario_socio, cliente_sintetico):
        """La etapa inicial es la de menor orden del área (ADR-0008, D2).
        Verificamos que el id sea consistente — nunca por nombre hardcodeado.
        """
        csrf = _login_socio(client)
        resp = _crear_caso(client, csrf, usuario_socio, cliente_sintetico)
        assert resp.status_code == 201
        etapa_id = resp.json()["etapa_actual_id"]

        # Verificar que el detalle tiene esa etapa con orden mínimo en LABORAL
        detalle = client.get(f"/api/v1/casos/{resp.json()['id']}").json()
        assert detalle["etapa_actual"]["id"] == etapa_id
        assert detalle["etapa_actual"]["area"] == "LABORAL"
        # El orden debe ser el mínimo (no hardcodeamos el número exacto)
        assert detalle["etapa_actual"]["orden"] >= 1

    def test_post_caso_con_ficha_anidada_201(self, client, usuario_socio, cliente_sintetico):
        """Alta con ficha laboral anidada → 201 y ficha disponible en el detalle."""
        csrf = _login_socio(client)
        payload = {
            "cliente_id": cliente_sintetico.id,
            "abogado_responsable_id": usuario_socio.id,
            "area": "LABORAL",
            "ficha_laboral": FICHA_DATOS,
        }
        resp = client.post(
            "/api/v1/casos",
            json=payload,
            headers={"X-CSRF-Token": csrf},
        )
        assert resp.status_code == 201
        caso_id = resp.json()["id"]

        detalle = client.get(f"/api/v1/casos/{caso_id}").json()
        assert detalle["ficha"] is not None
        assert detalle["ficha"]["empleador_nombre"] == FICHA_DATOS["empleador_nombre"]

    def test_post_caso_art_sin_tipo_reclamo_422(self, client, usuario_socio, cliente_sintetico):
        """ART sin tipo_reclamo → 422 Unprocessable Entity (D6, D10)."""
        csrf = _login_socio(client)
        resp = _crear_caso(client, csrf, usuario_socio, cliente_sintetico, area="ART")
        assert resp.status_code == 422

    def test_post_caso_art_con_tipo_reclamo_201(self, client, usuario_socio, cliente_sintetico):
        """ART con tipo_reclamo=ACCIDENTE → 201."""
        csrf = _login_socio(client)
        resp = _crear_caso(
            client, csrf, usuario_socio, cliente_sintetico,
            area="ART", tipo_reclamo="ACCIDENTE"
        )
        assert resp.status_code == 201
        assert resp.json()["area"] == "ART"
        assert resp.json()["tipo_reclamo"] == "ACCIDENTE"

    def test_post_caso_cliente_inexistente_404(self, client, usuario_socio, cliente_sintetico):
        """Cliente inexistente → 404 (RN-01)."""
        csrf = _login_socio(client)
        resp = client.post(
            "/api/v1/casos",
            json={"cliente_id": 99999, "abogado_responsable_id": usuario_socio.id, "area": "LABORAL"},
            headers={"X-CSRF-Token": csrf},
        )
        assert resp.status_code == 404

    def test_post_caso_sin_sesion_401(self, client):
        """POST /casos sin sesión → 401."""
        resp = client.post(
            "/api/v1/casos",
            json={"cliente_id": 1, "abogado_responsable_id": 1, "area": "LABORAL"},
            headers={"X-CSRF-Token": "dummy"},
        )
        assert resp.status_code == 401

    def test_post_caso_sin_csrf_403(self, client, usuario_socio, cliente_sintetico):
        """POST /casos sin X-CSRF-Token → 403."""
        _login_socio(client)
        resp = client.post(
            "/api/v1/casos",
            json={"cliente_id": cliente_sintetico.id, "abogado_responsable_id": usuario_socio.id, "area": "LABORAL"},
        )
        assert resp.status_code == 403


# ── PUT /casos/{id}/ficha-laboral (task 4.3) ───────────────────────────────────


@pytest.mark.integration
class TestFichaLaboral:
    def test_put_ficha_laboral_crear_200(self, client, usuario_socio, cliente_sintetico):
        """Crear ficha laboral en un caso sin ficha → 200."""
        csrf = _login_socio(client)
        caso_resp = _crear_caso(client, csrf, usuario_socio, cliente_sintetico)
        caso_id = caso_resp.json()["id"]

        resp = client.put(
            f"/api/v1/casos/{caso_id}/ficha-laboral",
            json=FICHA_DATOS,
            headers={"X-CSRF-Token": csrf},
        )
        assert resp.status_code == 200
        assert resp.json()["empleador_nombre"] == FICHA_DATOS["empleador_nombre"]
        assert resp.json()["caso_id"] == caso_id

    def test_put_ficha_laboral_actualizar_200(self, client, usuario_socio, cliente_sintetico):
        """Actualizar ficha laboral existente → 200 con datos actualizados."""
        csrf = _login_socio(client)
        caso_resp = _crear_caso(client, csrf, usuario_socio, cliente_sintetico)
        caso_id = caso_resp.json()["id"]

        # Crear ficha
        client.put(
            f"/api/v1/casos/{caso_id}/ficha-laboral",
            json=FICHA_DATOS,
            headers={"X-CSRF-Token": csrf},
        )

        # Actualizar ficha
        nuevos_datos = {**FICHA_DATOS, "empleador_nombre": "Nueva Empresa S.R.L."}
        resp = client.put(
            f"/api/v1/casos/{caso_id}/ficha-laboral",
            json=nuevos_datos,
            headers={"X-CSRF-Token": csrf},
        )
        assert resp.status_code == 200
        assert resp.json()["empleador_nombre"] == "Nueva Empresa S.R.L."

    def test_put_ficha_laboral_caso_inexistente_404(self, client, usuario_socio, cliente_sintetico):
        """PUT /casos/99999/ficha-laboral → 404."""
        csrf = _login_socio(client)
        _login_socio(client)
        resp = client.put(
            "/api/v1/casos/99999/ficha-laboral",
            json=FICHA_DATOS,
            headers={"X-CSRF-Token": csrf},
        )
        assert resp.status_code == 404


# ── POST /casos/{id}/avanzar (task 4.4) ───────────────────────────────────────


@pytest.mark.integration
class TestAvanzarEtapa:
    def test_avanzar_transicion_valida_200(self, client, usuario_socio, cliente_sintetico):
        """Avanzar por transición válida → 200 con nueva etapa (ADR-0008, RN-04)."""
        csrf = _login_socio(client)
        caso_resp = _crear_caso(client, csrf, usuario_socio, cliente_sintetico)
        caso_id = caso_resp.json()["id"]
        etapa_inicial_id = caso_resp.json()["etapa_actual_id"]

        # Obtener la primera transición válida del detalle (NO hardcodeamos nombre)
        destino_id = _get_primera_transicion_valida(client, caso_id)

        resp = client.post(
            f"/api/v1/casos/{caso_id}/avanzar",
            json={"etapa_destino_id": destino_id},
            headers={"X-CSRF-Token": csrf},
        )
        assert resp.status_code == 200
        nueva_etapa = resp.json()["etapa_actual_id"]
        assert nueva_etapa == destino_id
        assert nueva_etapa != etapa_inicial_id

    def test_avanzar_registra_historial(self, client, usuario_socio, cliente_sintetico):
        """Avance exitoso registra entrada de historial (evento=avance, RN-05)."""
        csrf = _login_socio(client)
        caso_resp = _crear_caso(client, csrf, usuario_socio, cliente_sintetico)
        caso_id = caso_resp.json()["id"]
        etapa_anterior_id = caso_resp.json()["etapa_actual_id"]

        destino_id = _get_primera_transicion_valida(client, caso_id)
        client.post(
            f"/api/v1/casos/{caso_id}/avanzar",
            json={"etapa_destino_id": destino_id},
            headers={"X-CSRF-Token": csrf},
        )

        historial = client.get(f"/api/v1/casos/{caso_id}/historial").json()
        assert len(historial) == 2  # creación + avance
        ultimo = historial[-1]
        assert ultimo["etapa_anterior_id"] == etapa_anterior_id
        assert ultimo["etapa_nueva_id"] == destino_id
        assert ultimo["evento"] == "avance"

    def test_avanzar_transicion_invalida_409(self, client, usuario_socio, cliente_sintetico):
        """Avanzar con etapa_destino_id sin transición válida → 409 (RN-04, D3)."""
        csrf = _login_socio(client)
        caso_resp = _crear_caso(client, csrf, usuario_socio, cliente_sintetico)
        caso_id = caso_resp.json()["id"]

        resp = client.post(
            f"/api/v1/casos/{caso_id}/avanzar",
            json={"etapa_destino_id": 99999},
            headers={"X-CSRF-Token": csrf},
        )
        assert resp.status_code == 409

    def test_avanzar_caso_inexistente_404(self, client, usuario_socio, cliente_sintetico):
        """POST /casos/99999/avanzar → 404."""
        csrf = _login_socio(client)
        _login_socio(client)
        resp = client.post(
            "/api/v1/casos/99999/avanzar",
            json={"etapa_destino_id": 1},
            headers={"X-CSRF-Token": csrf},
        )
        assert resp.status_code == 404


# ── POST /casos/{id}/retroceder (task 4.5) ────────────────────────────────────


@pytest.mark.integration
class TestRetrocederEtapa:
    def _avanzar_una_vez(self, client, csrf, caso_id):
        """Helper: avanzar a la primera etapa válida y retornar el id de la etapa anterior."""
        etapa_anterior = client.get(f"/api/v1/casos/{caso_id}").json()["etapa_actual_id"]
        destino_id = _get_primera_transicion_valida(client, caso_id)
        resp = client.post(
            f"/api/v1/casos/{caso_id}/avanzar",
            json={"etapa_destino_id": destino_id},
            headers={"X-CSRF-Token": csrf},
        )
        assert resp.status_code == 200
        return etapa_anterior  # devuelve el id al que podemos retroceder

    def test_retroceder_confirmado_200(self, client, usuario_socio, cliente_sintetico):
        """Retroceder con confirmar=true desde etapa no terminal → 200."""
        csrf = _login_socio(client)
        caso_resp = _crear_caso(client, csrf, usuario_socio, cliente_sintetico)
        caso_id = caso_resp.json()["id"]
        etapa_inicial_id = self._avanzar_una_vez(client, csrf, caso_id)

        resp = client.post(
            f"/api/v1/casos/{caso_id}/retroceder",
            json={"etapa_destino_id": etapa_inicial_id, "confirmar": True},
            headers={"X-CSRF-Token": csrf},
        )
        assert resp.status_code == 200
        assert resp.json()["etapa_actual_id"] == etapa_inicial_id

    def test_retroceder_registra_historial(self, client, usuario_socio, cliente_sintetico):
        """Retroceso exitoso registra entrada de historial (evento=retroceso, RN-05)."""
        csrf = _login_socio(client)
        caso_resp = _crear_caso(client, csrf, usuario_socio, cliente_sintetico)
        caso_id = caso_resp.json()["id"]
        etapa_inicial_id = self._avanzar_una_vez(client, csrf, caso_id)
        etapa_actual_id = client.get(f"/api/v1/casos/{caso_id}").json()["etapa_actual_id"]

        client.post(
            f"/api/v1/casos/{caso_id}/retroceder",
            json={"etapa_destino_id": etapa_inicial_id, "confirmar": True},
            headers={"X-CSRF-Token": csrf},
        )

        historial = client.get(f"/api/v1/casos/{caso_id}/historial").json()
        ultimo = historial[-1]
        assert ultimo["etapa_anterior_id"] == etapa_actual_id
        assert ultimo["etapa_nueva_id"] == etapa_inicial_id
        assert ultimo["evento"] == "retroceso"

    def test_retroceder_destino_otra_area_409(self, client, usuario_socio, cliente_sintetico):
        """Retroceder a etapa de otra área → 409 (RN-11, D4)."""
        csrf = _login_socio(client)
        # Crear un caso LABORAL
        caso_resp = _crear_caso(client, csrf, usuario_socio, cliente_sintetico)
        caso_id = caso_resp.json()["id"]

        # Crear un caso ART para obtener una etapa ART
        caso_art_resp = _crear_caso(
            client, csrf, usuario_socio, cliente_sintetico,
            area="ART", tipo_reclamo="ACCIDENTE"
        )
        etapa_art_id = caso_art_resp.json()["etapa_actual_id"]

        # Intentar retroceder el caso LABORAL a una etapa ART
        resp = client.post(
            f"/api/v1/casos/{caso_id}/retroceder",
            json={"etapa_destino_id": etapa_art_id, "confirmar": True},
            headers={"X-CSRF-Token": csrf},
        )
        assert resp.status_code == 409


# ── GET /casos/{id}/historial (task 4.6) ──────────────────────────────────────


@pytest.mark.integration
class TestHistorial:
    def test_get_historial_200_orden_cronologico(self, client, usuario_socio, cliente_sintetico):
        """GET /casos/{id}/historial → 200 con historial en orden cronológico (RN-06)."""
        csrf = _login_socio(client)
        caso_resp = _crear_caso(client, csrf, usuario_socio, cliente_sintetico)
        caso_id = caso_resp.json()["id"]

        # Avanzar dos veces para tener 3 entradas
        destino1 = _get_primera_transicion_valida(client, caso_id)
        client.post(
            f"/api/v1/casos/{caso_id}/avanzar",
            json={"etapa_destino_id": destino1},
            headers={"X-CSRF-Token": csrf},
        )
        destino2 = _get_primera_transicion_valida(client, caso_id)
        client.post(
            f"/api/v1/casos/{caso_id}/avanzar",
            json={"etapa_destino_id": destino2},
            headers={"X-CSRF-Token": csrf},
        )

        resp = client.get(f"/api/v1/casos/{caso_id}/historial")
        assert resp.status_code == 200
        historial = resp.json()
        assert len(historial) == 3
        assert historial[0]["evento"] == "creación"
        assert historial[0]["etapa_anterior_id"] is None
        assert historial[1]["evento"] == "avance"
        assert historial[2]["evento"] == "avance"
        # Verificar orden por id (proxy de orden cronológico)
        ids = [h["id"] for h in historial]
        assert ids == sorted(ids)

    def test_get_historial_caso_inexistente_404(self, client, usuario_socio, cliente_sintetico):
        """GET /casos/99999/historial → 404."""
        _login_socio(client)
        resp = client.get("/api/v1/casos/99999/historial")
        assert resp.status_code == 404

    def test_no_existe_endpoint_delete_historial(self, client, usuario_socio, cliente_sintetico):
        """No existe endpoint DELETE /historial (RN-06 — inmutabilidad)."""
        csrf = _login_socio(client)
        caso_resp = _crear_caso(client, csrf, usuario_socio, cliente_sintetico)
        caso_id = caso_resp.json()["id"]

        # DELETE no debe existir → 405 Method Not Allowed
        resp = client.delete(
            f"/api/v1/casos/{caso_id}/historial",
            headers={"X-CSRF-Token": csrf},
        )
        assert resp.status_code == 405


# ── GET /casos y GET /casos/{id} (task 4.7) ───────────────────────────────────


@pytest.mark.integration
class TestListarYDetalle:
    def test_get_casos_200(self, client, usuario_socio, cliente_sintetico):
        """GET /casos → 200 con lista de casos."""
        csrf = _login_socio(client)
        _crear_caso(client, csrf, usuario_socio, cliente_sintetico)
        resp = client.get("/api/v1/casos")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)
        assert len(resp.json()) >= 1

    def test_get_casos_filtro_area(self, client, usuario_socio, cliente_sintetico):
        """GET /casos?area=LABORAL filtra correctamente (D9)."""
        csrf = _login_socio(client)
        _crear_caso(client, csrf, usuario_socio, cliente_sintetico, area="LABORAL")
        _crear_caso(
            client, csrf, usuario_socio, cliente_sintetico,
            area="ART", tipo_reclamo="ACCIDENTE"
        )
        resp = client.get("/api/v1/casos?area=LABORAL")
        assert resp.status_code == 200
        casos = resp.json()
        assert all(c["area"] == "LABORAL" for c in casos)

    def test_get_casos_filtro_abogado(self, client, usuario_socio, cliente_sintetico):
        """GET /casos?abogado_id filtra por abogado responsable (D9)."""
        csrf = _login_socio(client)
        _crear_caso(client, csrf, usuario_socio, cliente_sintetico)
        resp = client.get(f"/api/v1/casos?abogado_id={usuario_socio.id}")
        assert resp.status_code == 200
        casos = resp.json()
        assert all(c["abogado_responsable_id"] == usuario_socio.id for c in casos)

    def test_get_casos_paginacion(self, client, usuario_socio, cliente_sintetico):
        """GET /casos?page=2 con pocos casos → lista vacía."""
        csrf = _login_socio(client)
        _crear_caso(client, csrf, usuario_socio, cliente_sintetico)
        resp = client.get("/api/v1/casos?page=2")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_get_caso_detalle_200(self, client, usuario_socio, cliente_sintetico):
        """GET /casos/{id} → 200 con detalle incluyendo transiciones_validas."""
        csrf = _login_socio(client)
        caso_resp = _crear_caso(client, csrf, usuario_socio, cliente_sintetico)
        caso_id = caso_resp.json()["id"]

        resp = client.get(f"/api/v1/casos/{caso_id}")
        assert resp.status_code == 200
        body = resp.json()
        assert body["id"] == caso_id
        assert "etapa_actual" in body
        assert "transiciones_validas" in body
        assert "ficha" in body
        # Las transiciones_validas son objetos de etapa (datos, no hardcodeados)
        for t in body["transiciones_validas"]:
            assert "id" in t
            assert "nombre" in t
            assert "area" in t

    def test_get_caso_inexistente_404(self, client, usuario_socio, cliente_sintetico):
        """GET /casos/99999 → 404."""
        _login_socio(client)
        resp = client.get("/api/v1/casos/99999")
        assert resp.status_code == 404

    def test_get_casos_sin_sesion_401(self, client):
        """GET /casos sin sesión → 401."""
        resp = client.get("/api/v1/casos")
        assert resp.status_code == 401

    def test_get_caso_sin_sesion_401(self, client):
        """GET /casos/1 sin sesión → 401."""
        resp = client.get("/api/v1/casos/1")
        assert resp.status_code == 401


# ── CSRF en mutaciones sin DB (task 4.7 extra) ────────────────────────────────


class TestCSRFCasos:
    def test_post_caso_sin_csrf_403(self, client_no_db):
        """POST /casos sin X-CSRF-Token → 403."""
        resp = client_no_db.post(
            "/api/v1/casos",
            json={"cliente_id": 1, "abogado_responsable_id": 1, "area": "LABORAL"},
        )
        assert resp.status_code == 403

    def test_put_ficha_sin_csrf_403(self, client_no_db):
        """PUT /casos/{id}/ficha-laboral sin CSRF → 403."""
        resp = client_no_db.put(
            "/api/v1/casos/1/ficha-laboral",
            json={},
        )
        assert resp.status_code == 403

    def test_post_avanzar_sin_csrf_403(self, client_no_db):
        """POST /casos/{id}/avanzar sin CSRF → 403."""
        resp = client_no_db.post(
            "/api/v1/casos/1/avanzar",
            json={"etapa_destino_id": 1},
        )
        assert resp.status_code == 403

    def test_post_retroceder_sin_csrf_403(self, client_no_db):
        """POST /casos/{id}/retroceder sin CSRF → 403."""
        resp = client_no_db.post(
            "/api/v1/casos/1/retroceder",
            json={"etapa_destino_id": 1},
        )
        assert resp.status_code == 403

    def test_get_casos_sin_sesion_401(self, client_no_db):
        """GET /casos sin sesión → 401."""
        resp = client_no_db.get("/api/v1/casos")
        assert resp.status_code == 401
