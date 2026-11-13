#!/usr/bin/env python3
"""Genera datos SINTÉTICOS para desarrollo del frontend (no son datos reales de la Luna).

Crea en data/public/:
  - sites.json (con un único sitio de demostración marcado synthetic: true)
  - sites/demo-sintetico/{horizon,ephemeris,metrics}.json

Sirve para que la web arranque antes de que el backend entregue datos reales, y para
probar el contrato. Antes de la entrega hay que eliminar el sitio sintético.

Uso: python scripts/make_synthetic_data.py
"""
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "public"
SITE_ID = "demo-sintetico"

START_UTC = "2026-11-01T00:00:00Z"
STEP_S = 3600
COUNT = 24 * 120  # 120 días, una muestra por hora
SUN_R, EARTH_R = 0.25, 1.0  # radios angulares nominales (grados)


def horizon_at(horizon, az, az_start=0.0, step=1.0):
    """Elevación del horizonte en un azimut, con interpolación lineal y cierre del círculo."""
    n = len(horizon)
    pos = ((az - az_start) / step) % n
    i0 = int(math.floor(pos)) % n
    i1 = (i0 + 1) % n
    f = pos - math.floor(pos)
    return horizon[i0] * (1 - f) + horizon[i1] * f


def visible(el, az, radius, horizon):
    """Regla provisional del contrato: visible si el borde superior supera el horizonte."""
    return el + radius > horizon_at(horizon, az)


def build_horizon():
    values = []
    for az in range(360):
        h = 1.2 + 1.0 * math.sin(math.radians(az * 2 + 30)) + 0.6 * math.sin(math.radians(az * 5))
        h += 2.5 * math.exp(-((az - 140) ** 2) / (2 * 8**2))  # una "montaña" cerca de 140°
        values.append(round(max(h, 0.0), 3))
    return values


def build_ephemeris():
    sun_az, sun_el, earth_az, earth_el = [], [], [], []
    for i in range(COUNT):
        t = i  # horas desde el inicio
        sun_az.append(round((20 + 360 * t / (29.53 * 24)) % 360, 3))
        sun_el.append(round(0.5 + 1.2 * math.sin(2 * math.pi * t / (365.25 * 24)) + 0.8 * math.sin(2 * math.pi * t / (29.53 * 24)), 3))
        phase = 2 * math.pi * t / (27.32 * 24)
        earth_az.append(round((100 + 12 * math.sin(phase)) % 360, 3))
        earth_el.append(round(2.5 + 3.0 * math.sin(phase + 1.0), 3))
    return sun_az, sun_el, earth_az, earth_el


def main():
    horizon = build_horizon()
    sun_az, sun_el, earth_az, earth_el = build_ephemeris()

    sun_vis = [visible(e, a, SUN_R, horizon) for e, a in zip(sun_el, sun_az)]
    earth_vis = [visible(e, a, EARTH_R, horizon) for e, a in zip(earth_el, earth_az)]

    days = COUNT // 24
    sun_h, earth_h, both_h = [], [], []
    for d in range(days):
        sl = slice(d * 24, (d + 1) * 24)
        s, e = sun_vis[sl], earth_vis[sl]
        sun_h.append(float(sum(s)))
        earth_h.append(float(sum(e)))
        both_h.append(float(sum(1 for x, y in zip(s, e) if x and y)))

    site_dir = OUT / "sites" / SITE_ID
    site_dir.mkdir(parents=True, exist_ok=True)

    sites = {
        "schema_version": "1.0",
        "sites": [
            {
                "id": SITE_ID,
                "name": "Sitio de demostración (datos sintéticos)",
                "lat_deg": -89.5,
                "lon_deg": 0.0,
                "source": "Dato inventado para desarrollo",
                "source_url": "",
                "synthetic": True,
            }
        ],
    }
    horizon_doc = {
        "schema_version": "1.0",
        "site_id": SITE_ID,
        "azimuth_start_deg": 0,
        "azimuth_step_deg": 1,
        "elevation_deg": horizon,
        "max_distance_km": 150,
        "observer_height_m": 0,
        "dem": {"name": "SINTETICO", "pixel_m": 80},
    }
    ephemeris_doc = {
        "schema_version": "1.0",
        "site_id": SITE_ID,
        "time": {"start_utc": START_UTC, "step_s": STEP_S, "count": COUNT},
        "sun": {"azimuth_deg": sun_az, "elevation_deg": sun_el},
        "earth": {"azimuth_deg": earth_az, "elevation_deg": earth_el},
        "angular_radius_deg": {"sun": SUN_R, "earth": EARTH_R},
        "source": "SINTETICO: no son efemérides reales",
    }
    metrics_doc = {
        "schema_version": "1.0",
        "site_id": SITE_ID,
        "time": {"start_utc": START_UTC, "step_s": 86400, "count": days},
        "daily": {"sun_hours": sun_h, "earth_hours": earth_h, "both_hours": both_h},
    }

    def dump(path, doc):
        path.write_text(json.dumps(doc, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")

    dump(OUT / "sites.json", sites)
    dump(site_dir / "horizon.json", horizon_doc)
    dump(site_dir / "ephemeris.json", ephemeris_doc)
    dump(site_dir / "metrics.json", metrics_doc)
    print(f"Datos sintéticos escritos en {OUT}")
    print(f"Horas de Sol visibles en {days} días: {sum(sun_h):.0f} | Tierra: {sum(earth_h):.0f}")


if __name__ == "__main__":
    main()
