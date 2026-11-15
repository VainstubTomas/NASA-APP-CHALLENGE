"""Genera data/public/sites/<id>/ephemeris.json para todos los sitios (issue C1-01).

Lee solo el caché de Horizons de data/raw/horizons/ (descargado en C0-13 con
`python -m precompute.ephemeris.download_horizons`): no consulta la API. Si falta un dato,
falla con un mensaje claro en vez de descargarlo. Formato: contrato v1.0
(docs/03-DATA-CONTRACT.md, data/schema/ephemeris.schema.json).

Uso:
    python -m precompute.ephemeris.build_ephemeris
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from precompute.ephemeris import horizons_client as hc

SITES_PATH = hc.ROOT / "data" / "public" / "sites.json"
OUT_DIR = hc.ROOT / "data" / "public" / "sites"
# Mismo rango que la descarga de C0-13 (download_horizons): 426 días, una muestra por hora.
DEFAULT_START = "2026-11-01T00:00:00Z"
DEFAULT_STOP = "2027-12-31T23:00:00Z"
DEFAULT_STEP_S = 3600
# Radios angulares nominales del contrato v1 (Sol ~0,5° de diámetro, Tierra ~2°).
ANGULAR_RADIUS_DEG = {"sun": 0.25, "earth": 1.0}
DECIMALS = 3  # precisión máxima del contrato


class MissingCacheError(RuntimeError):
    """Falta una respuesta de Horizons en el caché local."""


class _OfflineSession:
    """Sesión que nunca sale a la red: el cliente solo la usa si el dato no está en el caché."""

    def get(self, url, params=None, **kwargs):
        raise MissingCacheError(
            f"Falta en el caché de Horizons: cuerpo {params.get('COMMAND')}, sitio {params.get('SITE_COORD')}, "
            f"{params.get('START_TIME')} a {params.get('STOP_TIME')}. Descargarlo con "
            "`python -m precompute.ephemeris.download_horizons` (o bajar el zip del caché del equipo)."
        )


def round_azimuth(value: float) -> float:
    """Redondea a 3 decimales y lo deja en [0, 360): 359,9996 pasaría a 360,0 sin el módulo."""
    return round(value, DECIMALS) % 360.0


def round_elevation(value: float) -> float:
    rounded = round(value, DECIMALS)
    return 0.0 if rounded == 0 else rounded  # evita -0.0


def _downloaded_utc(site: dict, body: str, start_utc: str, stop_utc: str, step_s: int, cache_dir: Path) -> list[str]:
    """Fechas de descarga de las respuestas usadas (para documentar la fuente)."""
    dates = []
    for s, e in hc.split_range(start_utc, stop_utc, step_s):
        params = hc.build_params(site["lat_deg"], site["lon_deg"], body, s, e, step_s)
        entry = json.loads(hc._cache_path(params, cache_dir).read_text(encoding="utf-8"))
        dates.append(entry.get("downloaded_utc", "?"))
    return dates


def build_site_ephemeris(site: dict, start_utc: str = DEFAULT_START, stop_utc: str = DEFAULT_STOP,
                         step_s: int = DEFAULT_STEP_S, cache_dir: Path = hc.CACHE_DIR) -> dict:
    """Arma el contenido de ephemeris.json de un sitio desde el caché, sin red."""
    series, downloaded = {}, set()
    for body in ("sun", "earth"):
        out = hc.get_az_el(site["lat_deg"], site["lon_deg"], body, start_utc, stop_utc, step_s,
                           cache_dir=cache_dir, session=_OfflineSession())
        series[body] = {
            "azimuth_deg": [round_azimuth(a) for a in out["azimuth_deg"]],
            "elevation_deg": [round_elevation(e) for e in out["elevation_deg"]],
        }
        count = len(out["time_utc"])
        downloaded.update(_downloaded_utc(site, body, start_utc, stop_utc, step_s, cache_dir))

    return {
        "schema_version": "1.0",
        "site_id": site["id"],
        "time": {"start_utc": start_utc, "step_s": step_s, "count": count},
        "sun": series["sun"],
        "earth": series["earth"],
        "angular_radius_deg": dict(ANGULAR_RADIUS_DEG),
        "source": (
            f"JPL Horizons API ({hc.API_URL}), tabla de observador QUANTITIES=4 (azimut y elevación "
            f"aparentes, AIRLESS), centro coord@301 en lat {site['lat_deg']}, lon {site['lon_deg']} "
            f"(este-positiva); descargado {', '.join(sorted(downloaded))}"
        ),
    }


def build_all(sites: list[dict], start_utc: str = DEFAULT_START, stop_utc: str = DEFAULT_STOP,
              step_s: int = DEFAULT_STEP_S, cache_dir: Path = hc.CACHE_DIR, out_dir: Path = OUT_DIR) -> dict:
    """Escribe ephemeris.json de cada sitio real; los sintéticos se dejan como están."""
    written, skipped = [], []
    for site in sites:
        if site.get("synthetic"):
            skipped.append(site["id"])
            continue
        doc = build_site_ephemeris(site, start_utc, stop_utc, step_s, cache_dir)
        path = Path(out_dir) / site["id"] / "ephemeris.json"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(doc, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
        written.append(site["id"])
    return {"written": written, "skipped_synthetic": skipped}


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Genera ephemeris.json por sitio desde el caché de Horizons (sin red)")
    ap.add_argument("--sites", type=Path, default=SITES_PATH)
    ap.add_argument("--cache-dir", type=Path, default=hc.CACHE_DIR)
    ap.add_argument("--out-dir", type=Path, default=OUT_DIR)
    a = ap.parse_args(argv)

    sites = json.loads(a.sites.read_text(encoding="utf-8"))["sites"]
    try:
        informe = build_all(sites, cache_dir=a.cache_dir, out_dir=a.out_dir)
    except MissingCacheError as e:
        print(f"ERROR: {e}")
        return 1
    print(f"Escritos: {len(informe['written'])} ({', '.join(informe['written'])})")
    print(f"Sintéticos sin tocar: {', '.join(informe['skipped_synthetic']) or 'ninguno'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
