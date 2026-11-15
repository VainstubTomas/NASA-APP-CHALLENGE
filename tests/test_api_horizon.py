"""Tests del horizonte en vivo de la API (ADR-018): GET /horizon?lat&lon.

Sin red. Dos grupos:
- El cálculo del horizonte se reemplaza por uno falso (valores SINTÉTICOS) para probar formato,
  validaciones, cobertura del mapa y errores.
- Cálculo real (`lola_horizon.site_horizon`) sobre un recorte SINTÉTICO escrito en el directorio del
  caché: una loma al este del sitio tiene que levantar el horizonte hacia el este. Sirve para probar
  que la API usa el mismo cálculo que los sitios guardados y que no vuelve a descargar.
"""
import numpy as np
import pytest
import requests
from fastapi.testclient import TestClient

from data.api import main as api_main
from data.api import service
from precompute.terrain import horizon_profile as hp
from precompute.terrain import lola_dem
from precompute.terrain import lola_horizon as lh
from tests.helpers import _validator


class FakeSiteHorizon:
    """Hace de `lola_horizon.site_horizon`: anota los pedidos y devuelve un horizon.json sintético."""

    def __init__(self, raises=None):
        self.calls = []
        self.raises = raises

    def __call__(self, site, raw_dir):
        self.calls.append((site, raw_dir))
        if self.raises:
            raise self.raises
        elev = [round(2 + np.sin(np.radians(a)), 2) for a in range(360)]
        return lh.build_horizon_json(site["id"], elev)


def _client(site_horizon, dem_dir):
    api_main.app.dependency_overrides[api_main.get_site_horizon] = lambda: site_horizon
    api_main.app.dependency_overrides[api_main.get_dem_dir] = lambda: dem_dir
    return TestClient(api_main.app)


@pytest.fixture
def fake():
    return FakeSiteHorizon()


@pytest.fixture
def client(fake, tmp_path):
    yield _client(fake, tmp_path)
    api_main.app.dependency_overrides.clear()


def _get(client, **params):
    return client.get("/horizon", params={"lat": 0, "lon": 30, **params})


def _assert_schema(doc):
    errors = list(_validator("horizon.schema.json").iter_errors(doc))
    assert not errors, "; ".join(e.message[:120] for e in errors[:3])


# ------------------------------------------------------------------ formato y contrato

def test_response_meets_horizon_schema_and_carries_the_dem(client):
    resp = _get(client)
    assert resp.status_code == 200
    doc = resp.json()
    _assert_schema(doc)
    assert doc["site_id"] == "live-n0p0-e30p0"
    assert len(doc["elevation_deg"]) == 360
    assert doc["dem"] == {"name": lh.DEM_NAME, "pixel_m": lh.DEM_PIXEL_M}


def test_site_id_matches_the_ephemeris_endpoint(client, fake, tmp_path):
    doc = _get(client, lat=-23.4219, lon=-3.0128).json()
    assert doc["site_id"] == service.site_id(-23.4219, -3.0128) == "live-s23p4219-w3p0128"
    site, raw_dir = fake.calls[0]
    assert site == {"id": "live-s23p4219-w3p0128", "lat_deg": -23.4219, "lon_deg": -3.0128}
    assert raw_dir == tmp_path


@pytest.mark.parametrize("lat", [85.5, 89.9, 90])
def test_without_map_coverage_returns_the_flat_moon_without_dem(client, fake, lat):
    doc = _get(client, lat=lat).json()
    _assert_schema(doc)
    assert doc["elevation_deg"] == [0.0] * 360
    assert "dem" not in doc  # la web muestra "horizonte ideal, sin relieve"
    assert fake.calls == []  # no se baja nada


@pytest.mark.parametrize("lat", [85, 0, -75, -75.7, -89.5, -90])
def test_with_map_coverage_computes_the_relief(client, fake, lat):
    assert "dem" in _get(client, lat=lat).json()
    assert len(fake.calls) == 1


# ------------------------------------------------------------------ entradas inválidas

@pytest.mark.parametrize("params", [
    {"lat": 90.5}, {"lat": -91}, {"lat": "abc"}, {"lat": "nan"},
    {"lon": 180.5}, {"lon": -181}, {"lon": "abc"},
])
def test_rejects_out_of_range_or_invalid_input(client, fake, params):
    resp = _get(client, **params)
    assert resp.status_code == 422, resp.text
    assert fake.calls == []


@pytest.mark.parametrize("missing", ["lat", "lon"])
def test_rejects_missing_required_parameters(client, missing):
    q = {"lat": 0, "lon": 30}
    del q[missing]
    assert client.get("/horizon", params=q).status_code == 422


# ------------------------------------------------------------------ fallas de Moon Trek y del mapa

@pytest.mark.parametrize("exc,status,text", [
    (requests.ConnectionError("sin red"), 502, "Moon Trek"),
    (requests.Timeout("lento"), 504, "Moon Trek"),
    (RuntimeError("La respuesta no es TIFF"), 502, "relieve"),
    (ValueError("el sitio está fuera del recorte"), 502, "relieve"),
])
def test_moon_trek_or_map_failures_return_a_clear_error_and_no_data(tmp_path, exc, status, text):
    try:
        resp = _get(_client(FakeSiteHorizon(raises=exc), tmp_path))
    finally:
        api_main.app.dependency_overrides.clear()
    assert resp.status_code == status
    body = resp.json()
    assert text in body["detail"] and "elevation_deg" not in body


def test_unreadable_map_is_deleted_so_the_next_request_retries(tmp_path):
    bad = tmp_path / "dem_live-n0p0-e30p0.tif"
    bad.write_bytes(b"no es un tiff")
    try:
        resp = _get(_client(lh.site_horizon, tmp_path))
    finally:
        api_main.app.dependency_overrides.clear()
    assert resp.status_code == 502
    assert not bad.exists()


# ------------------------------------------------------------------ cálculo real sobre un recorte sintético

def _write_hill_dem(path, lat0, lon0, hill_east_m=3000.0, hill_height_m=500.0):
    """GeoTIFF lon/lat lunar del tamaño de site_bbox, plano salvo una loma a `hill_east_m` al este (SINTÉTICO)."""
    import rasterio
    from rasterio.transform import from_bounds

    xmin, ymin, xmax, ymax = lh.site_bbox(lon0, lat0)
    w, h = lola_dem.size_for_bbox((xmin, ymin, xmax, ymax))
    lon = np.linspace(xmin, xmax, w)
    lat = np.linspace(ymax, ymin, h)
    glon, glat = np.meshgrid(lon, lat)
    m_per_deg = np.pi * hp.MOON_RADIUS_M / 180
    dx = (glon - lon0) * m_per_deg * np.cos(np.radians(lat0)) - hill_east_m
    dy = (glat - lat0) * m_per_deg
    z = (hill_height_m * np.exp(-(dx ** 2 + dy ** 2) / (2 * 800.0 ** 2))).astype("float32")
    with rasterio.open(path, "w", driver="GTiff", width=w, height=h, count=1, dtype="float32",
                       crs=hp.MOON_GEOGRAPHIC, transform=from_bounds(xmin, ymin, xmax, ymax, w, h)) as dst:
        dst.write(z, 1)


def test_real_calculation_uses_the_cached_map_without_downloading(tmp_path, monkeypatch):
    def no_download(*args, **kwargs):
        raise AssertionError("no debería descargar: el recorte ya está en el caché")

    monkeypatch.setattr(lola_dem, "download", no_download)
    _write_hill_dem(tmp_path / "dem_live-n0p0-e30p0.tif", lat0=0.0, lon0=30.0)
    try:
        resp = _get(_client(lh.site_horizon, tmp_path))
    finally:
        api_main.app.dependency_overrides.clear()
    assert resp.status_code == 200, resp.text
    doc = resp.json()
    _assert_schema(doc)
    elev = doc["elevation_deg"]
    # Loma de 500 m a 3 km al este: unos 9° de horizonte hacia el este, plano hacia el oeste.
    assert elev[90] > 5
    assert abs(elev[270]) < 0.5
    assert doc["max_distance_km"] == 20 and doc["observer_height_m"] == 0


# ------------------------------------------------------------------ Swagger y CORS

def test_swagger_documents_the_horizon_endpoint(client):
    op = client.get("/openapi.json").json()["paths"]["/horizon"]["get"]
    params = {p["name"]: p for p in op["parameters"]}
    assert set(params) == {"lat", "lon"}
    assert all(p.get("description") for p in params.values())
    assert {"200", "422", "502", "504"} <= set(op["responses"])


def test_cors_allows_the_web_origin(client):
    ok = client.options("/horizon", headers={
        "Origin": "http://localhost:5173", "Access-Control-Request-Method": "GET"})
    assert ok.headers.get("access-control-allow-origin") == "http://localhost:5173"
