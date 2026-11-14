"""Horizonte plano de todos los sitios: Luna lisa, 360 ceros y sin `dem` (issue C2-01, ADR-011).

Escribe data/public/sites/<id>/horizon.json con el mismo formato que tendrá el relieve real, para
que la web lea siempre el mismo archivo y, cuando llegue el relieve (capa 5), solo cambien los datos.
El sitio sintético de desarrollo no se toca: su horizon.json tiene un relieve inventado a propósito.

Uso:
    python -m precompute.terrain.flat_horizon
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SITES_PATH = ROOT / "data" / "public" / "sites.json"
SITES_DIR = ROOT / "data" / "public" / "sites"
SCHEMA_VERSION = "1.0"
N_AZIMUTHS = 360


def build_flat_horizon(site_id: str) -> dict:
    """Perfil de horizonte ideal: elevación 0° en cada azimut entero de 0 a 359 (sin campo `dem`)."""
    return {
        "schema_version": SCHEMA_VERSION,
        "site_id": site_id,
        "azimuth_start_deg": 0,
        "azimuth_step_deg": 1,
        "elevation_deg": [0] * N_AZIMUTHS,
    }


def write_all(sites: list[dict], out_dir: Path = SITES_DIR, include_synthetic: bool = False) -> list[Path]:
    """Escribe `<out_dir>/<id>/horizon.json` por sitio y devuelve las rutas escritas."""
    written = []
    for site in sites:
        if site.get("synthetic") and not include_synthetic:
            continue
        path = Path(out_dir) / site["id"] / "horizon.json"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(build_flat_horizon(site["id"])) + "\n", encoding="utf-8")
        written.append(path)
    return written


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Genera el horizon.json plano (360 ceros) de todos los sitios")
    ap.add_argument("--sites", type=Path, default=SITES_PATH)
    ap.add_argument("--out-dir", type=Path, default=SITES_DIR)
    ap.add_argument("--include-synthetic", action="store_true",
                    help="también pisa el horizon.json del sitio sintético (pierde su relieve inventado)")
    a = ap.parse_args(argv)
    sites = json.loads(a.sites.read_text(encoding="utf-8"))["sites"]
    written = write_all(sites, a.out_dir, a.include_synthetic)
    print(f"{len(written)} horizon.json escritos en {a.out_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
