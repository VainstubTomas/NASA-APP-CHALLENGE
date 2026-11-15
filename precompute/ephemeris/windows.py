"""Mejores ventanas de aterrizaje por sitio (issue C5-03, #45).

Una ventana es un rango de días UTC consecutivos. Se ordena por horas de Sol y, en empate, por horas
de Tierra visible (el orden del ADR-014). La web ya no lo usa para elegir un escenario (ADR-017): acá solo
ordena ventanas, no da un veredicto. Las horas salen de metrics.json (C3-01), así
que la suma de la ventana coincide con las métricas diarias por construcción.

Solo se listan ventanas que empiezan desde `--desde` (por defecto, el inicio de hoy en UTC): no sirve
recomendar una ventana que ya pasó. Con muchos días llenos de Sol y de Tierra hay empates; entre ventanas
iguales se muestra primero la más temprana.

Uso:
    python -m precompute.ephemeris.windows --site apollo-11 --days 7 --top 3
    python -m precompute.ephemeris.windows --site apollo-11 --desde 2026-12-01T00:00:00Z
"""
from __future__ import annotations

import argparse
import json
import math
from datetime import datetime, timedelta, timezone
from pathlib import Path

from precompute.ephemeris.horizons_client import ROOT

SITES_DIR = ROOT / "data" / "public" / "sites"
DAY_S = 86400
_ISO = "%Y-%m-%dT%H:%M:%SZ"


def _parse_utc(value: str) -> datetime:
    """ISO 8601 en UTC (2026-11-15T00:00:00Z) o solo la fecha (2026-11-15)."""
    for fmt in (_ISO, "%Y-%m-%d"):
        try:
            return datetime.strptime(value, fmt).replace(tzinfo=timezone.utc)
        except (TypeError, ValueError):
            continue
    raise ValueError(f"Fecha inválida {value!r}: se espera UTC ISO 8601 como 2026-11-15T00:00:00Z")


def first_index_since(metrics: dict, since_utc: str | None) -> int:
    """Primer día de metrics.json que empieza en `since_utc` o después (0 si no hay filtro o es anterior)."""
    if since_utc is None:
        return 0
    start = _parse_utc(metrics["time"]["start_utc"])
    return max(0, math.ceil((_parse_utc(since_utc) - start).total_seconds() / DAY_S))


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


def best_windows(metrics: dict, days: int = 7, top: int = 3, since_utc: str | None = None) -> list[dict]:
    """Las `top` mejores ventanas que no se superponen, de mejor a peor.

    Solo cuentan las que empiezan en `since_utc` o después. Puede devolver menos de `top` (o ninguna).
    """
    if top < 1:
        raise ValueError(f"top debe ser 1 o más: {top}")
    first = first_index_since(metrics, since_utc)
    ranked = sorted((w for w in sliding_windows(metrics["daily"], days) if w["start_index"] >= first),
                    key=lambda w: (w["sun_hours"], w["earth_hours"]), reverse=True)
    chosen: list[dict] = []
    for w in ranked:
        if len(chosen) == top:
            break
        if all(w["start_index"] + days <= c["start_index"] or c["start_index"] + days <= w["start_index"] for c in chosen):
            chosen.append(w)
    return chosen


def window_start_utc(metrics: dict, window: dict) -> str:
    """Fecha UTC (ISO 8601) del primer día de la ventana."""
    start = _parse_utc(metrics["time"]["start_utc"])
    return (start + timedelta(days=window["start_index"])).strftime(_ISO)


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Mejores ventanas de días consecutivos por sitio (C5-03)")
    ap.add_argument("--site", required=True, help="id del sitio, p. ej. apollo-11")
    ap.add_argument("--days", type=int, default=7)
    ap.add_argument("--top", type=int, default=3)
    ap.add_argument("--desde", default=None, help="solo ventanas que empiezan desde esta fecha UTC (por defecto, hoy)")
    ap.add_argument("--sites-dir", type=Path, default=SITES_DIR)
    a = ap.parse_args(argv)
    path = a.sites_dir / a.site / "metrics.json"
    if not path.exists():
        print(f"ERROR: falta {path}: generarlo con build_metrics (C3-01)")
        return 1
    metrics = json.loads(path.read_text(encoding="utf-8"))
    try:
        desde = a.desde or datetime.now(timezone.utc).strftime("%Y-%m-%dT00:00:00Z")
        ventanas = best_windows(metrics, days=a.days, top=a.top, since_utc=desde)
    except ValueError as e:
        print(f"ERROR: {e}")
        return 1
    if not ventanas:
        print(f"ERROR: no hay ventanas de {a.days} días que empiecen desde {desde} dentro de metrics.json")
        return 1
    for i, w in enumerate(ventanas, 1):
        print(f"{i}. {window_start_utc(metrics, w)} + {w['days']} días: Sol {w['sun_hours']} h, Tierra {w['earth_hours']} h")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
