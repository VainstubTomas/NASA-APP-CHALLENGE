"""Horizonte plano (Luna lisa, ADR-011) de todos los sitios (issue C2-01).

El contrato de horizon.json se valida en tests/test_contract.py; acá se prueba el generador
y que cada sitio real del repo ya tiene su archivo.
"""
import json
from pathlib import Path

import pytest

from precompute.terrain import flat_horizon as fh
from tests.helpers import PUBLIC, _assert_valid


def _sitio(id_, synthetic=False):
    return {"id": id_, "name": id_, "lat_deg": 0.0, "lon_deg": 0.0,
            "source": "test", "source_url": "https://example.org", "synthetic": synthetic}


def test_build_flat_horizon_son_360_ceros_sin_dem():
    h = fh.build_flat_horizon("apollo-11")
    assert h["site_id"] == "apollo-11"
    assert h["schema_version"] == "1.0"
    assert h["azimuth_start_deg"] == 0 and h["azimuth_step_deg"] == 1
    assert h["elevation_deg"] == [0] * 360
    assert "dem" not in h


def test_write_all_escribe_un_archivo_por_sitio(tmp_path):
    escritos = fh.write_all([_sitio("a"), _sitio("b")], tmp_path)
    assert sorted(p.parent.name for p in escritos) == ["a", "b"]
    for p in escritos:
        assert p == tmp_path / p.parent.name / "horizon.json"
        assert json.loads(p.read_text(encoding="utf-8"))["site_id"] == p.parent.name


def test_write_all_crea_la_carpeta_del_sitio_si_falta(tmp_path):
    fh.write_all([_sitio("nuevo")], tmp_path)
    assert (tmp_path / "nuevo" / "horizon.json").exists()


def test_write_all_es_idempotente(tmp_path):
    fh.write_all([_sitio("a")], tmp_path)
    antes = (tmp_path / "a" / "horizon.json").read_bytes()
    fh.write_all([_sitio("a")], tmp_path)
    assert (tmp_path / "a" / "horizon.json").read_bytes() == antes


def test_write_all_omite_el_sintetico_por_defecto(tmp_path):
    fh.write_all([_sitio("demo", synthetic=True), _sitio("a")], tmp_path)
    assert not (tmp_path / "demo").exists()
    assert (tmp_path / "a" / "horizon.json").exists()


def test_write_all_puede_incluir_el_sintetico(tmp_path):
    fh.write_all([_sitio("demo", synthetic=True)], tmp_path, include_synthetic=True)
    assert (tmp_path / "demo" / "horizon.json").exists()


def test_el_archivo_generado_cumple_el_contrato(tmp_path):
    (p,) = fh.write_all([_sitio("apollo-11")], tmp_path)
    _assert_valid("horizon.schema.json", p)


REALES = [s["id"] for s in json.loads((PUBLIC / "sites.json").read_text(encoding="utf-8"))["sites"]
          if not s.get("synthetic")]


@pytest.mark.parametrize("site_id", REALES)
def test_cada_sitio_real_tiene_horizonte_plano(site_id):
    path = PUBLIC / "sites" / site_id / "horizon.json"
    assert path.exists(), f"falta {path}: correr python -m precompute.terrain.flat_horizon"
    _assert_valid("horizon.schema.json", path)
    doc = json.loads(path.read_text(encoding="utf-8"))
    assert doc["elevation_deg"] == [0] * 360
    assert "dem" not in doc
