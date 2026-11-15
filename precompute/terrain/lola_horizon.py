"""Horizonte de 360 valores desde el DEM LOLA recortado (issue C5-05, #13; contrato horizon.json).

Para cada azimut (0 = norte, horario, 90 = este) avanza por la superficie hasta `max_m` metros,
toma la altura del relieve y devuelve el ángulo máximo sobre el plano tangente local, con la caída
por curvatura d²/(2R) incluida. Sin refracción. Lo que no entra en el recorte se ignora.

Uso (por sitio, descarga el recorte y escribe horizon.json):
    python -m precompute.terrain.lola_horizon --sites-only apollo-11
"""
from __future__ import annotations

import math
from pathlib import Path
from typing import Callable

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
RAW_DIR = ROOT / "data" / "raw"
MOON_R_M = 1_737_400.0
DEFAULT_MAX_M = 20_000.0  # 20 km: distancia máxima del horizonte (max_distance_km del contrato)
DEFAULT_STEP_M = 100.0
N_AZIMUTHS = 360


def horizon_from_sampler(
    sample: Callable[[np.ndarray, np.ndarray], np.ndarray],
    lon0: float,
    lat0: float,
    max_m: float = DEFAULT_MAX_M,
    step_m: float = DEFAULT_STEP_M,
    observer_h: float = 0.0,
) -> list[float]:
    """Perfil de 360 valores. `sample(lon, lat)` devuelve la altura en metros (NaN fuera del recorte)."""
    d = np.arange(step_m, max_m + step_m / 2, step_m)  # distancias a lo largo de cada rayo
    ground = float(sample(np.array([lon0]), np.array([lat0]))[0])
    if math.isnan(ground):
        raise ValueError(f"el sitio ({lon0}, {lat0}) está fuera del recorte")
    eye = ground + observer_h
    drop = d**2 / (2 * MOON_R_M)  # caída del plano tangente por curvatura
    out = []
    for az in range(N_AZIMUTHS):
        rad = math.radians(az)
        dlat = np.degrees(d * math.cos(rad) / MOON_R_M)
        dlon = np.degrees(d * math.sin(rad) / (MOON_R_M * math.cos(math.radians(lat0))))
        h = sample(lon0 + dlon, lat0 + dlat)
        ang = np.degrees(np.arctan((h - eye - drop) / d))
        valid = ang[~np.isnan(ang)]
        out.append(round(float(valid.max()), 2) if valid.size else 0.0)
    return out


def horizon_from_tif(path: Path, lon0: float, lat0: float, max_m: float = DEFAULT_MAX_M,
                     step_m: float = DEFAULT_STEP_M) -> list[float]:
    """Perfil desde un TIFF de LOLA (muestreo por el píxel más cercano)."""
    import rasterio

    with rasterio.open(path) as src:
        arr = src.read(1).astype("float64")
        nodata = src.nodata

        def sample(lon: np.ndarray, lat: np.ndarray) -> np.ndarray:
            rows, cols = rasterio.transform.rowcol(src.transform, lon, lat)
            rows = np.asarray(rows)
            cols = np.asarray(cols)
            inside = (rows >= 0) & (rows < arr.shape[0]) & (cols >= 0) & (cols < arr.shape[1])
            out = np.full(lon.shape, np.nan)
            r = np.clip(rows, 0, arr.shape[0] - 1)
            c = np.clip(cols, 0, arr.shape[1] - 1)
            vals = arr[r, c]
            if nodata is not None:
                vals = np.where(vals == nodata, np.nan, vals)
            out[inside] = vals[inside]
            return out

        return horizon_from_sampler(sample, lon0, lat0, max_m=max_m, step_m=step_m)


DEM_NAME = "LRO_LOLA_DEM_Global_128ppd_v04"
DEM_PIXEL_M = 237  # 128 ppd en el ecuador: 1737400 * pi / 180 / 128 ≈ 237 m
MARGIN_DEG = 0.75  # > 20 km (0.66° lunar): margen para que todos los rayos caigan en el recorte


def site_bbox(lon: float, lat: float, margin_deg: float = MARGIN_DEG) -> tuple[float, float, float, float]:
    """Caja alrededor del sitio con margen suficiente para max_m. La lon se escala por cos(lat)."""
    dlon = margin_deg / max(math.cos(math.radians(lat)), 1e-6)
    xmin, xmax = max(lon - dlon, -180.0), min(lon + dlon, 180.0)
    ymin, ymax = max(lat - margin_deg, -90.0), min(lat + margin_deg, 90.0)
    return round(xmin, 5), round(ymin, 5), round(xmax, 5), round(ymax, 5)


def build_horizon_json(site_id: str, elevation: list[float], max_m: float = DEFAULT_MAX_M) -> dict:
    """Arma el horizon.json del contrato (docs/03-DATA-CONTRACT.md)."""
    return {
        "schema_version": "1.0",
        "site_id": site_id,
        "azimuth_start_deg": 0,
        "azimuth_step_deg": 1,
        "elevation_deg": elevation,
        "max_distance_km": max_m / 1000,
        "observer_height_m": 0,
        "dem": {"name": DEM_NAME, "pixel_m": DEM_PIXEL_M},
    }


def main(argv=None) -> int:
    import argparse
    import json

    from precompute.terrain.lola_dem import download

    ap = argparse.ArgumentParser(description="Horizonte de 360 valores desde LOLA, por sitio (C5-05)")
    ap.add_argument("--sites", type=Path, default=ROOT / "data" / "public" / "sites.json")
    ap.add_argument("--out-dir", type=Path, default=ROOT / "data" / "public" / "sites")
    ap.add_argument("--only", nargs="*", help="ids de sitio (por defecto, todos los reales)")
    a = ap.parse_args(argv)
    sites = json.loads(a.sites.read_text(encoding="utf-8"))["sites"]
    done = []
    for s in sites:
        if s.get("synthetic") or (a.only and s["id"] not in a.only):
            continue
        bbox = site_bbox(s["lon_deg"], s["lat_deg"])
        tif = RAW_DIR / f"dem_{s['id']}.tif"
        if not tif.exists():
            download(bbox, tif)
        elev = horizon_from_tif(tif, s["lon_deg"], s["lat_deg"])
        path = a.out_dir / s["id"] / "horizon.json"
        path.write_text(json.dumps(build_horizon_json(s["id"], elev)) + "\n", encoding="utf-8")
        done.append(s["id"])
        print(f"OK {s['id']}: min {min(elev)} max {max(elev)}")
    print(f"{len(done)} horizon.json escritos")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
