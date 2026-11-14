"""Tests de precompute/ephemeris/build_ephemeris.py (issue C1-01).

Corren sin red: usan las respuestas crudas de la referencia C0-05 (tests/reference/raw/) como
caché, que son exactamente las consultas que arma el cliente para un día de 1 h de paso.
"""
import csv
import json
from pathlib import Path

import pytest

from precompute.ephemeris import build_ephemeris as be
from precompute.ephemeris import horizons_client as hc
from tests.helpers import _validator
from tests.test_ephemeris_horizons import compare_ephemeris

ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = ROOT / "tests" / "reference" / "raw"
CSV_PATH = ROOT / "tests" / "reference" / "horizons_reference.csv"

# Apolo 15 tal como figura en data/public/sites.json y en la referencia C0-05.
APOLLO_15 = {"id": "apollo-15", "name": "Apolo 15", "lat_deg": 26.13239, "lon_deg": 3.6333}
DAY_START, DAY_STOP = "2026-11-14T00:00:00Z", "2026-11-14T23:00:00Z"


def _reference_rows(site_id, day):
    with CSV_PATH.open(newline="", encoding="utf-8") as f:
        rows = [r for r in csv.DictReader(f) if r["site_id"] == site_id and r["time_utc"].startswith(day)]
    for r in rows:
        r["azimuth_deg"] = float(r["azimuth_deg"])
        r["elevation_deg"] = float(r["elevation_deg"])
    return rows


def test_un_dia_de_apolo_15_coincide_con_la_referencia_de_horizons():
    """Caso conocido: el ephemeris.json armado desde el caché coincide con la referencia C0-05."""
    doc = be.build_site_ephemeris(APOLLO_15, DAY_START, DAY_STOP, 3600, cache_dir=RAW_DIR)

    assert doc["site_id"] == "apollo-15"
    assert doc["time"] == {"start_utc": DAY_START, "step_s": 3600, "count": 24}
    rows = _reference_rows("apollo-15", "2026-11-14")
    assert len(rows) == 48  # 24 h x Sol y Tierra
    assert compare_ephemeris(doc, rows) == []
    # Más estricto que la tolerancia de ADR-005: solo difiere por redondear a 3 decimales.
    for r in rows:
        i = int(r["time_utc"][11:13])
        assert doc[r["body"]]["azimuth_deg"][i] == pytest.approx(r["azimuth_deg"], abs=5e-4)
        assert doc[r["body"]]["elevation_deg"][i] == pytest.approx(r["elevation_deg"], abs=5e-4)


def test_cumple_el_esquema_del_contrato():
    doc = be.build_site_ephemeris(APOLLO_15, DAY_START, DAY_STOP, 3600, cache_dir=RAW_DIR)
    errors = list(_validator("ephemeris.schema.json").iter_errors(doc))
    assert errors == [], [e.message for e in errors[:3]]
    assert doc["angular_radius_deg"] == {"sun": 0.25, "earth": 1.0}  # nominales del contrato v1
    assert "JPL Horizons" in doc["source"]


def test_sin_cache_falla_con_un_mensaje_claro_y_sin_usar_la_red(tmp_path):
    """Corre sin conexión: si falta un dato en el caché, avisa en vez de consultar Horizons."""
    with pytest.raises(be.MissingCacheError, match="download_horizons"):
        be.build_site_ephemeris(APOLLO_15, DAY_START, DAY_STOP, 3600, cache_dir=tmp_path)
    assert list(tmp_path.iterdir()) == []  # no se descargó ni escribió nada


def test_azimut_redondeado_queda_en_0_360():
    """359,9996° redondeado a 3 decimales daría 360,0, fuera del rango [0, 360) del contrato."""
    assert be.round_azimuth(359.9996) == 0.0
    assert be.round_azimuth(12.34567) == 12.346
    assert be.round_elevation(-0.00049) == 0.0
    assert be.round_elevation(1.23456) == 1.235


def test_escribe_un_archivo_por_sitio_y_omite_el_sintetico(tmp_path):
    sitios = [APOLLO_15, {"id": "demo-sintetico", "lat_deg": -89.5, "lon_deg": 0.0, "synthetic": True}]
    informe = be.build_all(sitios, DAY_START, DAY_STOP, 3600, cache_dir=RAW_DIR, out_dir=tmp_path)

    assert informe == {"written": ["apollo-15"], "skipped_synthetic": ["demo-sintetico"]}
    path = tmp_path / "apollo-15" / "ephemeris.json"
    doc = json.loads(path.read_text(encoding="utf-8"))
    assert doc["time"]["count"] == 24
    assert not (tmp_path / "demo-sintetico").exists()


def test_el_rango_por_defecto_es_el_de_la_descarga_de_c0_13():
    """Mismo rango que download_horizons: si no coinciden, el caché no tendría los datos."""
    from precompute.ephemeris import download_horizons as dh
    assert (be.DEFAULT_START, be.DEFAULT_STOP, be.DEFAULT_STEP_S) == (dh.DEFAULT_START, dh.DEFAULT_STOP, dh.DEFAULT_STEP_S)
    assert hc.split_range(be.DEFAULT_START, be.DEFAULT_STOP, be.DEFAULT_STEP_S)  # rango válido
