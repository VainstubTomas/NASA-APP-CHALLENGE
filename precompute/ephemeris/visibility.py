"""Regla de visibilidad del contrato (issue C2-03, ADR-002), hora por hora.

Un cuerpo es **visible** si el borde superior de su disco está sobre el horizonte en su azimut:
    elevación + radio > horizonte(azimut)
y **totalmente visible** si el disco entero lo está:
    elevación - radio > horizonte(azimut)
La desigualdad es estricta: con el borde justo en el horizonte no es visible.

El horizonte se interpola linealmente entre muestras y cierra el círculo (docs/03-DATA-CONTRACT.md).
La web implementa lo mismo en web/src/visibility.js (horizonAt en web/src/horizon.js); los casos compartidos están en
tests/fixtures/visibility_cases.json.
"""
from __future__ import annotations

BODIES = ("sun", "earth")


def horizon_at(horizon: dict, azimuth_deg: float) -> float:
    """Elevación del horizonte (grados) en un azimut cualquiera, interpolada y circular."""
    values = horizon["elevation_deg"]
    n = len(values)
    pos = ((azimuth_deg - horizon["azimuth_start_deg"]) / horizon["azimuth_step_deg"]) % n
    i = int(pos)
    frac = pos - i
    return values[i] * (1 - frac) + values[(i + 1) % n] * frac


def is_visible(elevation_deg: float, angular_radius_deg: float, horizon_deg: float) -> bool:
    return elevation_deg + angular_radius_deg > horizon_deg


def is_fully_visible(elevation_deg: float, angular_radius_deg: float, horizon_deg: float) -> bool:
    return elevation_deg - angular_radius_deg > horizon_deg


def visibility_series(ephemeris: dict, horizon: dict) -> dict:
    """Visibilidad de cada cuerpo en cada muestra de `ephemeris`.

    Devuelve {"sun": {"visible": [bool...], "fully_visible": [bool...]}, "earth": {...}}.
    """
    if ephemeris["site_id"] != horizon["site_id"]:
        raise ValueError(f"El sitio no coincide: {ephemeris['site_id']} (efemérides) vs {horizon['site_id']} (horizonte)")
    out = {}
    for body in BODIES:
        azimuths = ephemeris[body]["azimuth_deg"]
        elevations = ephemeris[body]["elevation_deg"]
        radius = ephemeris["angular_radius_deg"][body]
        horizons = [horizon_at(horizon, az) for az in azimuths]
        out[body] = {
            "visible": [is_visible(el, radius, h) for el, h in zip(elevations, horizons)],
            "fully_visible": [is_fully_visible(el, radius, h) for el, h in zip(elevations, horizons)],
        }
    return out


def series_summary(series: dict) -> dict:
    """Resumen comparable entre Python y la web: conteos de horas y primeras 48 muestras del Sol."""
    return {
        "samples": len(series["sun"]["visible"]),
        "sun_visible_hours": sum(series["sun"]["visible"]),
        "sun_fully_visible_hours": sum(series["sun"]["fully_visible"]),
        "earth_visible_hours": sum(series["earth"]["visible"]),
        "earth_fully_visible_hours": sum(series["earth"]["fully_visible"]),
        "sun_first_48h": "".join("1" if v else "0" for v in series["sun"]["visible"][:48]),
    }
