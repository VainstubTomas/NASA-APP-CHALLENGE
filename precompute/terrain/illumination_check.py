"""Porcentaje de tiempo con Sol y con Tierra por sitio del polo sur (issue C5-07, #51).

Sirve para validar a grandes rasgos el horizonte con relieve (C5-06, #16) contra la capa de
iluminación media de LOLA que muestra Quickmap. Quickmap no permite exportar esa capa, así que la
comparación es a ojo: este script imprime nuestra parte de la tabla, para que se pueda repetir.

No calcula nada nuevo: las horas salen de metrics.json (C3-01), que ya compara cada cuerpo contra el
horizonte. Porcentaje = horas con el cuerpo visible / horas totales del período (count * step_s).

Límites de la comparación: metrics.json cubre solo su período (unos 120 días), mientras que la capa de
Quickmap promedia muchos años; y nuestro horizonte llega a 20 km. Se espera una coincidencia de orden
de magnitud y en el orden de los sitios, no el mismo número.

Uso:
    python -m precompute.terrain.illumination_check
    python -m precompute.terrain.illumination_check --max-lat -75
"""
from __future__ import annotations

import argparse
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PUBLIC = ROOT / "data" / "public"
DEFAULT_MAX_LAT = -60.0  # "polo sur" para esta tabla: Chandrayaan-3 (-69,4°) entra
_ISO = "%Y-%m-%dT%H:%M:%SZ"


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


def to_markdown(rows: list[dict]) -> str:
    head = "| Sitio | Lat, lon | Mapa de relieve | Sol | Tierra | Ambos | Período |\n|---|---|---|---|---|---|---|"
    lines = [
        f"| {r['site_id']} | {r['lat_deg']}, {r['lon_deg']} | {r['dem'] or 'sin relieve'} | "
        f"{r['sun_pct']:.1f} % | {r['earth_pct']:.1f} % | {r['both_pct']:.1f} % | "
        f"{r['start_utc'][:10]} a {r['end_utc'][:10]} ({r['days']} d) |"
        for r in rows
    ]
    return "\n".join([head, *lines])


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="% de tiempo con Sol y Tierra por sitio del polo sur (C5-07)")
    ap.add_argument("--sites", type=Path, default=PUBLIC / "sites.json")
    ap.add_argument("--sites-dir", type=Path, default=PUBLIC / "sites")
    ap.add_argument("--max-lat", type=float, default=DEFAULT_MAX_LAT)
    a = ap.parse_args(argv)
    sites = json.loads(a.sites.read_text(encoding="utf-8"))["sites"]
    print(to_markdown(summary(sites, a.sites_dir, a.max_lat)))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
