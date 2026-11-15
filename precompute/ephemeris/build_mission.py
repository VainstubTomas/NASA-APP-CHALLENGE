"""Genera data/public/sites/<id>/mission.json: efemérides alrededor del alunizaje de cada misión (ADR-019).

Para cada sitio con `landing_utc` en sites.json pide a JPL Horizons el Sol y la Tierra desde el sitio,
una muestra por hora, desde 3 días antes hasta 3 días después de la hora del alunizaje (redondeada hacia
abajo a la hora). El formato es el mismo de ephemeris.json (contrato v1.0): solo cambia la ventana.
Las respuestas quedan en data/raw/horizons/ (no se versiona), igual que en el resto de las efemérides.

Uso:
    python -m precompute.ephemeris.build_mission                 # todas las misiones
    python -m precompute.ephemeris.build_mission --site apollo-11
"""
from __future__ import annotations

import argparse
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

from precompute.ephemeris import horizons_client as hc
from precompute.ephemeris.build_ephemeris import (
    ANGULAR_RADIUS_DEG, DEFAULT_STEP_S, OUT_DIR, SITES_PATH, round_azimuth, round_elevation,
)

WINDOW_DAYS = 3  # días antes y después del alunizaje (ADR-019)
_ISO = "%Y-%m-%dT%H:%M:%SZ"


def mission_window(landing_utc: str, days: int = WINDOW_DAYS) -> tuple[str, str]:
    """(start_utc, stop_utc) de la ventana: la hora del alunizaje, `days` días antes y después, inclusivo.

    La web calcula lo mismo (web/src/state.js, missionWindow): las dos reglas deben coincidir.
    """
    t = datetime.strptime(landing_utc, _ISO).replace(tzinfo=timezone.utc, minute=0, second=0)
    return (t - timedelta(days=days)).strftime(_ISO), (t + timedelta(days=days)).strftime(_ISO)


def build_site_mission(site: dict, cache_dir: Path = hc.CACHE_DIR, session=None) -> dict:
    """Arma el contenido de mission.json de un sitio (consulta Horizons si no está en el caché)."""
    start_utc, stop_utc = mission_window(site["landing_utc"])
    series = {}
    for body in ("sun", "earth"):
        out = hc.get_az_el(site["lat_deg"], site["lon_deg"], body, start_utc, stop_utc, DEFAULT_STEP_S,
                           cache_dir=cache_dir, session=session)
        series[body] = {
            "azimuth_deg": [round_azimuth(a) for a in out["azimuth_deg"]],
            "elevation_deg": [round_elevation(e) for e in out["elevation_deg"]],
        }
        count = len(out["time_utc"])
    return {
        "schema_version": "1.0",
        "site_id": site["id"],
        "time": {"start_utc": start_utc, "step_s": DEFAULT_STEP_S, "count": count},
        "sun": series["sun"],
        "earth": series["earth"],
        "angular_radius_deg": dict(ANGULAR_RADIUS_DEG),
        "source": (
            f"JPL Horizons API ({hc.API_URL}), tabla de observador QUANTITIES=4 (azimut y elevación "
            f"aparentes, AIRLESS), centro coord@301 en lat {site['lat_deg']}, lon {site['lon_deg']} "
            f"(este-positiva); ventana de misión: {WINDOW_DAYS} días antes y después del alunizaje "
            f"({site['landing_utc']})"
        ),
    }


def build_all(sites: list[dict], only: str | None = None, cache_dir: Path = hc.CACHE_DIR,
              out_dir: Path = OUT_DIR) -> list[str]:
    """Escribe mission.json de cada sitio con `landing_utc` (o solo de `only`). Devuelve los ids escritos."""
    written = []
    for site in sites:
        if "landing_utc" not in site or (only and site["id"] != only):
            continue
        doc = build_site_mission(site, cache_dir=cache_dir)
        path = Path(out_dir) / site["id"] / "mission.json"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(doc, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
        written.append(site["id"])
        print(f"  {site['id']}: {doc['time']['start_utc']} ({doc['time']['count']} muestras)")
    return written


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Genera mission.json (ventana alrededor del alunizaje) por sitio")
    ap.add_argument("--sites", type=Path, default=SITES_PATH)
    ap.add_argument("--site", help="solo este id de sitio")
    ap.add_argument("--cache-dir", type=Path, default=hc.CACHE_DIR)
    ap.add_argument("--out-dir", type=Path, default=OUT_DIR)
    a = ap.parse_args(argv)

    sites = json.loads(a.sites.read_text(encoding="utf-8"))["sites"]
    written = build_all(sites, only=a.site, cache_dir=a.cache_dir, out_dir=a.out_dir)
    if not written:
        print("No se escribió ninguna misión (¿id inexistente o sin landing_utc?)")
        return 1
    print(f"Escritas: {len(written)} ({', '.join(written)})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
