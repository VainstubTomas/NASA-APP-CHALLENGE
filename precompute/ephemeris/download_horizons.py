"""Descarga las efemérides de Horizons de todos los sitios y las deja en el caché (issue C0-13).

Una consulta por sitio y cuerpo (Sol y Tierra) para todo el rango, partida en tramos si pasa el
límite de filas de Horizons (lo resuelve `horizons_client.get_az_el`). Las respuestas crudas quedan
en data/raw/horizons/ (no versionado); correr de nuevo no repite lo ya descargado.

Uso:
    python -m precompute.ephemeris.download_horizons
    python -m precompute.ephemeris.download_horizons --include-synthetic
"""
from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

import requests

from precompute.ephemeris import horizons_client as hc

SITES_PATH = hc.ROOT / "data" / "public" / "sites.json"
# Rango del contrato (docs/03-DATA-CONTRACT.md): 120 días, una muestra por hora = 2880 muestras.
DEFAULT_START = "2026-11-01T00:00:00Z"
DEFAULT_STOP = "2027-02-28T23:00:00Z"
DEFAULT_STEP_S = 3600


def load_sites(path: Path = SITES_PATH, include_synthetic: bool = False) -> list[dict]:
    """Lee sites.json; por defecto omite el sitio sintético de desarrollo."""
    sites = json.loads(Path(path).read_text(encoding="utf-8"))["sites"]
    return [s for s in sites if include_synthetic or not s.get("synthetic")]


def _get_with_retry(site: dict, body: str, start_utc: str, stop_utc: str, step_s: int,
                    cache_dir: Path, session, retries: int, sleep) -> None:
    """Descarga (o lee del caché) un sitio y cuerpo; reintenta solo ante errores de red."""
    for attempt in range(1, retries + 1):
        try:
            hc.get_az_el(site["lat_deg"], site["lon_deg"], body, start_utc, stop_utc, step_s,
                         cache_dir=cache_dir, session=session)
            return
        except requests.RequestException:
            if attempt == retries:
                raise
            sleep(2 ** attempt)  # 2 s, 4 s, 8 s...


def download_all(sites: list[dict], start_utc: str = DEFAULT_START, stop_utc: str = DEFAULT_STOP,
                 step_s: int = DEFAULT_STEP_S, cache_dir: Path = hc.CACHE_DIR, session=None,
                 retries: int = 3, pause_s: float = 1.0, sleep=time.sleep) -> dict:
    """Descarga Sol y Tierra de cada sitio. No se corta si uno falla: lo anota y sigue."""
    ok, failed = [], []
    for site in sites:
        for body in sorted(hc.BODIES):
            item = {"site": site["id"], "body": body}
            try:
                _get_with_retry(site, body, start_utc, stop_utc, step_s, cache_dir, session, retries, sleep)
                ok.append(item)
            except (requests.RequestException, hc.HorizonsError, ValueError) as e:
                failed.append({**item, "error": str(e)[:300]})
            sleep(pause_s)  # no castigar a la API de JPL con ráfagas
    return {"ok": ok, "failed": failed}


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Descarga las efemérides de Horizons de todos los sitios al caché")
    ap.add_argument("--sites", type=Path, default=SITES_PATH)
    ap.add_argument("--start", default=DEFAULT_START, help="UTC, p. ej. 2026-11-01T00:00:00Z")
    ap.add_argument("--stop", default=DEFAULT_STOP, help="UTC, inclusivo")
    ap.add_argument("--step-s", type=int, default=DEFAULT_STEP_S)
    ap.add_argument("--cache-dir", type=Path, default=hc.CACHE_DIR)
    ap.add_argument("--include-synthetic", action="store_true", help="incluir el sitio sintético de desarrollo")
    a = ap.parse_args(argv)

    sites = load_sites(a.sites, a.include_synthetic)
    print(f"{len(sites)} sitios x {len(hc.BODIES)} cuerpos, {a.start} -> {a.stop}, caché en {a.cache_dir}")
    informe = download_all(sites, a.start, a.stop, a.step_s, cache_dir=a.cache_dir)
    print(f"OK: {len(informe['ok'])}  con error: {len(informe['failed'])}")
    for f in informe["failed"]:
        print(f"  FALLÓ {f['site']} / {f['body']}: {f['error']}")
    return 1 if informe["failed"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
