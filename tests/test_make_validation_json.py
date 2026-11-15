"""C3-06 (#39): data/public/validation.json sale de tests/reference/ y cumple el contrato."""
from pathlib import Path

from scripts.make_validation_json import TOLERANCE_DEG, build_validation
from tests.helpers import PUBLIC, ROOT, _assert_valid, _load
from tests.test_ephemeris_horizons import TOL_DEG

REF = ROOT / "tests" / "reference"


def test_tolerancia_igual_a_la_de_los_tests_de_horizons():
    assert TOLERANCE_DEG == TOL_DEG == 0.1


def test_cuenta_filas_de_referencia():
    doc = build_validation(REF / "horizons_reference.csv", REF / "raw")
    # 3 sitios x 2 cuerpos x 3 fechas x 24 horas
    assert len(doc["rows"]) == 432


def test_caso_conocido_apollo_12_sol_2026_11_14():
    doc = build_validation(REF / "horizons_reference.csv", REF / "raw")
    row = next(
        r for r in doc["rows"]
        if r["site_id"] == "apollo-12" and r["body"] == "sun" and r["time_utc"] == "2026-11-14T00:00:00Z"
    )
    assert row["azimuth_deg"] == 98.280788
    assert row["elevation_deg"] == -59.703498


def test_fuente_nombra_horizons_y_las_respuestas_guardadas():
    doc = build_validation(REF / "horizons_reference.csv", REF / "raw")
    assert "JPL Horizons" in doc["source"]
    assert "tests/reference/raw" in doc["source"]


def test_validation_json_de_public_cumple_el_esquema():
    _assert_valid("validation.schema.json", PUBLIC / "validation.json")
    assert _load(PUBLIC / "validation.json")["tolerance_deg"] == TOL_DEG
