"""Tests del cliente de Horizons (C0-04).

Dos grupos:
- Sin red: armado de la consulta, lectura de una respuesta real guardada en
  tests/fixtures/horizons/, errores, caché y partición del rango.
- Casos geométricos conocidos (marcador `network`): confirman las convenciones
  (azimut desde el norte en sentido horario, longitud este-positiva, tiempo UTC)
  sin valores de referencia inventados. La primera corrida consulta Horizons y
  guarda la respuesta en data/raw/horizons/; las siguientes leen del caché.
"""
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
import requests

from precompute.ephemeris import horizons_client as hc

FIXTURES = Path(__file__).resolve().parent / "fixtures" / "horizons"


def _fixture(name):
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


# ---------------------------------------------------------------- sin red

def test_build_params_matches_documented_query():
    p = hc.build_params(lat_deg=-89.5, lon_deg=30.0, body="earth",
                        start_utc="2026-11-14T00:00:00Z", stop_utc="2026-11-14T03:00:00Z")
    assert p == {
        "format": "json",
        "COMMAND": "'399'",
        "OBJ_DATA": "'NO'",
        "MAKE_EPHEM": "'YES'",
        "EPHEM_TYPE": "'OBSERVER'",
        "CENTER": "'coord@301'",
        "COORD_TYPE": "'GEODETIC'",
        "SITE_COORD": "'30.0,-89.5,0'",
        "START_TIME": "'2026-11-14 00:00'",
        "STOP_TIME": "'2026-11-14 03:00'",
        "STEP_SIZE": "'60 m'",
        "QUANTITIES": "'4'",
        "ANG_FORMAT": "'DEG'",
        "APPARENT": "'AIRLESS'",
        "CSV_FORMAT": "'YES'",
        "TIME_TYPE": "'UT'",
    }


def test_build_params_sun_is_body_10():
    p = hc.build_params(0, 0, "sun", "2026-11-14T00:00:00Z", "2026-11-14T01:00:00Z")
    assert p["COMMAND"] == "'10'"


@pytest.mark.parametrize("kwargs", [
    {"body": "mars"},
    {"lat_deg": -91},
    {"lon_deg": 181},
    {"start_utc": "2026-11-14 00:00"},          # sin formato ISO con Z
    {"stop_utc": "2026-11-13T00:00:00Z"},       # termina antes de empezar
    {"step_s": 90},                              # no es múltiplo de 60
])
def test_build_params_rejects_bad_input(kwargs):
    args = dict(lat_deg=0, lon_deg=0, body="sun",
                start_utc="2026-11-14T00:00:00Z", stop_utc="2026-11-14T03:00:00Z")
    args.update(kwargs)
    with pytest.raises(ValueError):
        hc.build_params(**args)


def test_parse_real_response():
    """Respuesta real de Horizons: Tierra vista desde 0°N 30°E, 2026-11-14 00:00 a 03:00 UTC."""
    raw = _fixture("earth_0N_30E_2026-11-14.json")["response"]
    out = hc.parse_result(raw["result"], expect_lat_deg=0.0, expect_lon_deg=30.0)
    assert out["time_utc"] == ["2026-11-14T00:00:00Z", "2026-11-14T01:00:00Z",
                               "2026-11-14T02:00:00Z", "2026-11-14T03:00:00Z"]
    assert out["azimuth_deg"] == [278.449072, 278.355245, 278.261075, 278.166571]
    assert out["elevation_deg"] == [58.366038, 58.314043, 58.261945, 58.209748]


def test_parse_rejects_site_mismatch():
    """Si Horizons interpretó otra longitud o latitud, el parser no debe seguir en silencio."""
    raw = _fixture("earth_0N_30E_2026-11-14.json")["response"]
    with pytest.raises(hc.HorizonsError):
        hc.parse_result(raw["result"], expect_lat_deg=0.0, expect_lon_deg=-30.0)


def test_parse_rejects_missing_table():
    with pytest.raises(hc.HorizonsError):
        hc.parse_result("sin tabla", expect_lat_deg=0, expect_lon_deg=0)


class _FakeResponse:
    def __init__(self, payload):
        self._payload = payload
        self.status_code = 200

    def raise_for_status(self):
        pass

    def json(self):
        return self._payload


class _FakeSession:
    def __init__(self, payload):
        self.payload = payload
        self.calls = 0

    def get(self, url, params=None, timeout=None):
        self.calls += 1
        return _FakeResponse(self.payload)


def test_fetch_uses_cache_on_second_call(tmp_path):
    fx = _fixture("earth_0N_30E_2026-11-14.json")
    session = _FakeSession(fx["response"])
    params = hc.build_params(0, 30, "earth", "2026-11-14T00:00:00Z", "2026-11-14T03:00:00Z")
    first = hc.fetch(params, cache_dir=tmp_path, session=session)
    second = hc.fetch(params, cache_dir=tmp_path, session=session)
    assert session.calls == 1
    assert first == second == fx["response"]["result"]
    cached = list(tmp_path.glob("*.json"))
    assert len(cached) == 1
    entry = json.loads(cached[0].read_text(encoding="utf-8"))
    assert entry["query"] == params
    assert entry["response"] == fx["response"]
    assert entry["downloaded_utc"].endswith("Z")


def test_fetch_raises_and_does_not_cache_errors(tmp_path):
    session = _FakeSession({"error": "Output length exceeded", "result": ""})
    params = hc.build_params(0, 0, "sun", "2026-11-14T00:00:00Z", "2026-11-14T03:00:00Z")
    with pytest.raises(hc.HorizonsError, match="Output length exceeded"):
        hc.fetch(params, cache_dir=tmp_path, session=session)
    assert not list(tmp_path.glob("*.json"))


def test_split_range_respects_row_limit():
    chunks = hc.split_range("2026-11-01T00:00:00Z", "2026-11-01T09:00:00Z", 3600, max_rows=4)
    assert chunks == [
        ("2026-11-01T00:00:00Z", "2026-11-01T03:00:00Z"),
        ("2026-11-01T04:00:00Z", "2026-11-01T07:00:00Z"),
        ("2026-11-01T08:00:00Z", "2026-11-01T09:00:00Z"),
    ]


def test_split_range_single_chunk_when_small():
    assert hc.split_range("2026-11-01T00:00:00Z", "2026-11-02T00:00:00Z", 3600) == [
        ("2026-11-01T00:00:00Z", "2026-11-02T00:00:00Z")]


# ------------------------------------------------- casos geométricos (red)

START, STOP = "2026-11-01T00:00:00Z", "2026-12-01T00:00:00Z"   # algo más de una lunación


def _get(lat, lon, body):
    try:
        return hc.get_az_el(lat, lon, body, START, STOP)
    except requests.ConnectionError:
        pytest.skip("Sin conexión a Horizons y sin caché local")


@pytest.mark.network
def test_time_axis_is_utc_hourly_from_start():
    out = _get(0.0, 0.0, "earth")
    t0 = datetime(2026, 11, 1, tzinfo=timezone.utc)
    expected = [(t0 + timedelta(hours=i)).strftime("%Y-%m-%dT%H:%M:%SZ") for i in range(30 * 24 + 1)]
    assert out["time_utc"] == expected


@pytest.mark.network
def test_earth_near_zenith_at_sub_earth_point():
    """Desde 0°N 0°E la Tierra está cerca del cenit; la libración la mueve menos de ~10°."""
    out = _get(0.0, 0.0, "earth")
    assert min(out["elevation_deg"]) > 80


@pytest.mark.network
def test_earth_to_the_west_from_30_east():
    """Desde 0°N 30°E la Tierra queda unos 30° hacia el oeste del cenit.

    Si la longitud no fuera este-positiva o el azimut no creciera en sentido horario,
    la Tierra aparecería al este (azimut cerca de 90°).
    """
    out = _get(0.0, 30.0, "earth")
    assert all(225 < az < 315 for az in out["azimuth_deg"])
    assert all(50 < el < 70 for el in out["elevation_deg"])


@pytest.mark.network
def test_earth_never_visible_from_far_side():
    out = _get(0.0, 180.0, "earth")
    assert max(out["elevation_deg"]) < 0


@pytest.mark.network
def test_sun_hugs_horizon_near_south_pole():
    """A 89,5°S el Sol no se aleja del horizonte más que la inclinación del eje (~1,5°) más 0,5°."""
    out = _get(-89.5, 0.0, "sun")
    assert max(abs(e) for e in out["elevation_deg"]) < 2.5


@pytest.mark.network
def test_sun_rises_east_and_sets_west_at_equator():
    """En el ecuador lunar el Sol sale por el este (~90°) y se pone por el oeste (~270°)."""
    out = _get(0.0, 0.0, "sun")
    el, az = out["elevation_deg"], out["azimuth_deg"]
    rises = [az[i] for i in range(1, len(el)) if el[i - 1] < 0 <= el[i]]
    sets = [az[i] for i in range(1, len(el)) if el[i - 1] >= 0 > el[i]]
    assert rises and sets
    assert all(abs(a - 90) < 5 for a in rises)
    assert all(abs(a - 270) < 5 for a in sets)
