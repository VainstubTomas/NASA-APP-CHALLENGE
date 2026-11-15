"""Horizonte de 360 valores desde un relieve (C5-05, #13; contrato horizon.json, ADR-011).

Valor conocido: un muro de 100 m a 1000 m al este (azimut 90°). El ángulo esperado es
atan((100 - d²/(2R)) / d) con d = 1000 m y R = radio lunar. La caída por curvatura se incluye.
"""
import math

import numpy as np
import pytest

from precompute.terrain import lola_horizon as lh

R = lh.MOON_R_M


def test_flat_terrain_gives_zero_horizon():
    elev = lh.horizon_from_sampler(lambda lon, lat: np.zeros_like(lon), 0.0, 0.0, max_m=5000, step_m=100)
    assert len(elev) == 360
    assert all(abs(v) < 0.01 for v in elev)


def test_wall_east_known_angle():
    lat0 = 0.0
    d_wall = 1000.0
    width_deg = 100.0 / (R * math.pi / 180)  # 100 m en grados de lon (ancho de un paso)

    def sampler(lon, lat):
        # muro de 100 m solo en x entre 1000 m y 1100 m al este (lon>0, lat≈0)
        x = lon * R * math.pi / 180
        y = lat * R * math.pi / 180
        inside = (x >= d_wall - 1) & (x <= d_wall + 100) & (np.abs(y) < 50)
        return np.where(inside, 100.0, 0.0)

    elev = lh.horizon_from_sampler(sampler, 0.0, lat0, max_m=2000, step_m=100)
    expected = math.degrees(math.atan((100.0 - d_wall**2 / (2 * R)) / d_wall))
    assert elev[90] == pytest.approx(expected, abs=0.01)
    assert abs(elev[0]) < 0.01  # al norte no hay muro


def test_site_outside_crop_raises():
    def sampler(lon, lat):
        return np.full_like(lon, np.nan)

    with pytest.raises(ValueError, match="fuera del recorte"):
        lh.horizon_from_sampler(sampler, 0.0, 0.0, max_m=2000, step_m=100)


def test_samples_outside_crop_are_ignored():
    def sampler(lon, lat):
        # terreno plano solo en un parche de 500 m alrededor del sitio: fuera es NaN
        x = lon * R * math.pi / 180
        y = lat * R * math.pi / 180
        return np.where((np.abs(x) < 500) & (np.abs(y) < 500), 0.0, np.nan)

    elev = lh.horizon_from_sampler(sampler, 0.0, 0.0, max_m=2000, step_m=100)
    assert all(abs(v) < 0.01 for v in elev)


def test_real_crop_horizon_in_range():
    path = lh.RAW_DIR / "dem_apollo-11.tif"
    if not path.exists():
        pytest.skip("TIFF no descargado (data/raw/, no versionado)")
    elev = lh.horizon_from_tif(path, 23.4730, 0.6741, max_m=lh.DEFAULT_MAX_M)
    assert len(elev) == 360
    assert all(-10 < v < 30 for v in elev)


def test_published_horizon_matches_dem_recomputation():
    """El horizon.json publicado de Apollo 11 coincide con el horizonte recalculado del DEM real."""
    import json

    path = lh.RAW_DIR / "dem_apollo-11.tif"
    if not path.exists():
        pytest.skip("TIFF no descargado (data/raw/, no versionado)")
    sites = json.loads((lh.ROOT / "data" / "public" / "sites.json").read_text(encoding="utf-8"))["sites"]
    site = next(s for s in sites if s["id"] == "apollo-11")
    published = json.loads(
        (lh.ROOT / "data" / "public" / "sites" / "apollo-11" / "horizon.json").read_text(encoding="utf-8")
    )
    expected = lh.horizon_from_tif(path, site["lon_deg"], site["lat_deg"])
    assert len(published["elevation_deg"]) == 360
    assert published["elevation_deg"] == pytest.approx(expected, abs=0.01)


# --- Cerca del polo (#16): los rayos tienen que ir por círculo máximo -------------------------

def _distancia_y_rumbo(lat0, lon0, lat, lon):
    """Distancia sobre la esfera (m) y rumbo inicial (grados) del sitio a cada punto. Fórmulas estándar,
    independientes del código que se prueba."""
    p0, p, dl = math.radians(lat0), np.radians(lat), np.radians(lon - lon0)
    a = np.sin((p - p0) / 2) ** 2 + math.cos(p0) * np.cos(p) * np.sin(dl / 2) ** 2
    dist = 2 * R * np.arcsin(np.sqrt(np.clip(a, 0, 1)))
    rumbo = np.degrees(np.arctan2(np.sin(dl) * np.cos(p), math.cos(p0) * np.sin(p) - math.sin(p0) * np.cos(p) * np.cos(dl)))
    return dist, rumbo % 360


def test_pared_angosta_cerca_del_polo_aparece_en_su_rumbo():
    # Intuitive Machines 2 (-84,79°). Pared de 500 m entre 10 y 10,3 km, solo en rumbos de 89,5° a 90,5°.
    # A latitud constante, el rayo del este se desvía ~1,8° de rumbo a 10 km y no la ve.
    lat0, lon0 = -84.7906, 29.1957

    def sampler(lon, lat):
        dist, rumbo = _distancia_y_rumbo(lat0, lon0, lat, lon)
        return np.where((dist >= 10_000) & (dist <= 10_300) & (np.abs(rumbo - 90) <= 0.5), 500.0, 0.0)

    elev = lh.horizon_from_sampler(sampler, lon0, lat0, max_m=15_000, step_m=50)
    esperado = math.degrees(math.atan2(500 - 10_000**2 / (2 * R), 10_000))  # ≈ 2,70°
    assert elev[90] == pytest.approx(esperado, abs=0.05)
    assert elev[88] < 0.1 and elev[92] < 0.1


def test_sitios_del_polo_usan_el_mapa_de_30_m():
    assert lh.uses_polar_dem(-84.7906) and lh.uses_polar_dem(-80.13)  # IM-2 y Odysseus
    assert not lh.uses_polar_dem(-69.3741)  # Chandrayaan-3: el círculo de 20 km saldría del mapa polar
    doc = lh.build_horizon_json("x", [0.0] * 360, dem_name=lh.POLAR_DEM_NAME, dem_pixel_m=lh.POLAR_DEM_PIXEL_M)
    assert doc["dem"] == {"name": "LRO_LOLA_DEM_SPole75_30mp_v04", "pixel_m": 30}


@pytest.mark.parametrize("site_id", ["intuitive-machines-2", "odysseus-im-1"])
def test_horizonte_polar_publicado_coincide_con_el_mapa_de_30_m(site_id):
    import json

    path = lh.RAW_DIR / f"dem30_{site_id}.tif"
    if not path.exists():
        pytest.skip("TIFF polar no descargado (data/raw/, no versionado)")
    site = next(s for s in json.loads((lh.ROOT / "data" / "public" / "sites.json").read_text(encoding="utf-8"))["sites"]
                if s["id"] == site_id)
    published = json.loads((lh.ROOT / "data" / "public" / "sites" / site_id / "horizon.json").read_text(encoding="utf-8"))
    assert published["dem"]["name"] == lh.POLAR_DEM_NAME
    expected = lh.site_horizon(site)
    assert published["dem"] == expected["dem"]
    # Tolerancia como en Apollo 11: un recorte bajado de nuevo puede diferir en el último decimal.
    assert published["elevation_deg"] == pytest.approx(expected["elevation_deg"], abs=0.01)
