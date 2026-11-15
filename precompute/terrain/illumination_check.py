"""Porcentaje de tiempo con Sol y con Tierra por sitio del polo sur, contra LOLA (issue C5-07, #51).

Valida a grandes rasgos el horizonte con relieve (C5-06, #16). Nuestro lado no calcula nada nuevo:
las horas salen de metrics.json (C3-01), que ya compara cada cuerpo contra el horizonte.
Porcentaje = horas con el cuerpo visible / horas totales del período (count * step_s).

Referencia: mapas de visibilidad media del disco solar y del disco terrestre de LOLA
(Mazarico et al. 2011, Icarus 211, "Illumination conditions of the lunar polar regions using LOLA
topography"), productos AVGVISIB_*_201608 de los EXTRAS de LOLA en PDS (espejo del MIT). Es la misma
capa de iluminación media que muestra Quickmap. Un píxel cuenta como iluminado si se ve cualquier parte
del disco: el mismo criterio que `visible` en el contrato. Se usan solo para validar, no como datos
publicados (ADR-006).

Formato de los mapas (etiqueta .LBL): INT16 little-endian sin cabecera, fracción = DN * 0,00004;
estereográfica polar sur sobre la esfera de 1737,4 km, escala real en el polo, lon 0° hacia arriba.
La posición se calcula con pyproj (nunca a mano). Se piden solo las filas del sitio con HTTP Range.
Orientación verificada: con la misma convención, LDEM_75S_240M da 5323 m en IM-2 y 2600 m en Odysseus;
Moon Trek (LRO_LOLA_DEM_Global_128ppd_v04, identify) da 5326,5 m y 2594,5 m.

Límites: metrics.json cubre unos 120 días; LOLA promedia 2009-2013. Nuestro horizonte llega a 20 km.
Se espera el mismo orden de magnitud, no el mismo número.

Uso:
    python -m precompute.terrain.illumination_check            # tabla con nuestros porcentajes
    python -m precompute.terrain.illumination_check --lola     # lee LOLA y guarda la referencia
"""
from __future__ import annotations

import argparse
import json
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PUBLIC = ROOT / "data" / "public"
REFERENCE_PATH = ROOT / "tests" / "reference" / "lola_avgvisib.json"
DEFAULT_MAX_LAT = -60.0  # "polo sur" para esta tabla: Chandrayaan-3 (-69,4°) entra
_ISO = "%Y-%m-%dT%H:%M:%SZ"

MOON_RADIUS_M = 1_737_400.0  # A_AXIS_RADIUS = 1737.4 <km> de las etiquetas
LOLA_URL = "http://imbrium.mit.edu/EXTRAS/ILLUMINATION/IMG/AVGVISIB_{name}_201608{kind}.IMG"
LOLA_SCALE = 0.00004  # SCALING_FACTOR: DN -> fracción [0, 1]
# Datos de cada etiqueta: tamaño (filas = columnas), centro del polo (PROJECTION_OFFSET, píxeles
# contados desde 0) y metros por píxel (MAP_SCALE). Cobertura completa hasta min_lat.
LOLA_MAPS = {
    "65S_240M": {"name": "65S_240M", "n": 6420, "offset": 3209.5, "pixel_m": 240, "min_lat": -65.0},
    "75S_120M": {"name": "75S_120M", "n": 7624, "offset": 3811.5, "pixel_m": 120, "min_lat": -75.0},
}
LOLA_CRS = (f"+proj=stere +lat_0=-90 +lon_0=0 +k=1 +x_0=0 +y_0=0 +R={MOON_RADIUS_M:.0f} "
            "+units=m +no_defs")
MOON_GEOGRAPHIC = f"+proj=longlat +R={MOON_RADIUS_M:.0f} +no_defs"


# --- Nuestro lado: metrics.json ---------------------------------------------------------------

def fractions(metrics: dict) -> dict:
    """Porcentaje del período con Sol, con Tierra y con ambos, desde un metrics.json."""
    t = metrics["time"]
    total_h = t["count"] * t["step_s"] / 3600
    d = metrics["daily"]
    start = datetime.strptime(t["start_utc"], _ISO).replace(tzinfo=timezone.utc)
    end = start + timedelta(seconds=t["count"] * t["step_s"])
    return {
        "sun_pct": 100 * sum(d["sun_hours"]) / total_h,
        "earth_pct": 100 * sum(d["earth_hours"]) / total_h,
        "both_pct": 100 * sum(d["both_hours"]) / total_h,
        "days": round(t["count"] * t["step_s"] / 86400),
        "start_utc": t["start_utc"],
        "end_utc": end.strftime(_ISO),
    }


def south_pole_sites(sites: list[dict], max_lat: float = DEFAULT_MAX_LAT) -> list[dict]:
    """Sitios reales (no sintéticos) con latitud <= max_lat, del más austral al menos."""
    out = [s for s in sites if not s.get("synthetic") and s["lat_deg"] <= max_lat]
    return sorted(out, key=lambda s: s["lat_deg"])


def summary(sites: list[dict], sites_dir: Path, max_lat: float = DEFAULT_MAX_LAT) -> list[dict]:
    """Una fila por sitio del polo sur: coordenadas, mapa de relieve usado y porcentajes."""
    rows = []
    for s in south_pole_sites(sites, max_lat):
        folder = Path(sites_dir) / s["id"]
        metrics = json.loads((folder / "metrics.json").read_text(encoding="utf-8"))
        horizon = json.loads((folder / "horizon.json").read_text(encoding="utf-8"))
        dem = horizon.get("dem")
        rows.append({
            "site_id": s["id"],
            "lat_deg": s["lat_deg"],
            "lon_deg": s["lon_deg"],
            "dem": f"{dem['name']} ({dem['pixel_m']} m)" if dem else "",
            **fractions(metrics),
        })
    return rows


# --- Referencia: mapas AVGVISIB de LOLA -------------------------------------------------------

def map_pixel(lola_map: dict, lat_deg: float, lon_deg: float) -> tuple[float, float]:
    """(fila, columna) del sitio en el mapa, contadas desde 0 al centro del píxel."""
    from pyproj import Transformer

    x, y = Transformer.from_crs(MOON_GEOGRAPHIC, LOLA_CRS, always_xy=True).transform(lon_deg, lat_deg)
    off, px = lola_map["offset"], lola_map["pixel_m"]
    return off - y / px, off + x / px


def read_lola_pixel(lola_map: dict, lat_deg: float, lon_deg: float, earth: bool = False,
                    timeout: int = 60) -> float:
    """Visibilidad media (0 a 1) en el píxel del sitio. Baja solo esa fila del mapa (HTTP Range)."""
    import numpy as np
    import requests

    line_f, sample_f = map_pixel(lola_map, lat_deg, lon_deg)
    line, sample = int(round(line_f)), int(round(sample_f))
    row_bytes = lola_map["n"] * 2
    url = LOLA_URL.format(name=lola_map["name"], kind="_EARTH" if earth else "")
    first = line * row_bytes
    resp = requests.get(url, headers={"Range": f"bytes={first}-{first + row_bytes - 1}"}, timeout=timeout)
    resp.raise_for_status()
    if resp.status_code != 206 or len(resp.content) != row_bytes:
        raise RuntimeError(f"{url}: se esperaba una fila de {row_bytes} bytes (HTTP 206), "
                           f"llegó HTTP {resp.status_code} con {len(resp.content)} bytes")
    row = np.frombuffer(resp.content, dtype="<i2")
    return float(row[sample]) * LOLA_SCALE


def lola_reference(sites: list[dict], max_lat: float = DEFAULT_MAX_LAT) -> dict:
    """% con Sol y con Tierra según LOLA, por sitio y por cada mapa que lo cubre."""
    out = {}
    for s in south_pole_sites(sites, max_lat):
        maps = {}
        for m in LOLA_MAPS.values():
            if s["lat_deg"] > m["min_lat"]:
                continue
            maps[f"AVGVISIB_{m['name']}_201608"] = {
                "sun_pct": round(100 * read_lola_pixel(m, s["lat_deg"], s["lon_deg"]), 1),
                "earth_pct": round(100 * read_lola_pixel(m, s["lat_deg"], s["lon_deg"], earth=True), 1),
            }
        out[s["id"]] = maps
    return {
        "source": ("LOLA AVGVISIB_*_201608 y AVGVISIB_*_201608_EARTH (Mazarico et al. 2011), "
                   "http://imbrium.mit.edu/EXTRAS/ILLUMINATION/IMG/, período 2009-07-13 a 2013-07-18; "
                   "píxel del sitio, leído con precompute/terrain/illumination_check.py --lola"),
        "downloaded": date.today().isoformat(),
        "sites": out,
    }


def to_markdown(rows: list[dict], reference: dict | None = None) -> str:
    head = "| Sitio | Lat, lon | Mapa de relieve | Sol | Tierra | Ambos | Período |"
    sep = "|---|---|---|---|---|---|---|"
    if reference:
        head += " Sol LOLA | Tierra LOLA |"
        sep += "---|---|"
    lines = [head, sep]
    for r in rows:
        line = (f"| {r['site_id']} | {r['lat_deg']}, {r['lon_deg']} | {r['dem'] or 'sin relieve'} | "
                f"{r['sun_pct']:.1f} % | {r['earth_pct']:.1f} % | {r['both_pct']:.1f} % | "
                f"{r['start_utc'][:10]} a {r['end_utc'][:10]} ({r['days']} d) |")
        if reference:
            maps = reference["sites"].get(r["site_id"], {})
            line += " " + " / ".join(f"{v['sun_pct']:.1f} %" for v in maps.values()) + " |"
            line += " " + " / ".join(f"{v['earth_pct']:.1f} %" for v in maps.values()) + " |"
        lines.append(line)
    return "\n".join(lines)


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="% de tiempo con Sol y Tierra por sitio del polo sur (C5-07)")
    ap.add_argument("--sites", type=Path, default=PUBLIC / "sites.json")
    ap.add_argument("--sites-dir", type=Path, default=PUBLIC / "sites")
    ap.add_argument("--max-lat", type=float, default=DEFAULT_MAX_LAT)
    ap.add_argument("--lola", action="store_true", help=f"leer los mapas de LOLA y guardar {REFERENCE_PATH.name}")
    a = ap.parse_args(argv)
    sites = json.loads(a.sites.read_text(encoding="utf-8"))["sites"]
    reference = None
    if a.lola:
        reference = lola_reference(sites, a.max_lat)
        REFERENCE_PATH.write_text(json.dumps(reference, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print(f"Referencia guardada en {REFERENCE_PATH}")
    elif REFERENCE_PATH.exists():
        reference = json.loads(REFERENCE_PATH.read_text(encoding="utf-8"))
    print(to_markdown(summary(sites, a.sites_dir, a.max_lat), reference))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
