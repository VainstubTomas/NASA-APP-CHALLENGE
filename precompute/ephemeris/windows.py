"""Mejores ventanas de aterrizaje por sitio (issue C5-03, #45).

Una ventana es un rango de días UTC consecutivos. Se ordena por horas de Sol y, en empate, por horas
de Tierra visible (mismo criterio que ADR-014 en la web). Las horas salen de metrics.json (C3-01), así
que la suma de la ventana coincide con las métricas diarias por construcción.

Uso:
    python -m precompute.ephemeris.windows --site apollo-11 --days 7 --top 3
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from precompute.ephemeris.horizons_client import ROOT

SITES_DIR = ROOT / "data" / "public" / "sites"


def sliding_windows(daily: dict, days: int) -> list[dict]:
    """Todas las ventanas de `days` días consecutivos, con sus horas de Sol y de Tierra."""
    n = len(daily["sun_hours"])
    if days < 1 or days > n:
        raise ValueError(f"days={days} fuera de rango: hay {n} días en metrics.json")
    out = []
    for start in range(n - days + 1):
        sun = sum(daily["sun_hours"][start:start + days])
        earth = sum(daily["earth_hours"][start:start + days])
        out.append({"start_index": start, "days": days, "sun_hours": round(sun, 3), "earth_hours": round(earth, 3)})
    return out


def best_windows(metrics: dict, days: int = 7, top: int = 3) -> list[dict]:
    """Las `top` mejores ventanas que no se superponen, de mejor a peor."""
    ranked = sorted(sliding_windows(metrics["daily"], days), key=lambda w: (w["sun_hours"], w["earth_hours"]), reverse=True)
    chosen: list[dict] = []
    for w in ranked:
        if len(chosen) == top:
            break
        if all(w["start_index"] + days <= c["start_index"] or c["start_index"] + days <= w["start_index"] for c in chosen):
            chosen.append(w)
    return chosen


def window_start_utc(metrics: dict, window: dict) -> str:
    """Fecha UTC (ISO 8601) del primer día de la ventana."""
    from datetime import datetime, timedelta, timezone

    start = datetime.strptime(metrics["time"]["start_utc"], "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
    return (start + timedelta(days=window["start_index"])).strftime("%Y-%m-%dT%H:%M:%SZ")


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Mejores ventanas de días consecutivos por sitio (C5-03)")
    ap.add_argument("--site", required=True, help="id del sitio, p. ej. apollo-11")
    ap.add_argument("--days", type=int, default=7)
    ap.add_argument("--top", type=int, default=3)
    ap.add_argument("--sites-dir", type=Path, default=SITES_DIR)
    a = ap.parse_args(argv)
    path = a.sites_dir / a.site / "metrics.json"
    if not path.exists():
        print(f"ERROR: falta {path}: generarlo con build_metrics (C3-01)")
        return 1
    metrics = json.loads(path.read_text(encoding="utf-8"))
    try:
        ventanas = best_windows(metrics, days=a.days, top=a.top)
    except ValueError as e:
        print(f"ERROR: {e}")
        return 1
    for i, w in enumerate(ventanas, 1):
        print(f"{i}. {window_start_utc(metrics, w)} + {w['days']} días: Sol {w['sun_hours']} h, Tierra {w['earth_hours']} h")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
