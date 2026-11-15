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
    path = lh.RAW_DIR / "lola_apollo11_apollo14.tif"
    if not path.exists():
        pytest.skip("TIFF no descargado (data/raw/, no versionado)")
    elev = lh.horizon_from_tif(path, 23.4730, 0.6741, max_m=lh.DEFAULT_MAX_M)
    assert len(elev) == 360
    assert all(-10 < v < 30 for v in elev)
