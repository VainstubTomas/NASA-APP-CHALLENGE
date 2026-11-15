"""Tests de precompute/ephemeris/windows.py (issue C5-03, #45).

Las ventanas salen de metrics.json (C3-01): la suma de cada ventana tiene que coincidir con las horas
diarias de ese archivo, y el orden sigue el criterio de ADR-014 (Sol, después Tierra).
"""
import json

import pytest

from precompute.ephemeris import windows as w
from tests.helpers import PUBLIC


def _metrics(sun, earth):
    return {
        "time": {"start_utc": "2026-11-01T00:00:00Z", "step_s": 86400, "count": len(sun)},
        "daily": {"sun_hours": sun, "earth_hours": earth, "both_hours": [0.0] * len(sun)},
    }


def test_caso_a_mano_ventana_de_dos_dias():
    """Días: Sol [0, 24, 24, 0], Tierra [0, 0, 24, 24]. La mejor ventana de 2 días es la del medio."""
    m = _metrics([0.0, 24.0, 24.0, 0.0], [0.0, 0.0, 24.0, 24.0])
    best = w.best_windows(m, days=2, top=1)[0]
    assert best["start_index"] == 1
    assert best["sun_hours"] == 48.0
    assert best["earth_hours"] == 24.0
    assert w.window_start_utc(m, best) == "2026-11-02T00:00:00Z"


def test_empate_en_sol_gana_la_de_mas_tierra():
    m = _metrics([24.0, 24.0, 0.0], [0.0, 24.0, 0.0])
    top = w.best_windows(m, days=1, top=2)
    assert [c["start_index"] for c in top] == [1, 0]  # mismo Sol; gana el día con más Tierra


def test_ventanas_elegidas_no_se_superponen():
    m = _metrics([24.0] * 6 + [0.0] * 4, [0.0] * 10)
    top = w.best_windows(m, days=3, top=2)
    assert len(top) == 2
    a, b = sorted(c["start_index"] for c in top)
    assert b >= a + 3


def test_days_fuera_de_rango_falla_con_mensaje():
    m = _metrics([1.0, 2.0], [0.0, 0.0])
    with pytest.raises(ValueError, match="fuera de rango"):
        w.best_windows(m, days=3)


@pytest.mark.parametrize("site_id", ["apollo-11", "apollo-14"])
def test_suma_de_la_ventana_coincide_con_metrics_json(site_id):
    metrics = json.loads((PUBLIC / "sites" / site_id / "metrics.json").read_text(encoding="utf-8"))
    best = w.best_windows(metrics, days=7, top=1)[0]
    sun = metrics["daily"]["sun_hours"][best["start_index"]:best["start_index"] + 7]
    earth = metrics["daily"]["earth_hours"][best["start_index"]:best["start_index"] + 7]
    assert best["sun_hours"] == pytest.approx(sum(sun), abs=1e-3)
    assert best["earth_hours"] == pytest.approx(sum(earth), abs=1e-3)
