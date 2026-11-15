"""Tests de la API de efemérides en vivo (issue #104, ADR-015).

Dos grupos:
- Sin red: Horizons se reemplaza por una sesión falsa que responde con el formato real de la tabla
  (valores SINTÉTICOS, solo sirven para probar formato, validaciones, errores y caché; no son efemérides).
- Caso conocido (marcador `network`): lat 0, lon 30 E, 2026-11-30T06:00:00Z contra la respuesta
  guardada de la interfaz web de Horizons (docs/adr/evidencia/ADR-006-horizons-web/). La primera
  corrida consulta Horizons y guarda en data/raw/horizons/; las siguientes leen del caché.
"""
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
import requests
from fastapi.testclient import TestClient

from data.api import main as api_main
from tests.helpers import _validator

ROOT = Path(__file__).resolve().parent.parent
EVIDENCE_SUN_0N_30E = ROOT / "docs" / "adr" / "evidencia" / "ADR-006-horizons-web" / "sol_0N_30E_web.txt"
TOL_DEG = 0.1  # ADR-005

_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


# ------------------------------------------------------- Horizons falso (valores sintéticos)

class _Resp:
    def __init__(self, payload):
        self._payload = payload

    def raise_for_status(self):
        pass

    def json(self):
        return self._payload


class FakeHorizons:
    """Responde como Horizons: respeta el sitio, el rango y el paso pedidos. Azimut y elevación sintéticos."""

    def __init__(self, error=None, site_override=None, raises=None):
        self.calls = []
        self.error = error
        self.site_override = site_override
        self.raises = raises

    def get(self, url, params=None, timeout=None):
        self.calls.append(params)
        if self.raises:
            raise self.raises
        if self.error:
            return _Resp({"error": self.error, "result": ""})
        lon, lat, _ = (float(x) for x in params["SITE_COORD"].strip("'").split(","))
        if self.site_override:
            lon, lat = self.site_override
        start = datetime.strptime(params["START_TIME"].strip("'"), "%Y-%m-%d %H:%M")
        stop = datetime.strptime(params["STOP_TIME"].strip("'"), "%Y-%m-%d %H:%M")
        step = timedelta(minutes=int(params["STEP_SIZE"].strip("'").split()[0]))
        rows, t, i = [], start, 0
        while t <= stop:
            stamp = f"{t.year}-{_MONTHS[t.month - 1]}-{t.day:02d} {t.hour:02d}:{t.minute:02d}"
            rows.append(f" {stamp}, ,i, {(100 + i * 0.5) % 360:.6f},    {30 - i * 0.25:.6f},")
            t, i = t + step, i + 1
        result = (
            f"Center geodetic : {lon}, {lat}, 0.0                  {{E-lon(deg),Lat(deg),Alt(km)}}\n"
            " Date__(UT)__HR:MN, , ,Azi_(a-app), Elev_(a-app),\n$$SOE\n" + "\n".join(rows) + "\n$$EOE\n"
        )
        return _Resp({"signature": {"version": "fake"}, "result": result})


@pytest.fixture
def fake():
    return FakeHorizons()


@pytest.fixture
def client(fake, tmp_path):
    api_main.app.dependency_overrides[api_main.get_session] = lambda: fake
    api_main.app.dependency_overrides[api_main.get_cache_dir] = lambda: tmp_path
    yield TestClient(api_main.app)
    api_main.app.dependency_overrides.clear()


def _ok(client, **params):
    q = {"lat": 0, "lon": 30, "start": "2026-11-30T06:00:00Z", "days": 1, **params}
    return client.get("/ephemeris", params=q)


# ------------------------------------------------------------------ formato y contrato

def test_response_meets_ephemeris_schema(client):
    resp = _ok(client, days=3)
    assert resp.status_code == 200
    errors = list(_validator("ephemeris.schema.json").iter_errors(resp.json()))
    assert not errors, "; ".join(e.message[:120] for e in errors[:3])


def test_response_shape_matches_requested_window(client):
    doc = _ok(client, days=2).json()
    assert doc["schema_version"] == "1.0"
    assert doc["time"] == {"start_utc": "2026-11-30T06:00:00Z", "step_s": 3600, "count": 48}
    for body in ("sun", "earth"):
        assert len(doc[body]["azimuth_deg"]) == len(doc[body]["elevation_deg"]) == 48
        assert all(0 <= a < 360 for a in doc[body]["azimuth_deg"])
    assert doc["angular_radius_deg"] == {"sun": 0.25, "earth": 1.0}
    assert "JPL Horizons" in doc["source"]


@pytest.mark.parametrize("lat,lon,expected", [
    (0, 30, "live-n0p0-e30p0"),
    (-89.5, 0, "live-s89p5-e0p0"),
    (-23.4219, -3.0128, "live-s23p4219-w3p0128"),
])
def test_site_id_encodes_position_and_matches_schema_pattern(client, lat, lon, expected):
    doc = _ok(client, lat=lat, lon=lon).json()
    assert doc["site_id"] == expected
    assert re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)*", doc["site_id"])


def test_queries_horizons_for_sun_and_earth_with_validated_parameters(client, fake):
    _ok(client)
    assert [c["COMMAND"] for c in fake.calls] == ["'10'", "'399'"]
    q = fake.calls[0]
    assert q["CENTER"] == "'coord@301'" and q["COORD_TYPE"] == "'GEODETIC'"
    assert q["SITE_COORD"] == "'30.0,0.0,0'"  # E-lon,lat,alt
    assert q["QUANTITIES"] == "'4'" and q["APPARENT"] == "'AIRLESS'" and q["STEP_SIZE"] == "'60 m'"


def test_repeated_request_is_served_from_cache(client, fake):
    _ok(client)
    calls = len(fake.calls)
    again = _ok(client)
    assert again.status_code == 200 and len(fake.calls) == calls


def test_window_is_trimmed_at_the_end_of_the_data_range(client):
    doc = _ok(client, start="2027-02-28T00:00:00Z", days=7).json()
    assert doc["time"]["count"] == 24  # hasta 2027-02-28T23:00:00Z, el fin del rango del contrato


# ------------------------------------------------------------------ entradas inválidas

@pytest.mark.parametrize("params", [
    {"lat": 90.5}, {"lat": -91}, {"lat": "abc"}, {"lat": "nan"},
    {"lon": 180.5}, {"lon": -181}, {"lon": "abc"},
    {"start": "no-es-fecha"}, {"start": "2026-13-45T00:00:00Z"}, {"start": "2026-11-30"},
    {"start": "2026-11-30T06:00:00+02:00"},
    {"start": "2026-10-31T23:00:00Z"}, {"start": "2027-03-01T00:00:00Z"},
    {"days": 0}, {"days": 15}, {"days": "x"},
])
def test_rejects_out_of_range_or_invalid_input(client, fake, params):
    resp = _ok(client, **params)
    assert resp.status_code == 422, resp.text
    assert resp.json()["detail"]
    assert fake.calls == []  # no se consulta a Horizons con entradas inválidas


@pytest.mark.parametrize("missing", ["lat", "lon", "start"])
def test_rejects_missing_required_parameters(client, missing):
    q = {"lat": 0, "lon": 30, "start": "2026-11-30T06:00:00Z"}
    del q[missing]
    assert client.get("/ephemeris", params=q).status_code == 422


def test_accepts_the_limits_of_the_valid_range(client):
    for lat, lon in [(-90, -180), (90, 180), (0, 0)]:
        assert _ok(client, lat=lat, lon=lon).status_code == 200


# ------------------------------------------------------------------ fallas de Horizons

def test_horizons_error_returns_clear_error_and_no_data(tmp_path):
    fake = FakeHorizons(error="Cannot interpret date. Please check for typos.")
    api_main.app.dependency_overrides[api_main.get_session] = lambda: fake
    api_main.app.dependency_overrides[api_main.get_cache_dir] = lambda: tmp_path
    try:
        resp = _ok(TestClient(api_main.app))
    finally:
        api_main.app.dependency_overrides.clear()
    assert resp.status_code == 502
    body = resp.json()
    assert "Horizons" in body["detail"] and "sun" not in body and "time" not in body


@pytest.mark.parametrize("exc,status", [
    (requests.ConnectionError("sin red"), 502),
    (requests.Timeout("lento"), 504),
])
def test_horizons_unreachable_returns_502_or_504(tmp_path, exc, status):
    fake = FakeHorizons(raises=exc)
    api_main.app.dependency_overrides[api_main.get_session] = lambda: fake
    api_main.app.dependency_overrides[api_main.get_cache_dir] = lambda: tmp_path
    try:
        resp = _ok(TestClient(api_main.app))
    finally:
        api_main.app.dependency_overrides.clear()
    assert resp.status_code == status
    assert "Horizons" in resp.json()["detail"]


def test_horizons_answering_for_another_site_is_refused(tmp_path):
    fake = FakeHorizons(site_override=(10.0, 10.0))
    api_main.app.dependency_overrides[api_main.get_session] = lambda: fake
    api_main.app.dependency_overrides[api_main.get_cache_dir] = lambda: tmp_path
    try:
        resp = _ok(TestClient(api_main.app))
    finally:
        api_main.app.dependency_overrides.clear()
    assert resp.status_code == 502


# ------------------------------------------------------------------ Swagger y CORS

def test_swagger_ui_and_openapi_document_the_endpoint(client):
    assert client.get("/docs").status_code == 200
    spec = client.get("/openapi.json").json()
    op = spec["paths"]["/ephemeris"]["get"]
    params = {p["name"]: p for p in op["parameters"]}
    assert set(params) == {"lat", "lon", "start", "days"}
    assert all(p.get("description") for p in params.values())
    assert {"200", "422", "502", "504"} <= set(op["responses"])


def test_cors_allows_the_web_origin_and_not_others(client):
    ok = client.options("/ephemeris", headers={
        "Origin": "http://localhost:5173", "Access-Control-Request-Method": "GET"})
    assert ok.headers.get("access-control-allow-origin") == "http://localhost:5173"
    bad = client.options("/ephemeris", headers={
        "Origin": "https://sitio-ajeno.example", "Access-Control-Request-Method": "GET"})
    assert "access-control-allow-origin" not in bad.headers


# ------------------------------------------------------------------ caso conocido (red)

def _evidence_row(day_time="2026-Nov-30 06:00"):
    for line in EVIDENCE_SUN_0N_30E.read_text(encoding="utf-8").splitlines():
        if line.strip().startswith(day_time):
            fields = line.split()
            return float(fields[-2]), float(fields[-1])
    raise AssertionError(f"No está {day_time} en la evidencia")


@pytest.mark.network
def test_known_case_sun_matches_saved_horizons_response():
    """lat 0, lon 30 E, 2026-11-30T06:00:00Z: el Sol de la API coincide con la respuesta guardada (ADR-006)."""
    api_main.app.dependency_overrides.clear()
    try:
        resp = TestClient(api_main.app).get(
            "/ephemeris", params={"lat": 0, "lon": 30, "start": "2026-11-30T06:00:00Z", "days": 1})
    except (requests.ConnectionError, requests.Timeout):
        pytest.skip("Horizons no responde y no hay caché local")
    if resp.status_code in (502, 504):
        pytest.skip(f"Horizons no responde: {resp.json()['detail']}")
    assert resp.status_code == 200, resp.text
    doc = resp.json()
    az_ref, el_ref = _evidence_row()
    assert (az_ref, el_ref) == (268.497923, -10.816083)  # lo documentado en el ADR-006
    assert abs((doc["sun"]["azimuth_deg"][0] - az_ref + 180) % 360 - 180) < TOL_DEG
    assert abs(doc["sun"]["elevation_deg"][0] - el_ref) < TOL_DEG


def test_site_id_never_uses_scientific_notation():
    from data.api.service import site_id
    assert site_id(0.00001, -0.00001) == "live-n0p00001-w0p00001"
