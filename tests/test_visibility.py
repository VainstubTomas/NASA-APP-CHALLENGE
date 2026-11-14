"""Pruebas de la regla de visibilidad (issue C2-03, ADR-002).

Los casos están en tests/fixtures/visibility_cases.json y los lee también la web
(web/src/horizon.test.js): si los dos dan lo mismo, Python y la web coinciden.
"""
import json

import pytest

from precompute.ephemeris import visibility as vis
from tests.helpers import PUBLIC, ROOT

CASES = json.loads((ROOT / "tests" / "fixtures" / "visibility_cases.json").read_text(encoding="utf-8"))


@pytest.mark.parametrize("c", CASES["horizon_at"], ids=lambda c: f"az{c['azimuth_deg']}")
def test_horizon_at(c):
    assert vis.horizon_at(CASES["horizons"][c["horizon"]], c["azimuth_deg"]) == pytest.approx(c["expected"])


@pytest.mark.parametrize("c", CASES["visibility"], ids=lambda c: c["name"])
def test_visibility_cases(c):
    h = vis.horizon_at(CASES["horizons"][c["horizon"]], c["azimuth_deg"])
    assert vis.is_visible(c["elevation_deg"], c["radius_deg"], h) is c["visible"]
    assert vis.is_fully_visible(c["elevation_deg"], c["radius_deg"], h) is c["fully_visible"]


def test_series_has_one_value_per_sample():
    eph = json.loads((PUBLIC / "sites" / "demo-sintetico" / "ephemeris.json").read_text(encoding="utf-8"))
    hor = json.loads((PUBLIC / "sites" / "demo-sintetico" / "horizon.json").read_text(encoding="utf-8"))
    out = vis.visibility_series(eph, hor)
    n = eph["time"]["count"]
    for body in ("sun", "earth"):
        assert len(out[body]["visible"]) == n
        assert len(out[body]["fully_visible"]) == n
        # totalmente visible implica visible
        assert all(v or not f for v, f in zip(out[body]["visible"], out[body]["fully_visible"]))


def test_series_matches_golden_shared_with_web():
    eph = json.loads((PUBLIC / "sites" / "demo-sintetico" / "ephemeris.json").read_text(encoding="utf-8"))
    hor = json.loads((PUBLIC / "sites" / "demo-sintetico" / "horizon.json").read_text(encoding="utf-8"))
    assert vis.series_summary(vis.visibility_series(eph, hor)) == CASES["series_golden"]["demo-sintetico"]


def test_series_rejects_site_mismatch():
    eph = {"site_id": "a", "time": {"count": 0}, "sun": {"azimuth_deg": [], "elevation_deg": []},
           "earth": {"azimuth_deg": [], "elevation_deg": []}, "angular_radius_deg": {"sun": 0.25, "earth": 1.0}}
    hor = {"site_id": "b", "azimuth_start_deg": 0, "azimuth_step_deg": 1, "elevation_deg": [0] * 360}
    with pytest.raises(ValueError):
        vis.visibility_series(eph, hor)
