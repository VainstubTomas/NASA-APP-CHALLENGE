"""Tests de precompute/terrain/illumination_check.py (issue C5-07, #51).

El porcentaje de tiempo con Sol sale de metrics.json (C3-01): horas con Sol sobre horas totales del
período. Se usa para comparar a grandes rasgos con la iluminación media de LOLA en Quickmap.
"""
import json
import math

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


def test_pixel_del_polo_es_el_centro_del_mapa():
    pytest.importorskip("pyproj")
    m = ic.LOLA_MAPS["65S_240M"]
    line, sample = ic.map_pixel(m, -90.0, 0.0)
    assert (line, sample) == pytest.approx((3209.5, 3209.5))


def test_longitud_cero_va_hacia_arriba_y_90_este_hacia_la_derecha():
    # Convención PDS del polo sur (verificada contra las alturas de Moon Trek en IM-2 y Odysseus):
    # lon 0° hacia arriba (fila menor), lon 90°E hacia la derecha (columna mayor).
    pytest.importorskip("pyproj")
    m = ic.LOLA_MAPS["65S_240M"]
    rho_px = 2 * 1_737_400 * math.tan(math.radians(45 - 80 / 2)) / 240  # lat -80°, en píxeles
    line, sample = ic.map_pixel(m, -80.0, 0.0)
    assert line == pytest.approx(3209.5 - rho_px) and sample == pytest.approx(3209.5)
    line, sample = ic.map_pixel(m, -80.0, 90.0)
    assert line == pytest.approx(3209.5) and sample == pytest.approx(3209.5 + rho_px)


def test_nuestros_porcentajes_coinciden_con_la_iluminacion_media_de_lola():
    """Validación a grandes rasgos (C5-07): mismo orden de magnitud que Mazarico et al. 2011.

    No es el mismo número: nuestro período es de 426 días y el de LOLA, 2009-2013; nuestro horizonte
    llega a 20 km. Tolerancia: 10 puntos porcentuales contra cualquiera de los mapas que cubren el sitio.
    """
    ref = json.loads((ic.REFERENCE_PATH).read_text(encoding="utf-8"))
    sites = json.loads((PUBLIC / "sites.json").read_text(encoding="utf-8"))["sites"]
    rows = {r["site_id"]: r for r in ic.summary(sites, PUBLIC / "sites")}
    assert set(ref["sites"]) <= set(rows)
    for site_id, maps in ref["sites"].items():
        for name, vals in maps.items():
            assert rows[site_id]["sun_pct"] == pytest.approx(vals["sun_pct"], abs=10), (site_id, name)
            assert rows[site_id]["earth_pct"] == pytest.approx(vals["earth_pct"], abs=10), (site_id, name)


def test_tabla_de_los_sitios_publicados_del_polo_sur():
    sites = json.loads((PUBLIC / "sites.json").read_text(encoding="utf-8"))["sites"]
    rows = ic.summary(sites, PUBLIC / "sites")
    ids = {r["site_id"] for r in rows}
    assert {"intuitive-machines-2", "odysseus-im-1", "chandrayaan-3"} <= ids
    for r in rows:
        assert r["dem"], f"{r['site_id']}: el horizon.json no tiene relieve (falta dem)"
        assert 0 <= r["sun_pct"] <= 100 and 0 <= r["earth_pct"] <= 100
