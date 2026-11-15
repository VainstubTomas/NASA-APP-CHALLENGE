"""Perfil de horizonte con relieve (issue C5-06, #16). Todo con terreno de prueba INVENTADO.

Ningún test usa el mapa LOLA real: los casos conocidos se arman con terrenos de juguete cuyo
ángulo de horizonte se puede calcular a mano (pared a distancia conocida, Luna lisa, montaña
escondida por la curvatura). El último bloque escribe un GeoTIFF chico, también inventado, con
la misma proyección polar estereográfica que el LDEM del polo sur, para probar la ubicación del
sitio y la orientación del norte con pyproj y rasterio.
"""
import math

import numpy as np
import pytest

from precompute.terrain import horizon_profile as hp

R = hp.MOON_RADIUS_M


# --- Geometría de un rayo -------------------------------------------------------------------

def test_angulo_de_un_punto_lejano_incluye_la_caida_por_curvatura():
    # Pared de 500 m a 10 km. A mano: atan(500/10000) = 2,862° menos la caída por curvatura,
    # d / (2R) = 10000 / (2 * 1737400) rad = 0,165°. Total ≈ 2,697°.
    esperado = math.degrees(math.atan(500 / 10_000)) - math.degrees(10_000 / (2 * R))
    got = hp.elevation_angle_deg(np.array([10_000.0]), np.array([500.0]), observer_h_m=0.0)[0]
    assert got == pytest.approx(esperado, abs=0.01)


def test_en_una_luna_lisa_el_horizonte_queda_apenas_bajo_cero():
    # Sin relieve y con el observador en el suelo, todo punto de la esfera queda bajo el plano
    # horizontal: el horizonte es el punto más cercano, -d/(2R) (unos -0,001° a 80 m).
    d = np.arange(80.0, 150_000.0, 80.0)
    ang = hp.elevation_angle_deg(d, np.zeros_like(d), observer_h_m=0.0)
    assert ang.max() < 0
    assert ang.max() == pytest.approx(-math.degrees(80 / (2 * R)), abs=1e-4)


def test_una_montana_lejana_queda_escondida_por_la_curvatura():
    # A 100 km la Luna "cae" d²/2R = 2878 m. Una montaña de 2000 m allá queda bajo el horizonte.
    ang = hp.elevation_angle_deg(np.array([100_000.0]), np.array([2000.0]), observer_h_m=0.0)[0]
    assert ang < 0


def test_ray_horizon_toma_el_maximo_e_ignora_huecos_sin_datos():
    d = np.array([1000.0, 2000.0, 3000.0, 4000.0])
    h = np.array([0.0, 100.0, np.nan, 50.0])
    elev, covered = hp.ray_horizon(d, h, observer_h_m=0.0)
    assert elev == pytest.approx(math.degrees(math.atan(100 / 2000)) - math.degrees(2000 / (2 * R)), abs=0.01)
    assert covered == pytest.approx(4000.0)


def test_ray_horizon_sin_ningun_dato_devuelve_nan():
    elev, covered = hp.ray_horizon(np.array([80.0, 160.0]), np.array([np.nan, np.nan]), 0.0)
    assert math.isnan(elev) and covered == 0.0


def test_destino_sobre_la_esfera_respeta_rumbos_y_distancia():
    # Convención del repo: azimut 0° = norte, sentido horario (90° = este), longitud este-positiva.
    lat, lon = -84.7906, 29.1957
    n_lat, n_lon = hp._destination(lat, lon, 0.0, 30_330.0)   # 1° de latitud ≈ 2πR/360 = 30 323 m
    assert n_lat == pytest.approx(lat + 1.0, abs=0.01) and n_lon == pytest.approx(lon, abs=1e-6)
    s_lat, _ = hp._destination(lat, lon, 180.0, 1000.0)
    assert s_lat < lat
    _, e_lon = hp._destination(lat, lon, 90.0, 1000.0)
    _, w_lon = hp._destination(lat, lon, 270.0, 1000.0)
    assert e_lon > lon > w_lon


# --- Perfil de 360 azimuts con un terreno analítico ------------------------------------------

class ParedAlEste:
    """Terreno inventado: Luna lisa salvo una pared de 1000 m a 5 km, entre los azimuts 80° y 100°."""

    def heights_along(self, azimuth_deg, distances_m):
        h = np.zeros_like(distances_m)
        if 80 <= azimuth_deg <= 100:
            h[distances_m >= 5000] = 1000.0
        return h, distances_m

    def site_height_m(self):
        return 0.0


def test_perfil_tiene_360_valores_y_la_pared_aparece_solo_hacia_el_este():
    prof = hp.horizon_profile(ParedAlEste(), max_distance_m=20_000, step_m=100)
    assert len(prof.elevation_deg) == 360
    pared = math.degrees(math.atan(1000 / 5000)) - math.degrees(5000 / (2 * R))  # ≈ 11,23°
    assert prof.elevation_deg[90] == pytest.approx(pared, abs=0.05)
    assert prof.elevation_deg[0] < 0 and prof.elevation_deg[180] < 0 and prof.elevation_deg[270] < 0
    assert all(c == pytest.approx(20_000, abs=100) for c in prof.covered_m)


def test_observador_mas_alto_baja_el_horizonte():
    bajo = hp.horizon_profile(ParedAlEste(), max_distance_m=20_000, step_m=100, observer_height_m=0)
    alto = hp.horizon_profile(ParedAlEste(), max_distance_m=20_000, step_m=100, observer_height_m=500)
    assert alto.elevation_deg[90] < bajo.elevation_deg[90]


# --- GeoTIFF inventado en proyección polar estereográfica (como el LDEM 80S) -----------------

rasterio = pytest.importorskip("rasterio")
pytest.importorskip("pyproj")


def _geotiff_de_prueba(path, site_lat, site_lon, bloque_hacia, valor=2000.0, units_km=False):
    """Escribe un DEM de 0 m con un bloque alto a ~3 km del sitio, en el rumbo geográfico pedido."""
    from pyproj import Transformer
    from rasterio.transform import from_origin

    crs = hp.MOON_SOUTH_POLAR_STEREO
    to_xy = Transformer.from_crs(hp.MOON_GEOGRAPHIC, crs, always_xy=True)
    x0, y0 = to_xy.transform(site_lon, site_lat)
    px = 80.0
    n = 301  # 24 km de lado, centrado en el sitio
    left, top = x0 - px * n / 2, y0 + px * n / 2
    data = np.zeros((n, n), dtype="float32")
    # Punto a 3 km en el rumbo pedido: se mueve sobre la esfera y se proyecta.
    lat2, lon2 = hp._destination(site_lat, site_lon, bloque_hacia, 3000.0)
    bx, by = to_xy.transform(lon2, lat2)
    col, row = int((bx - left) / px), int((top - by) / px)
    data[row - 4:row + 5, col - 4:col + 5] = valor / 1000 if units_km else valor
    with rasterio.open(path, "w", driver="GTiff", width=n, height=n, count=1, dtype="float32",
                       crs=crs, transform=from_origin(left, top, px, px), nodata=-9999) as dst:
        dst.write(data, 1)
    return path


@pytest.mark.parametrize("rumbo", [0, 90, 200])
def test_dem_polar_el_bloque_aparece_en_el_rumbo_geografico_correcto(tmp_path, rumbo):
    # Intuitive Machines 2 (-84,79°, 29,20°E): en estereográfica polar el norte de la grilla no es
    # el norte geográfico, así que este test atrapa un error de orientación.
    tif = _geotiff_de_prueba(tmp_path / "dem.tif", -84.7906, 29.1957, rumbo)
    terrain = hp.DemTerrain(tif, lat_deg=-84.7906, lon_deg=29.1957)
    prof = hp.horizon_profile(terrain, max_distance_m=8000)
    elev = np.asarray(prof.elevation_deg)
    assert elev.max() > 20  # 2000 m a ~3 km: atan(2/3) ≈ 33°, menos el borde del bloque
    # El bloque mide 720 m: a 3 km ocupa unos ±7° de azimut. Se compara su centro, no el máximo.
    alto = np.flatnonzero(elev > elev.max() / 2)
    centro = math.degrees(np.angle(np.exp(1j * np.radians(alto)).mean())) % 360
    assert min(abs(centro - rumbo), 360 - abs(centro - rumbo)) <= 3
    assert len(alto) < 30  # es un bloque, no medio horizonte


def test_dem_en_km_se_detecta_y_se_pasa_a_metros(tmp_path):
    tif = _geotiff_de_prueba(tmp_path / "dem_km.tif", -84.7906, 29.1957, 90, units_km=True)
    terrain = hp.DemTerrain(tif, lat_deg=-84.7906, lon_deg=29.1957)
    assert terrain.height_unit_m == 1000.0
    prof = hp.horizon_profile(terrain, max_distance_m=8000)
    assert prof.elevation_deg[90] > 20


def test_rayos_que_salen_del_mapa_quedan_marcados_como_cobertura_parcial(tmp_path):
    tif = _geotiff_de_prueba(tmp_path / "dem.tif", -84.7906, 29.1957, 90)
    terrain = hp.DemTerrain(tif, lat_deg=-84.7906, lon_deg=29.1957)
    prof = hp.horizon_profile(terrain, max_distance_m=50_000)  # el mapa de prueba mide 24 km
    assert max(prof.covered_m) < 50_000
    assert prof.partial  # ningún rayo llega a 50 km


def test_sitio_fuera_del_mapa_da_error_claro(tmp_path):
    tif = _geotiff_de_prueba(tmp_path / "dem.tif", -84.7906, 29.1957, 90)
    with pytest.raises(ValueError, match="fuera del mapa"):
        hp.DemTerrain(tif, lat_deg=-70.0, lon_deg=0.0)


def test_grafico_de_la_silueta_se_genera(tmp_path):
    pytest.importorskip("matplotlib")
    prof = hp.horizon_profile(ParedAlEste(), max_distance_m=20_000, step_m=200)
    out = hp.plot_profile(prof, tmp_path / "silueta.png", title="Terreno de prueba (inventado)")
    assert out.exists() and out.stat().st_size > 1000
