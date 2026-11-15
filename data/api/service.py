"""Efemérides y horizonte en vivo de un sitio libre de la Luna (issue #104, ADR-015 y ADR-018).

Efemérides: reusa el cliente de Horizons ya validado (precompute/ephemeris/horizons_client.py, ADR-006) y
devuelve el mismo formato que ephemeris.json (docs/03-DATA-CONTRACT.md).
Horizonte: reusa el cálculo de los sitios precalculados (precompute/terrain/lola_horizon.py, #13 y #16) y
devuelve el mismo formato que horizon.json.
No inventa datos: si Horizons o el mapa LOLA fallan, levanta el error. Sin dependencias de FastAPI, para
poder probarlo y usarlo desde un script.
"""
from __future__ import annotations

import json
import threading
from datetime import datetime, timedelta, timezone
from pathlib import Path

import requests

from precompute.ephemeris import horizons_client as hc
from precompute.ephemeris.build_ephemeris import ANGULAR_RADIUS_DEG, round_azimuth, round_elevation
from precompute.terrain import lola_horizon as lh

STEP_S = 3600
# Mismo rango que los datos precalculados y que el selector de fecha de la web (DATA_END_MS).
RANGE_START = datetime(2026, 11, 1, 0, 0, tzinfo=timezone.utc)
RANGE_END = datetime(2027, 12, 31, 23, 0, tzinfo=timezone.utc)
MIN_DAYS, MAX_DAYS, DEFAULT_DAYS = 1, 14, 7
_ISO = "%Y-%m-%dT%H:%M:%SZ"


def parse_start(value: str) -> datetime:
    """Lee `start` (ISO 8601 en UTC, p. ej. 2026-11-30T06:00:00Z) y verifica que esté en el rango de datos."""
    try:
        t = datetime.strptime(value, _ISO).replace(tzinfo=timezone.utc)
    except (TypeError, ValueError):
        raise ValueError(f"Fecha inválida {value!r}: se espera UTC ISO 8601 como 2026-11-30T06:00:00Z")
    if not RANGE_START <= t <= RANGE_END:
        raise ValueError(
            f"La fecha {value} está fuera del rango de datos "
            f"({RANGE_START.strftime(_ISO)} a {RANGE_END.strftime(_ISO)})")
    return t


def site_id(lat_deg: float, lon_deg: float) -> str:
    """Id estable del sitio, válido para el esquema (^[a-z0-9]+(-[a-z0-9]+)*$): live-s89p5-e30p0."""
    def part(value, pos, neg):
        text = f"{abs(value):.6f}".rstrip("0")  # sin notación científica (1e-05 tendría un '-')
        text = text + "0" if text.endswith(".") else text
        return f"{pos if value >= 0 else neg}{text.replace('.', 'p')}"
    return f"live-{part(lat_deg, 'n', 's')}-{part(lon_deg, 'e', 'w')}"


def build_live_ephemeris(lat_deg: float, lon_deg: float, start: str, days: int = DEFAULT_DAYS,
                         session=None, cache_dir: Path = hc.CACHE_DIR) -> dict:
    """Arma el equivalente a ephemeris.json para (lat, lon) desde `start`, con `days` días a paso de 1 h.

    Si la ventana pasa del fin del rango de datos, se recorta. Levanta ValueError ante entradas inválidas
    y HorizonsError (o un error de requests) si Horizons falla.
    """
    if not -90 <= lat_deg <= 90:
        raise ValueError(f"Latitud fuera de rango [-90, 90]: {lat_deg}")
    if not -180 <= lon_deg <= 180:
        raise ValueError(f"Longitud fuera de rango [-180, 180]: {lon_deg}")
    if not MIN_DAYS <= days <= MAX_DAYS:
        raise ValueError(f"days fuera de rango [{MIN_DAYS}, {MAX_DAYS}]: {days}")
    t0 = parse_start(start)
    last = min(t0 + timedelta(seconds=STEP_S * (days * 24 - 1)), RANGE_END)
    start_utc, stop_utc = t0.strftime(_ISO), last.strftime(_ISO)

    series, downloaded = {}, set()
    for body in ("sun", "earth"):
        out = hc.get_az_el(lat_deg, lon_deg, body, start_utc, stop_utc, STEP_S,
                           cache_dir=cache_dir, session=session)
        series[body] = {
            "azimuth_deg": [round_azimuth(a) for a in out["azimuth_deg"]],
            "elevation_deg": [round_elevation(e) for e in out["elevation_deg"]],
        }
        for s, e in hc.split_range(start_utc, stop_utc, STEP_S):
            params = hc.build_params(lat_deg, lon_deg, body, s, e, STEP_S)
            entry = json.loads(hc._cache_path(params, cache_dir).read_text(encoding="utf-8"))
            downloaded.add(entry.get("downloaded_utc", "?"))
        count = len(out["time_utc"])

    return {
        "schema_version": "1.0",
        "site_id": site_id(lat_deg, lon_deg),
        "time": {"start_utc": start_utc, "step_s": STEP_S, "count": count},
        "sun": series["sun"],
        "earth": series["earth"],
        "angular_radius_deg": dict(ANGULAR_RADIUS_DEG),
        "source": (
            f"JPL Horizons API ({hc.API_URL}), tabla de observador QUANTITIES=4 (azimut y elevación "
            f"aparentes, AIRLESS), centro coord@301 en lat {lat_deg}, lon {lon_deg} "
            f"(este-positiva), consulta en vivo; descargado {', '.join(sorted(downloaded))}"
        ),
    }


# ------------------------------------------------------------------ horizonte en vivo (ADR-018)

# Hasta dónde llega el mapa global de 128 ppd: el recorte crece en longitud como 1/cos(lat) y más al
# norte de 85° pasa de unos 2200 píxeles de ancho (cerca del límite de exportImage). El sur no tiene
# este problema: desde -75,7° usa el mapa polar de 30 m.
GLOBAL_MAX_LAT = 85.0


class TerrainError(RuntimeError):
    """El mapa LOLA no se pudo bajar o leer para el sitio (no es un error de la entrada)."""


def has_dem_coverage(lat_deg: float) -> bool:
    """True si hay mapa LOLA para calcular el relieve: polar de 30 m al sur, global hasta GLOBAL_MAX_LAT."""
    return lh.uses_polar_dem(lat_deg) or lat_deg <= GLOBAL_MAX_LAT


def flat_horizon(site: str) -> dict:
    """Horizonte ideal (Luna lisa, ADR-011): 360 ceros y sin `dem`, como lo arma la web."""
    return {
        "schema_version": "1.0",
        "site_id": site,
        "azimuth_start_deg": 0,
        "azimuth_step_deg": 1,
        "elevation_deg": [0.0] * lh.N_AZIMUTHS,
    }


# Un candado por sitio: dos pedidos al mismo punto no bajan el mismo recorte a la vez.
_locks: dict[str, threading.Lock] = {}
_locks_guard = threading.Lock()


def _lock_for(site: str) -> threading.Lock:
    with _locks_guard:
        return _locks.setdefault(site, threading.Lock())


def build_live_horizon(lat_deg: float, lon_deg: float, raw_dir: Path = lh.RAW_DIR,
                       site_horizon=lh.site_horizon) -> dict:
    """Arma el equivalente a horizon.json para (lat, lon) con el mismo cálculo que los sitios guardados.

    El recorte del mapa queda en `raw_dir` (dem_<site_id>.tif o dem30_<site_id>.tif): el segundo pedido
    del mismo punto no vuelve a descargar. Sin mapa para esa latitud devuelve la Luna lisa (sin `dem`,
    la web muestra "horizonte ideal"). Levanta ValueError ante entradas inválidas, un error de requests
    si Moon Trek falla y TerrainError si el recorte no se puede leer.
    """
    if not -90 <= lat_deg <= 90:
        raise ValueError(f"Latitud fuera de rango [-90, 90]: {lat_deg}")
    if not -180 <= lon_deg <= 180:
        raise ValueError(f"Longitud fuera de rango [-180, 180]: {lon_deg}")
    sid = site_id(lat_deg, lon_deg)
    if not has_dem_coverage(lat_deg):
        return flat_horizon(sid)
    with _lock_for(sid):
        try:
            return site_horizon({"id": sid, "lat_deg": lat_deg, "lon_deg": lon_deg}, raw_dir=raw_dir)
        except requests.RequestException:
            raise  # Moon Trek no respondió: lo informa la API como 502 o 504
        except (ValueError, RuntimeError, OSError) as e:
            # Recorte que no es TIFF, ilegible o sin el sitio adentro: se borra para que el próximo pedido reintente.
            for name in (f"dem_{sid}.tif", f"dem30_{sid}.tif"):
                (Path(raw_dir) / name).unlink(missing_ok=True)
            raise TerrainError(str(e)) from e
