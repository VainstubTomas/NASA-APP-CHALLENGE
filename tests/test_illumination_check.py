"""Tests de precompute/terrain/illumination_check.py (issue C5-07, #51).

El porcentaje de tiempo con Sol sale de metrics.json (C3-01): horas con Sol sobre horas totales del
período. Se usa para comparar a grandes rasgos con la iluminación media de LOLA en Quickmap.
"""
import json

import pytest

from precompute.terrain import illumination_check as ic
from tests.helpers import PUBLIC


def _metrics(sun, earth, step_s=86400):
    n = len(sun)
    return {
        "time": {"start_utc": "2026-11-01T00:00:00Z", "step_s": step_s, "count": n},
        "daily": {"sun_hours": sun, "earth_hours": earth, "both_hours": [min(s, e) for s, e in zip(sun, earth)]},
    }


def test_caso_a_mano_cuatro_dias():
    # Sol 24 + 0 + 12 + 12 = 48 h de 96 h = 50 %. Tierra 24 + 24 + 24 + 0 = 72 h de 96 h = 75 %.
    f = ic.fractions(_metrics([24.0, 0.0, 12.0, 12.0], [24.0, 24.0, 24.0, 0.0]))
    assert f["sun_pct"] == pytest.approx(50.0)
    assert f["earth_pct"] == pytest.approx(75.0)
    assert f["both_pct"] == pytest.approx(37.5)  # 24 + 0 + 12 + 0 = 36 h
    assert f["days"] == 4
    assert f["start_utc"] == "2026-11-01T00:00:00Z"
    assert f["end_utc"] == "2026-11-05T00:00:00Z"


def test_las_horas_totales_salen_del_paso_del_archivo():
    # Con pasos de 12 h, 6 h de Sol en cada paso es el 50 % del tiempo.
    f = ic.fractions(_metrics([6.0, 6.0], [12.0, 12.0], step_s=43200))
    assert f["sun_pct"] == pytest.approx(50.0)
    assert f["earth_pct"] == pytest.approx(100.0)


def test_solo_se_listan_sitios_reales_al_sur_del_limite():
    sites = [
        {"id": "a", "lat_deg": -84.8},
        {"id": "b", "lat_deg": -20.0},
        {"id": "demo", "lat_deg": -89.5, "synthetic": True},
    ]
    assert [s["id"] for s in ic.south_pole_sites(sites, max_lat=-60.0)] == ["a"]


def test_tabla_de_los_sitios_publicados_del_polo_sur():
    sites = json.loads((PUBLIC / "sites.json").read_text(encoding="utf-8"))["sites"]
    rows = ic.summary(sites, PUBLIC / "sites")
    ids = {r["site_id"] for r in rows}
    assert {"intuitive-machines-2", "odysseus-im-1", "chandrayaan-3"} <= ids
    for r in rows:
        assert r["dem"], f"{r['site_id']}: el horizon.json no tiene relieve (falta dem)"
        assert 0 <= r["sun_pct"] <= 100 and 0 <= r["earth_pct"] <= 100
