"""Recorte del DEM LOLA 128 ppd desde el ImageServer de Moon Trek (issue C5-05, #13; ADR-006).

El producto `LRO_LOLA_DEM_Global_128ppd_v04` es el archivo de elevación crudo (Float32, metros). Acá no se
baja el global (2.2 GB): se pide solo la caja de cada sitio con `exportImage`.

Para los sitios del polo sur (#16) se usa `LRO_LOLA_DEM_SPole75_30mp_v04`: 30 m por píxel, en su
proyección estereográfica polar original (no la versión `_EQ`, que en latitud tiene 87 m por píxel).
Cubre desde el polo hasta -75°.

Uso:
    python -m precompute.terrain.lola_dem --bbox -18,-4,24,1 --out data/raw/lola_apollo11_apollo14.tif
"""
from __future__ import annotations

import argparse
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[2]
RAW_DIR = ROOT / "data" / "raw"
SERVICE = "https://trek.nasa.gov/moon/trekarcgis/rest/services/LRO_LOLA_DEM_Global_128ppd_v04/ImageServer"
SR_WKID = 104903  # equirectangular lunar, lon/lat en grados (ver ImageServer ?f=json)
PPD = 128         # pixeles por grado
TIFF_MAGIC = (b"II*\x00", b"MM\x00*")

POLAR_SERVICE = "https://trek.nasa.gov/moon/trekarcgis/rest/services/LRO_LOLA_DEM_SPole75_30mp_v04/ImageServer"
POLAR_PIXEL_M = 30
POLAR_MAX_LAT = -75.0  # el mapa polar cubre latitudes <= -75°


def size_for_bbox(bbox: tuple[float, float, float, float]) -> tuple[int, int]:
    """Tamaño en píxeles (ancho, alto) para la caja a 128 ppd."""
    xmin, ymin, xmax, ymax = bbox
    return round((xmax - xmin) * PPD), round((ymax - ymin) * PPD)


def export_url(bbox: tuple[float, float, float, float], size: tuple[int, int]) -> str:
    """URL de exportImage: TIFF Float32 sin renderizar, en la caja pedida."""
    xmin, ymin, xmax, ymax = bbox
    if not (-180 <= xmin < xmax <= 180 and -90 <= ymin < ymax <= 90):
        raise ValueError(f"bbox inválida {bbox}: se espera xmin<xmax y ymin<ymax dentro de lon [-180,180], lat [-90,90]")
    return (
        f"{SERVICE}/exportImage?bbox={xmin},{ymin},{xmax},{ymax}"
        f"&bboxSR={SR_WKID}&imageSR={SR_WKID}&size={size[0]},{size[1]}"
        f"&format=tiff&pixelType=F32&interpolation=RSP_BilinearInterpolation&f=image"
    )


def _get_tiff(url: str, out: Path, timeout: int) -> Path:
    resp = requests.get(url, timeout=timeout)
    resp.raise_for_status()
    if not resp.content.startswith(TIFF_MAGIC):
        raise RuntimeError(f"La respuesta no es TIFF (inicio {resp.content[:8]!r}, tipo {resp.headers.get('Content-Type')})")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes(resp.content)
    return out


def download(bbox: tuple[float, float, float, float], out: Path, timeout: int = 300) -> Path:
    """Baja el recorte y verifica que sea un TIFF (no un PNG ni un error en HTML)."""
    return _get_tiff(export_url(bbox, size_for_bbox(bbox)), out, timeout)


def polar_export_url(x_m: float, y_m: float, half_m: float, crs_wkt: str) -> str:
    """URL de exportImage del mapa polar de 30 m: cuadrado de lado 2*half_m centrado en (x, y) del mapa."""
    import json
    from urllib.parse import urlencode

    n = round(2 * half_m / POLAR_PIXEL_M)
    sr = json.dumps({"wkt": crs_wkt})
    query = {
        "bbox": f"{x_m - half_m},{y_m - half_m},{x_m + half_m},{y_m + half_m}",
        "bboxSR": sr, "imageSR": sr, "size": f"{n},{n}", "format": "tiff", "pixelType": "F32",
        "interpolation": "RSP_BilinearInterpolation", "f": "image",
    }
    return f"{POLAR_SERVICE}/exportImage?{urlencode(query)}"


def download_polar(lat_deg: float, lon_deg: float, out: Path, half_m: float = 22_000.0, timeout: int = 300) -> Path:
    """Baja un recorte del mapa polar de 30 m alrededor del sitio, en la proyección del propio servicio.

    La proyección se pide al servicio y el sitio se ubica con pyproj (nada de conversiones a mano).
    """
    from pyproj import CRS, Transformer

    if lat_deg > POLAR_MAX_LAT:
        raise ValueError(f"lat {lat_deg} fuera del mapa polar (cubre lat <= {POLAR_MAX_LAT})")
    info = requests.get(f"{POLAR_SERVICE}?f=json", timeout=60)
    info.raise_for_status()
    wkt = info.json()["spatialReference"]["wkt"]
    crs = CRS.from_wkt(wkt)
    x, y = Transformer.from_crs(crs.geodetic_crs, crs, always_xy=True).transform(lon_deg, lat_deg)
    return _get_tiff(polar_export_url(x, y, half_m, wkt), out, timeout)


def check_tiff(path: Path) -> dict:
    """Metadatos y rango de altura del TIFF, para verificar que es Float32 en metros."""
    import numpy as np
    import rasterio

    with rasterio.open(path) as src:
        data = src.read(1).astype("float64")
        crs_wkt = src.crs.to_wkt() if src.crs else ""
        return {
            "dtype": src.dtypes[0],
            "count": src.count,
            "crs_wkt": crs_wkt,
            "shape": (src.height, src.width),
            "min": float(np.nanmin(data)),
            "max": float(np.nanmax(data)),
        }


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Recorta el DEM LOLA 128 ppd por bbox (C5-05)")
    ap.add_argument("--bbox", required=True, help="xmin,ymin,xmax,ymax en grados lunares (lon este-positiva)")
    ap.add_argument("--out", type=Path, required=True)
    a = ap.parse_args(argv)
    bbox = tuple(float(v) for v in a.bbox.split(","))
    path = download(bbox, a.out)
    print(f"OK {path} {check_tiff(path)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
