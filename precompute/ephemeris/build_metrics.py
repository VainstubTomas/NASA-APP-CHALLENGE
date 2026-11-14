"""Genera data/public/sites/<id>/metrics.json para todos los sitios (issue C3-01, #34).

Horas por día UTC con el Sol visible, la Tierra visible y ambos a la vez (docs/03-DATA-CONTRACT.md).
Lee los ephemeris.json (C1-01) y horizon.json (C2-01) ya generados en data/public/sites/ y aplica la
regla de visibilidad compartida con la web (precompute/ephemeris/visibility.py, C2-03): visible si el
borde superior del disco está sobre el horizonte en su azimut. No usa la red.

Uso:
    python -m precompute.ephemeris.build_metrics
"""
from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

from precompute.ephemeris import visibility as vis
from precompute.ephemeris.horizons_client import ROOT

SITES_PATH = ROOT / "data" / "public" / "sites.json"
SITES_DIR = ROOT / "data" / "public" / "sites"
DAY_S = 86400


def _check_daily_grid(time: dict) -> int:
    """Muestras por día. La serie tiene que formar días UTC completos desde medianoche."""
    step = time["step_s"]
    if DAY_S % step:
        raise ValueError(f"step_s={step} no divide el día ({DAY_S} s): no se pueden sumar horas por día")
    start = datetime.strptime(time["start_utc"], "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
    if (start.hour, start.minute, start.second) != (0, 0, 0):
        raise ValueError(f"start_utc={time['start_utc']} no empieza a las 00:00 UTC: los días quedarían corridos")
    per_day = DAY_S // step
    if time["count"] % per_day:
        raise ValueError(f"count={time['count']} con paso {step} s no forma días completos ({per_day} muestras por día)")
    return per_day


def _hours_per_day(flags: list[bool], per_day: int, step_s: int) -> list[float]:
    hours_per_sample = step_s / 3600
    return [
        round(sum(flags[i:i + per_day]) * hours_per_sample, 3)
        for i in range(0, len(flags), per_day)
    ]


def build_site_metrics(ephemeris: dict, horizon: dict) -> dict:
    """Contenido de metrics.json de un sitio a partir de sus efemérides y su horizonte."""
    time = ephemeris["time"]
    per_day = _check_daily_grid(time)
    series = vis.visibility_series(ephemeris, horizon)  # misma regla que la web
    sun = series["sun"]["visible"]
    earth = series["earth"]["visible"]
    both = [s and e for s, e in zip(sun, earth)]
    return {
        "schema_version": "1.0",
        "site_id": ephemeris["site_id"],
        "time": {"start_utc": time["start_utc"], "step_s": DAY_S, "count": time["count"] // per_day},
        "daily": {
            "sun_hours": _hours_per_day(sun, per_day, time["step_s"]),
            "earth_hours": _hours_per_day(earth, per_day, time["step_s"]),
            "both_hours": _hours_per_day(both, per_day, time["step_s"]),
        },
    }


def _read(path: Path) -> dict:
    if not path.exists():
        raise FileNotFoundError(f"Falta {path}: generarlo antes (ephemeris: C1-01, horizon.json: C2-01)")
    return json.loads(path.read_text(encoding="utf-8"))


def build_all(sites: list[dict], sites_dir: Path = SITES_DIR, out_dir: Path = SITES_DIR) -> dict:
    """Escribe metrics.json de cada sitio real; los sintéticos se dejan como están."""
    written, skipped = [], []
    for site in sites:
        if site.get("synthetic"):
            skipped.append(site["id"])
            continue
        folder = Path(sites_dir) / site["id"]
        doc = build_site_metrics(_read(folder / "ephemeris.json"), _read(folder / "horizon.json"))
        path = Path(out_dir) / site["id"] / "metrics.json"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(doc, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
        written.append(site["id"])
    return {"written": written, "skipped_synthetic": skipped}


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Genera metrics.json (horas por día de Sol, Tierra y ambos) por sitio")
    ap.add_argument("--sites", type=Path, default=SITES_PATH)
    ap.add_argument("--sites-dir", type=Path, default=SITES_DIR)
    a = ap.parse_args(argv)
    sites = json.loads(a.sites.read_text(encoding="utf-8"))["sites"]
    try:
        informe = build_all(sites, sites_dir=a.sites_dir, out_dir=a.sites_dir)
    except (FileNotFoundError, ValueError) as e:
        print(f"ERROR: {e}")
        return 1
    print(f"Escritos: {len(informe['written'])} ({', '.join(informe['written'])})")
    print(f"Sintéticos sin tocar: {', '.join(informe['skipped_synthetic']) or 'ninguno'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
