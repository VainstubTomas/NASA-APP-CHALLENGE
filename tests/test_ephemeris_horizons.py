"""Tests de regresión contra respuestas guardadas de JPL Horizons (C0-05, ADR-005/ADR-006).

Todo corre sin red: lee tests/reference/raw/ (respuestas crudas con su consulta exacta)
y tests/reference/horizons_reference.csv (valores derivados). Para regenerarlos:
scripts/make_horizons_reference.py (requiere red).

Qué cubre:
- El parser del cliente sobre cada respuesta cruda reproduce el CSV (detecta cambios de convención).
- La referencia tiene la grilla completa, en UTC y de 1 h (detecta corrimientos de tiempo).
- La comparación de ephemeris.json contra la referencia falla ante azimut espejado,
  azimut rotado y corrimiento de una muestra (las tres roturas que el issue pide detectar).
"""
import csv
import json
from datetime import timedelta
from pathlib import Path

import pytest

from precompute.ephemeris import horizons_client as hc

ROOT = Path(__file__).resolve().parent.parent
REF_DIR = ROOT / "tests" / "reference"
RAW_DIR = REF_DIR / "raw"
CSV_PATH = REF_DIR / "horizons_reference.csv"
PUBLIC_SITES = ROOT / "data" / "public" / "sites"

TOL_DEG = 0.1  # tolerancia inicial de ADR-005
BODY_NAMES = {"sun": "10", "earth": "399"}


# ---------------------------------------------------------------- carga

def _ref_rows():
    with CSV_PATH.open(newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    for r in rows:
        r["lat_deg"] = float(r["lat_deg"])
        r["lon_deg"] = float(r["lon_deg"])
        r["azimuth_deg"] = float(r["azimuth_deg"])
        r["elevation_deg"] = float(r["elevation_deg"])
    return rows


def _raw_entries():
    out = []
    for p in sorted(RAW_DIR.glob("*.json")):
        entry = json.loads(p.read_text(encoding="utf-8"))
        q = entry["query"]
        lon, lat, _alt = (float(x) for x in q["SITE_COORD"].strip("'").split(","))
        body = next(k for k, v in BODY_NAMES.items() if v == q["COMMAND"].strip("'"))
        out.append({"path": p, "query": q, "lat": lat, "lon": lon, "body": body,
                    "result": entry["response"]["result"]})
    return out


def _ref_series(site_id, body, day=None):
    rows = [r for r in _ref_rows()
            if r["site_id"] == site_id and r["body"] == body
            and (day is None or r["time_utc"].startswith(day))]
    rows.sort(key=lambda r: r["time_utc"])
    return rows


def _sites_and_days():
    rows = _ref_rows()
    sites = sorted({r["site_id"] for r in rows})
    days = sorted({r["time_utc"][:10] for r in rows})
    return sites, days


# ---------------------------------------------------------------- comparación

def _angle_diff(a, b):
    return abs(((a - b + 180.0) % 360.0) - 180.0)


def compare_ephemeris(eph, ref_rows, tol=TOL_DEG):
    """Compara una serie tipo ephemeris.json contra filas de referencia.

    Devuelve la lista de discrepancias (vacía = coincide). Solo compara las muestras de la
    referencia que caen dentro de la serie; si ninguna cae, es un error.
    """
    t0 = _parse(eph["time"]["start_utc"])
    step, count = eph["time"]["step_s"], eph["time"]["count"]
    errors, compared = [], 0
    for r in ref_rows:
        d = (_parse(r["time_utc"]) - t0).total_seconds()
        if d < 0 or d % step or d // step >= count:
            continue
        i = int(d // step)
        compared += 1
        block = eph[r["body"]]
        daz = _angle_diff(block["azimuth_deg"][i], r["azimuth_deg"])
        del_ = abs(block["elevation_deg"][i] - r["elevation_deg"])
        if daz > tol or del_ > tol:
            errors.append(f"{r['body']} {r['time_utc']}: Δaz={daz:.3f}° Δel={del_:.3f}°")
    if compared == 0:
        errors.append("ninguna muestra de la referencia cae dentro de la serie")
    return errors


def _parse(iso):
    return hc._parse_iso(iso)


def _eph_from_reference(site_id, day, az_fn=lambda a: a, shift=0):
    """Serie de un día construida desde la referencia, con una rotura opcional.

    az_fn transforma el azimut; shift desplaza los valores `shift` muestras (corrimiento de tiempo).
    """
    eph = {"time": {"start_utc": f"{day}T00:00:00Z", "step_s": 3600, "count": 24}}
    for body in BODY_NAMES:
        rows = _ref_series(site_id, body, day)
        az = [az_fn(r["azimuth_deg"]) for r in rows]
        el = [r["elevation_deg"] for r in rows]
        n = len(az)
        az = [az[min(i + shift, n - 1)] for i in range(n)]
        el = [el[min(i + shift, n - 1)] for i in range(n)]
        eph[body] = {"azimuth_deg": az, "elevation_deg": el}
    return eph


# ---------------------------------------------------------------- tests

def test_reference_files_exist():
    assert CSV_PATH.exists(), "falta horizons_reference.csv: correr scripts/make_horizons_reference.py"
    assert len(_raw_entries()) > 0


def test_raw_query_is_the_documented_one():
    """Cada respuesta cruda guarda la consulta exacta; el cuerpo y el sitio salen de ella."""
    for e in _raw_entries():
        q = e["query"]
        assert q["MAKE_EPHEM"] == "'YES'"
        assert q["CENTER"] == "'coord@301'"  # centro en la Luna
        assert q["COORD_TYPE"] == "'GEODETIC'"
        assert q["TIME_TYPE"] == "'UT'"       # tiempo UTC
        assert q["ANG_FORMAT"] == "'DEG'"
        assert q["STEP_SIZE"] == "'60 m'"     # paso de 1 h
        assert q["APPARENT"] == "'AIRLESS'"   # sin atmósfera, como la Luna


@pytest.mark.parametrize("entry", _raw_entries(), ids=lambda e: e["path"].name)
def test_client_parser_reproduces_reference_csv(entry):
    """Si cambia la convención del parser (azimut, tiempo, sitio), esto falla."""
    out = hc.parse_result(entry["result"], expect_lat_deg=entry["lat"], expect_lon_deg=entry["lon"])
    wanted = set(out["time_utc"])
    ref = [r for r in _ref_rows()
           if r["lat_deg"] == entry["lat"] and r["lon_deg"] == entry["lon"] and r["body"] == entry["body"]
           and r["time_utc"] in wanted]
    ref.sort(key=lambda r: r["time_utc"])
    assert len(ref) == len(wanted)
    assert out["time_utc"] == [r["time_utc"] for r in ref]
    for got_az, got_el, r in zip(out["azimuth_deg"], out["elevation_deg"], ref):
        assert got_az == pytest.approx(r["azimuth_deg"], abs=1e-6)
        assert got_el == pytest.approx(r["elevation_deg"], abs=1e-6)


def test_reference_grid_is_complete_utc_hourly():
    """3 sitios × 3 fechas × 2 cuerpos × 24 horas, en UTC, desde 00:00 y paso de 1 h."""
    sites, days = _sites_and_days()
    assert len(sites) == 3 and len(days) == 3
    for site in sites:
        for body in BODY_NAMES:
            for day in days:
                rows = _ref_series(site, body, day)
                assert len(rows) == 24, (site, body, day)
                start = _parse(f"{day}T00:00:00Z")
                expected = [(start + timedelta(hours=h)).strftime("%Y-%m-%dT%H:%M:%SZ") for h in range(24)]
                assert [r["time_utc"] for r in rows] == expected


def test_reference_values_are_in_contract_ranges():
    for r in _ref_rows():
        assert 0.0 <= r["azimuth_deg"] < 360.0
        assert -90.0 <= r["elevation_deg"] <= 90.0


def test_reference_passes_against_itself():
    sites, days = _sites_and_days()
    for site in sites:
        for day in days:
            eph = _eph_from_reference(site, day)
            rows = [r for r in _ref_rows() if r["site_id"] == site and r["time_utc"].startswith(day)]
            assert compare_ephemeris(eph, rows) == []


def test_mirrored_azimuth_convention_is_detected():
    """Azimut contado en sentido antihorario o desde el sur: debe fallar."""
    site, day = _sites_and_days()[0][0], _sites_and_days()[1][0]
    rows = [r for r in _ref_rows() if r["site_id"] == site and r["time_utc"].startswith(day)]
    eph = _eph_from_reference(site, day, az_fn=lambda a: (360.0 - a) % 360.0)
    assert compare_ephemeris(eph, rows) != []


def test_rotated_azimuth_is_detected():
    """Origen del azimut corrido 90° (p. ej. desde el este): debe fallar."""
    site, day = _sites_and_days()[0][0], _sites_and_days()[1][0]
    rows = [r for r in _ref_rows() if r["site_id"] == site and r["time_utc"].startswith(day)]
    eph = _eph_from_reference(site, day, az_fn=lambda a: (a + 90.0) % 360.0)
    assert compare_ephemeris(eph, rows) != []


def test_one_hour_time_shift_is_detected():
    """Corrimiento de una muestra (1 h) en la serie: el Sol se mueve ~0,5°/h en elevación, debe fallar.

    La Tierra se mueve mucho más lento (~0,1°/h), así que una sola hora no siempre la separa
    de la tolerancia; por eso la prueba usa el Sol.
    """
    site, day = _sites_and_days()[0][0], _sites_and_days()[1][0]
    rows = [r for r in _ref_rows() if r["site_id"] == site and r["time_utc"].startswith(day)]
    eph = _eph_from_reference(site, day, shift=1)
    assert compare_ephemeris(eph, rows) != []


def test_ephemeris_comparison_requires_overlap():
    site, day = _sites_and_days()[0][0], _sites_and_days()[1][0]
    rows = [r for r in _ref_rows() if r["site_id"] == site and r["time_utc"].startswith(day)]
    eph = _eph_from_reference(site, "2000-01-01")  # otro día: sin solape
    assert compare_ephemeris(eph, rows) != []


def test_real_ephemeris_files_match_reference():
    """Compara los ephemeris.json reales contra la referencia de su sitio.

    Hoy ningún sitio real tiene ephemeris.json ni está en la referencia; el test se activa solo.
    """
    sites, _ = _sites_and_days()
    checked = []
    for p in sorted(PUBLIC_SITES.glob("*/ephemeris.json")):
        eph = json.loads(p.read_text(encoding="utf-8"))
        if eph.get("site_id") not in sites:
            continue
        rows = [r for r in _ref_rows() if r["site_id"] == eph["site_id"]]
        assert compare_ephemeris(eph, rows) == [], p
        checked.append(p)
    if not checked:
        pytest.skip("ningún ephemeris.json de data/public/sites/ corresponde a un sitio con referencia (C0-13)")
