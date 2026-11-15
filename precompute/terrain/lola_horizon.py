"""Horizonte de 360 valores desde el DEM LOLA recortado (issues C5-05 #13 y C5-06 #16; contrato horizon.json).

Para cada azimut (0 = norte, horario, 90 = este) avanza por la superficie hasta `max_m` metros,
toma la altura del relieve y devuelve el ángulo máximo sobre el plano horizontal local, con la
curvatura incluida. Sin refracción. Lo que no entra en el recorte se ignora.

La geometría y la lectura del mapa son las de `horizon_profile.py` (#16):
- los rayos siguen un círculo máximo de la esfera (a latitud constante, cerca del polo un rayo de
  20 km se desvía entre 0,7 y 1,3 km);
- las alturas, incluida la del sitio, se interpolan en forma bilineal (con el píxel más cercano,
  un salto de un píxel cerca del sitio cambiaba el ángulo varios grados);
- la posición en el mapa la calcula pyproj con la proyección del propio archivo.

Mapa: los sitios del polo sur (lat <= POLAR_SITE_MAX_LAT) usan el mapa polar de 30 m
(`LRO_LOLA_DEM_SPole75_30mp_v04`); el resto, el global de 128 ppd (~237 m por píxel).

Uso (por sitio, descarga el recorte y escribe horizon.json):
    python -m precompute.terrain.lola_horizon --only apollo-11
"""
from __future__ import annotations

import math
from pathlib import Path
from typing import Callable

import numpy as np

from precompute.terrain import horizon_profile as hp

ROOT = Path(__file__).resolve().parents[2]
RAW_DIR = ROOT / "data" / "raw"
MOON_R_M = hp.MOON_RADIUS_M
DEFAULT_MAX_M = 20_000.0  # 20 km: distancia máxima del horizonte (max_distance_km del contrato)
DEFAULT_STEP_M = 100.0
N_AZIMUTHS = 360


def _round_profile(elevation) -> list[float]:
    """Dos decimales; un rumbo sin ningún dato queda en 0 (horizonte ideal), como antes."""
    return [round(float(v), 2) if math.isfinite(v) else 0.0 for v in elevation]


class _SamplerTerrain:
    """Adapta una función `sample(lon, lat) -> alturas` al terreno que espera `hp.horizon_profile`."""

    def __init__(self, sample: Callable[[np.ndarray, np.ndarray], np.ndarray], lon0: float, lat0: float):
        self.sample, self.lon0, self.lat0 = sample, lon0, lat0

    def site_height_m(self) -> float:
        return float(self.sample(np.array([self.lon0]), np.array([self.lat0]))[0])

    def heights_along(self, azimuth_deg, distances_m):
        lat, lon = hp._destination(self.lat0, self.lon0, azimuth_deg, distances_m)
        return self.sample(np.asarray(lon), np.asarray(lat)), np.asarray(distances_m, dtype=float)


def horizon_from_sampler(
    sample: Callable[[np.ndarray, np.ndarray], np.ndarray],
    lon0: float,
    lat0: float,
    max_m: float = DEFAULT_MAX_M,
    step_m: float = DEFAULT_STEP_M,
    observer_h: float = 0.0,
) -> list[float]:
    """Perfil de 360 valores. `sample(lon, lat)` devuelve la altura en metros (NaN fuera del recorte)."""
    terrain = _SamplerTerrain(sample, lon0, lat0)
    if math.isnan(terrain.site_height_m()):
        raise ValueError(f"el sitio ({lon0}, {lat0}) está fuera del recorte")
    prof = hp.horizon_profile(terrain, max_distance_m=max_m, step_m=step_m, observer_height_m=observer_h)
    return _round_profile(prof.elevation_deg)


def horizon_from_tif(path: Path, lon0: float, lat0: float, max_m: float = DEFAULT_MAX_M,
                     step_m: float | None = DEFAULT_STEP_M) -> list[float]:
    """Perfil desde un TIFF de LOLA en cualquier proyección (interpolación bilineal).

    `step_m=None` usa un paso de un píxel del mapa.
    """
    try:
        terrain = hp.DemTerrain(path, lat_deg=lat0, lon_deg=lon0)
    except ValueError as err:
        raise ValueError(f"el sitio ({lon0}, {lat0}) está fuera del recorte: {err}") from err
    prof = hp.horizon_profile(terrain, max_distance_m=max_m, step_m=step_m)
    return _round_profile(prof.elevation_deg)


DEM_NAME = "LRO_LOLA_DEM_Global_128ppd_v04"
DEM_PIXEL_M = 237  # 128 ppd en el ecuador: 1737400 * pi / 180 / 128 ≈ 237 m
MARGIN_DEG = 0.75  # > 20 km (0.66° lunar): margen para que todos los rayos caigan en el recorte

POLAR_DEM_NAME = "LRO_LOLA_DEM_SPole75_30mp_v04"
POLAR_DEM_PIXEL_M = 30
# El mapa polar llega hasta -75°; con 20 km de rayos (0,66°) el sitio tiene que estar al sur de -75,7°.
POLAR_SITE_MAX_LAT = -75.7
POLAR_HALF_M = DEFAULT_MAX_M + 2_000.0  # recorte cuadrado: 20 km de rayo más 2 km de margen


def uses_polar_dem(lat: float) -> bool:
    """True si el sitio usa el mapa polar de 30 m (todo el círculo de 20 km dentro del mapa)."""
    return lat <= POLAR_SITE_MAX_LAT


def site_bbox(lon: float, lat: float, margin_deg: float = MARGIN_DEG) -> tuple[float, float, float, float]:
    """Caja alrededor del sitio con margen suficiente para max_m. La lon se escala por cos(lat)."""
    dlon = margin_deg / max(math.cos(math.radians(lat)), 1e-6)
    xmin, xmax = max(lon - dlon, -180.0), min(lon + dlon, 180.0)
    ymin, ymax = max(lat - margin_deg, -90.0), min(lat + margin_deg, 90.0)
    return round(xmin, 5), round(ymin, 5), round(xmax, 5), round(ymax, 5)


def build_horizon_json(site_id: str, elevation: list[float], max_m: float = DEFAULT_MAX_M,
                       dem_name: str = DEM_NAME, dem_pixel_m: int = DEM_PIXEL_M) -> dict:
    """Arma el horizon.json del contrato (docs/03-DATA-CONTRACT.md)."""
    return {
        "schema_version": "1.0",
        "site_id": site_id,
        "azimuth_start_deg": 0,
        "azimuth_step_deg": 1,
        "elevation_deg": elevation,
        "max_distance_km": max_m / 1000,
        "observer_height_m": 0,
        "dem": {"name": dem_name, "pixel_m": dem_pixel_m},
    }


def site_horizon(site: dict, raw_dir: Path = RAW_DIR) -> dict:
    """Descarga el recorte que corresponde al sitio (si falta) y devuelve su horizon.json."""
    from precompute.terrain.lola_dem import download, download_polar

    lat, lon = site["lat_deg"], site["lon_deg"]
    if uses_polar_dem(lat):
        tif = raw_dir / f"dem30_{site['id']}.tif"
        if not tif.exists():
            download_polar(lat, lon, tif, half_m=POLAR_HALF_M)
        elev = horizon_from_tif(tif, lon, lat, step_m=POLAR_DEM_PIXEL_M)
        return build_horizon_json(site["id"], elev, dem_name=POLAR_DEM_NAME, dem_pixel_m=POLAR_DEM_PIXEL_M)
    tif = raw_dir / f"dem_{site['id']}.tif"
    if not tif.exists():
        download(site_bbox(lon, lat), tif)
    return build_horizon_json(site["id"], horizon_from_tif(tif, lon, lat))


def main(argv=None) -> int:
    import argparse
    import json

    ap = argparse.ArgumentParser(description="Horizonte de 360 valores desde LOLA, por sitio (C5-05, C5-06)")
    ap.add_argument("--sites", type=Path, default=ROOT / "data" / "public" / "sites.json")
    ap.add_argument("--out-dir", type=Path, default=ROOT / "data" / "public" / "sites")
    ap.add_argument("--only", nargs="*", help="ids de sitio (por defecto, todos los reales)")
    ap.add_argument("--plot-dir", type=Path, help="carpeta para guardar la silueta de cada sitio (PNG)")
    a = ap.parse_args(argv)
    sites = json.loads(a.sites.read_text(encoding="utf-8"))["sites"]
    done = []
    for s in sites:
        if s.get("synthetic") or (a.only and s["id"] not in a.only):
            continue
        doc = site_horizon(s)
        elev = doc["elevation_deg"]
        path = a.out_dir / s["id"] / "horizon.json"
        path.write_text(json.dumps(doc) + "\n", encoding="utf-8")
        if a.plot_dir:
            a.plot_dir.mkdir(parents=True, exist_ok=True)
            prof = hp.HorizonProfile(elev, [DEFAULT_MAX_M] * len(elev), DEFAULT_MAX_M,
                                     float(doc["dem"]["pixel_m"]), 0.0, float("nan"))
            hp.plot_profile(prof, a.plot_dir / f"{s['id']}.png", title=f"{s['id']} · {doc['dem']['name']}")
        done.append(s["id"])
        print(f"OK {s['id']} ({doc['dem']['name']}): min {min(elev)} max {max(elev)}")
    print(f"{len(done)} horizon.json escritos")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
