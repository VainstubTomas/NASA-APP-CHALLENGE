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


# ---- Validación, filtro por fecha y CLI (revisión del PR #117) ----

@pytest.mark.parametrize("kwargs", [{"top": 0}, {"top": -1}, {"days": 0}, {"days": -2}])
def test_top_y_days_invalidos_fallan_con_mensaje(kwargs):
    m = _metrics([24.0] * 5, [0.0] * 5)
    with pytest.raises(ValueError, match="fuera de rango|debe ser"):
        w.best_windows(m, **kwargs)


def test_desde_descarta_ventanas_que_empiezan_antes():
    """Sol [24, 24, 0, 0, 24, 24]: sin filtro gana el índice 0; desde el 3.er día queda la del índice 4."""
    m = _metrics([24.0, 24.0, 0.0, 0.0, 24.0, 24.0], [0.0] * 6)
    assert w.best_windows(m, days=2, top=1)[0]["start_index"] == 0
    desde = w.best_windows(m, days=2, top=1, since_utc="2026-11-03T00:00:00Z")
    assert [c["start_index"] for c in desde] == [4]


def test_desde_a_mitad_de_dia_no_incluye_ese_dia():
    """Una ventana que empieza el día 2026-11-02 00:00 ya empezó si 'desde' es 2026-11-02T12:00."""
    m = _metrics([24.0, 24.0, 24.0, 0.0], [0.0] * 4)
    top = w.best_windows(m, days=1, top=3, since_utc="2026-11-02T12:00:00Z")
    assert min(c["start_index"] for c in top) == 2


def test_desde_posterior_a_los_datos_no_devuelve_ventanas():
    m = _metrics([24.0] * 3, [0.0] * 3)
    assert w.best_windows(m, days=1, top=3, since_utc="2030-01-01T00:00:00Z") == []


def _site(tmp_path, sun, earth):
    d = tmp_path / "sitio-x"
    d.mkdir()
    (d / "metrics.json").write_text(json.dumps(_metrics(sun, earth)), encoding="utf-8")
    return tmp_path


def test_cli_lista_ventanas_desde_una_fecha(tmp_path, capsys):
    sites = _site(tmp_path, [24.0, 0.0, 24.0, 24.0], [0.0] * 4)
    code = w.main(["--site", "sitio-x", "--days", "2", "--top", "1", "--desde", "2026-11-02T00:00:00Z",
                   "--sites-dir", str(sites)])
    out = capsys.readouterr().out
    assert code == 0 and out.startswith("1. 2026-11-03T00:00:00Z + 2 días")


@pytest.mark.parametrize("args", [["--top", "0"], ["--days", "9"], ["--desde", "no-es-fecha"],
                                  ["--desde", "2030-01-01T00:00:00Z"]])
def test_cli_devuelve_error_claro_sin_ventanas_ni_trazas(tmp_path, capsys, args):
    sites = _site(tmp_path, [24.0] * 4, [0.0] * 4)
    code = w.main(["--site", "sitio-x", "--sites-dir", str(sites), *args])
    assert code == 1 and capsys.readouterr().out.startswith("ERROR:")
