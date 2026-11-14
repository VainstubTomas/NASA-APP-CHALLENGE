"""Tests de precompute/ephemeris/build_metrics.py (issue C3-01, #34).

metrics.json: horas por día UTC con el Sol visible, la Tierra visible y ambos a la vez, calculadas con la
regla de visibilidad compartida con la web (precompute/ephemeris/visibility.py, C2-03).
"""
import json

import pytest

from precompute.ephemeris import build_metrics as bm
from tests.helpers import PUBLIC, _validator


def _load(site_id, name):
    return json.loads((PUBLIC / "sites" / site_id / name).read_text(encoding="utf-8"))


def _flat_horizon(site_id):
    return {"site_id": site_id, "azimuth_start_deg": 0, "azimuth_step_deg": 1, "elevation_deg": [0.0] * 360}


def _ephemeris(site_id, sun_el, earth_el, step_s=3600, start="2026-11-01T00:00:00Z"):
    n = len(sun_el)
    return {
        "schema_version": "1.0", "site_id": site_id,
        "time": {"start_utc": start, "step_s": step_s, "count": n},
        "sun": {"azimuth_deg": [90.0] * n, "elevation_deg": sun_el},
        "earth": {"azimuth_deg": [180.0] * n, "elevation_deg": earth_el},
        "angular_radius_deg": {"sun": 0.25, "earth": 1.0},
    }


def test_caso_a_mano_dos_dias():
    """Día 1: Sol visible 5 h, Tierra 24 h. Día 2: Sol 0 h, Tierra 10 h. Ambos = la intersección."""
    sun = [1.0] * 5 + [-1.0] * 19 + [-1.0] * 24
    earth = [5.0] * 24 + [5.0] * 10 + [-5.0] * 14
    doc = bm.build_site_metrics(_ephemeris("x", sun, earth), _flat_horizon("x"))
    assert doc["time"] == {"start_utc": "2026-11-01T00:00:00Z", "step_s": 86400, "count": 2}
    assert doc["daily"] == {"sun_hours": [5.0, 0.0], "earth_hours": [24.0, 10.0], "both_hours": [5.0, 0.0]}


def test_usa_la_regla_del_borde_superior():
    """Sol con el centro a -0,2° (radio 0,25°): el borde asoma, cuenta como visible (regla del contrato)."""
    sun = [-0.2] * 24
    earth = [-1.0] * 24  # borde justo en el horizonte: no visible (desigualdad estricta)
    doc = bm.build_site_metrics(_ephemeris("x", sun, earth), _flat_horizon("x"))
    assert doc["daily"]["sun_hours"] == [24.0]
    assert doc["daily"]["earth_hours"] == [0.0]


def test_respeta_el_horizonte_con_relieve():
    """Un horizonte de 10° hacia el azimut del Sol (90°) lo tapa aunque esté a 5° de altura."""
    horizon = _flat_horizon("x")
    horizon["elevation_deg"] = [10.0] * 360
    doc = bm.build_site_metrics(_ephemeris("x", [5.0] * 24, [15.0] * 24), horizon)
    assert doc["daily"]["sun_hours"] == [0.0]
    assert doc["daily"]["earth_hours"] == [24.0]


def test_paso_de_30_minutos_cuenta_medias_horas():
    sun = [1.0] * 3 + [-1.0] * 45  # 3 muestras de 30 min = 1,5 h
    doc = bm.build_site_metrics(_ephemeris("x", sun, [5.0] * 48, step_s=1800), _flat_horizon("x"))
    assert doc["daily"]["sun_hours"] == [1.5]


@pytest.mark.parametrize("kwargs, msg", [
    ({"step_s": 7000}, "divide"),                                # el paso no divide el día
    ({"start": "2026-11-01T05:00:00Z"}, "00:00"),                # no empieza a medianoche UTC
])
def test_rechaza_series_que_no_forman_dias_utc_completos(kwargs, msg):
    with pytest.raises(ValueError, match=msg):
        bm.build_site_metrics(_ephemeris("x", [1.0] * 24, [1.0] * 24, **kwargs), _flat_horizon("x"))


def test_rechaza_un_ultimo_dia_incompleto():
    with pytest.raises(ValueError, match="días completos"):
        bm.build_site_metrics(_ephemeris("x", [1.0] * 30, [1.0] * 30), _flat_horizon("x"))


def test_caso_conocido_coincide_con_el_metrics_sintetico():
    """El sitio de prueba ya trae un metrics.json hecho por scripts/make_synthetic_data.py con su propia
    implementación de la regla: el cálculo nuevo tiene que dar exactamente lo mismo."""
    doc = bm.build_site_metrics(_load("demo-sintetico", "ephemeris.json"), _load("demo-sintetico", "horizon.json"))
    assert doc == _load("demo-sintetico", "metrics.json")


def test_escribe_un_archivo_valido_por_sitio_y_omite_el_sintetico(tmp_path):
    sites = [
        {"id": "apollo-11", "lat_deg": 0.67416, "lon_deg": 23.47314},
        {"id": "demo-sintetico", "lat_deg": -89.5, "lon_deg": 0.0, "synthetic": True},
    ]
    informe = bm.build_all(sites, sites_dir=PUBLIC / "sites", out_dir=tmp_path)
    assert informe == {"written": ["apollo-11"], "skipped_synthetic": ["demo-sintetico"]}
    doc = json.loads((tmp_path / "apollo-11" / "metrics.json").read_text(encoding="utf-8"))
    errors = list(_validator("metrics.schema.json").iter_errors(doc))
    assert errors == [], [e.message for e in errors[:3]]
    assert doc["site_id"] == "apollo-11"
    assert doc["time"]["count"] == 120
    for sun, earth, both in zip(*doc["daily"].values()):
        assert both <= min(sun, earth)


def test_sin_horizon_json_falla_con_mensaje_claro(tmp_path):
    with pytest.raises(FileNotFoundError, match="horizon.json"):
        bm.build_all([{"id": "no-existe", "lat_deg": 0, "lon_deg": 0}], sites_dir=tmp_path, out_dir=tmp_path)
