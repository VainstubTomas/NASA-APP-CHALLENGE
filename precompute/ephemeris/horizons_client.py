"""Cliente de la API de JPL Horizons: azimut y elevación del Sol y la Tierra desde un punto de la Luna.

Issue C0-04, ADR-006. Convenciones verificadas contra la respuesta de Horizons (ver ADR-006):
- Azimut: 0° = norte, sentido horario (Horizons: "Azimuth is measured clockwise from north").
- SITE_COORD: 'E-lon,lat,alt_km' con longitud este-positiva (encabezado "{E-lon(deg),Lat(deg),Alt(km)}").
- Latitud: la Luna se modela como esfera (radios 1737.4 km), así que la geodética coincide con la planetocéntrica.
- Tiempo: la columna "Date__(UT)" es UTC para fechas posteriores a 1962.
- Límite: 90000 instantes por consulta; si se pide más, Horizons devuelve error, no trunca.

Las respuestas crudas se guardan en data/raw/horizons/ (no versionado) con la consulta exacta
y la fecha de descarga, para no repetir consultas.

Uso manual (para comparar con la interfaz web de Horizons):
    python -m precompute.ephemeris.horizons_client --lat 0 --lon 30 --body earth \
        --start 2026-11-14T00:00:00Z --stop 2026-11-14T03:00:00Z
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path

import requests

API_URL = "https://ssd.jpl.nasa.gov/api/horizons.api"
BODIES = {"sun": "10", "earth": "399"}
MAX_ROWS_PER_QUERY = 90000  # medido el 2026-11-14: "Output length exceeded, ... max. is 90000"
ROOT = Path(__file__).resolve().parents[2]
CACHE_DIR = ROOT / "data" / "raw" / "horizons"

_ISO = "%Y-%m-%dT%H:%M:%SZ"
_MONTHS = {m: i for i, m in enumerate(
    ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], start=1)}
_ROW_TIME = re.compile(r"^(\d{4})-([A-Z][a-z]{2})-(\d{2}) (\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$")
_COORD_TOL_DEG = 1e-6


class HorizonsError(RuntimeError):
    """Horizons devolvió un error o una respuesta que no sabemos leer con seguridad."""


def _parse_iso(value: str) -> datetime:
    try:
        return datetime.strptime(value, _ISO).replace(tzinfo=timezone.utc)
    except (TypeError, ValueError):
        raise ValueError(f"Fecha UTC inválida {value!r}: se espera ISO 8601 como 2026-11-14T00:00:00Z")


def _fmt_iso(t: datetime) -> str:
    return t.strftime(_ISO)


def build_params(lat_deg: float, lon_deg: float, body: str, start_utc: str, stop_utc: str,
                 step_s: int = 3600) -> dict:
    """Arma la consulta de tabla de observador para un cuerpo visto desde (lat, lon) en la Luna.

    lat_deg: latitud planetocéntrica en grados, [-90, 90]. lon_deg: longitud este-positiva, [-180, 180].
    start_utc y stop_utc: ISO 8601 en UTC; stop es inclusivo. step_s: múltiplo de 60 segundos.
    """
    if body not in BODIES:
        raise ValueError(f"Cuerpo desconocido {body!r}: usar uno de {sorted(BODIES)}")
    if not -90 <= lat_deg <= 90:
        raise ValueError(f"Latitud fuera de rango: {lat_deg}")
    if not -180 <= lon_deg <= 180:
        raise ValueError(f"Longitud fuera de rango: {lon_deg}")
    if step_s <= 0 or step_s % 60:
        raise ValueError(f"step_s debe ser un múltiplo positivo de 60: {step_s}")
    start, stop = _parse_iso(start_utc), _parse_iso(stop_utc)
    if stop < start:
        raise ValueError(f"stop_utc ({stop_utc}) es anterior a start_utc ({start_utc})")
    return {
        "format": "json",
        "COMMAND": f"'{BODIES[body]}'",
        "OBJ_DATA": "'NO'",
        "MAKE_EPHEM": "'YES'",
        "EPHEM_TYPE": "'OBSERVER'",
        "CENTER": "'coord@301'",
        "COORD_TYPE": "'GEODETIC'",
        "SITE_COORD": f"'{float(lon_deg)},{float(lat_deg)},0'",
        "START_TIME": f"'{start:%Y-%m-%d %H:%M}'",
        "STOP_TIME": f"'{stop:%Y-%m-%d %H:%M}'",
        "STEP_SIZE": f"'{step_s // 60} m'",
        "QUANTITIES": "'4'",
        "ANG_FORMAT": "'DEG'",
        "APPARENT": "'AIRLESS'",
        "CSV_FORMAT": "'YES'",
        "TIME_TYPE": "'UT'",
    }


def _cache_path(params: dict, cache_dir: Path) -> Path:
    key = hashlib.sha256(json.dumps(params, sort_keys=True).encode()).hexdigest()[:16]
    label = "_".join(params[k].strip("'") for k in ("COMMAND", "SITE_COORD", "START_TIME"))
    label = re.sub(r"[^A-Za-z0-9.-]+", "_", label)
    return Path(cache_dir) / f"{label}_{key}.json"


def fetch(params: dict, cache_dir: Path = CACHE_DIR, session=None, timeout_s: float = 120) -> str:
    """Devuelve el texto `result` de Horizons para `params`, desde el caché si ya se descargó.

    Las respuestas con error no se guardan en el caché.
    """
    path = _cache_path(params, cache_dir)
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))["response"]["result"]

    http = session or requests
    resp = http.get(API_URL, params=params, timeout=timeout_s)
    resp.raise_for_status()
    payload = resp.json()
    if payload.get("error"):
        raise HorizonsError(f"Horizons respondió con error: {payload['error'].strip()[:500]}")
    if "$$SOE" not in payload.get("result", ""):
        raise HorizonsError("La respuesta de Horizons no trae tabla ($$SOE)")

    entry = {
        "query": params,
        "url": API_URL,
        "downloaded_utc": _fmt_iso(datetime.now(timezone.utc)),
        "response": payload,
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(entry, ensure_ascii=False), encoding="utf-8")
    tmp.replace(path)
    return payload["result"]


def _check_site(result: str, expect_lat_deg: float, expect_lon_deg: float) -> None:
    num = r"([-+\d.Ee]+)"  # Horizons a veces usa notación científica (p. ej. alt 2.1277E-13)
    m = re.search(rf"^Center geodetic\s*:\s*{num},\s*{num},\s*{num}\s*\{{([^}}]*)\}}",
                  result, re.MULTILINE)
    if not m:
        raise HorizonsError("No se encontró la línea 'Center geodetic' en el encabezado")
    lon, lat, units = float(m.group(1)), float(m.group(2)), m.group(4)
    if not units.startswith("E-lon"):
        raise HorizonsError(f"Horizons no usó longitud este-positiva: {{{units}}}")
    lon_diff = abs((lon - expect_lon_deg + 180) % 360 - 180)
    if lon_diff > _COORD_TOL_DEG or abs(lat - expect_lat_deg) > _COORD_TOL_DEG:
        raise HorizonsError(
            f"Horizons usó el sitio lon={lon}, lat={lat}; se esperaba lon={expect_lon_deg}, lat={expect_lat_deg}")


def _row_time(text: str) -> str:
    m = _ROW_TIME.match(text.strip())
    if not m or m.group(2) not in _MONTHS:
        raise HorizonsError(f"Fecha de Horizons no reconocida: {text!r}")
    y, mon, d, hh, mm, ss = m.groups()
    t = datetime(int(y), _MONTHS[mon], int(d), int(hh), int(mm), int(ss or 0), tzinfo=timezone.utc)
    return _fmt_iso(t)


def parse_result(result: str, expect_lat_deg: float, expect_lon_deg: float) -> dict:
    """Lee la tabla CSV de Horizons y devuelve tiempos UTC, azimut y elevación (grados).

    Ubica las columnas por su nombre en el encabezado y verifica que Horizons usó el sitio pedido.
    """
    if "$$SOE" not in result or "$$EOE" not in result:
        raise HorizonsError("La respuesta no trae tabla ($$SOE/$$EOE)")
    _check_site(result, expect_lat_deg, expect_lon_deg)

    before, rest = result.split("$$SOE", 1)
    table = rest.split("$$EOE", 1)[0]
    header_lines = [ln for ln in before.splitlines() if "Date__(" in ln]
    if not header_lines:
        raise HorizonsError("No se encontró el encabezado de columnas")
    cols = [c.strip() for c in header_lines[-1].split(",")]
    try:
        i_t = next(i for i, c in enumerate(cols) if c.startswith("Date__("))
        i_az, i_el = cols.index("Azi_(a-app)"), cols.index("Elev_(a-app)")
    except (StopIteration, ValueError):
        raise HorizonsError(f"Columnas inesperadas en la tabla de Horizons: {cols}")
    if not cols[i_t].startswith("Date__(UT)"):
        raise HorizonsError(f"La escala de tiempo no es UT/UTC: {cols[i_t]}")

    times, az, el = [], [], []
    for line in table.strip().splitlines():
        f = [x.strip() for x in line.split(",")]
        try:
            a, e = float(f[i_az]), float(f[i_el])
        except (IndexError, ValueError):
            raise HorizonsError(f"Fila de Horizons ilegible: {line!r}")
        if not (0 <= a <= 360 and -90 <= e <= 90):
            raise HorizonsError(f"Ángulo fuera de rango en la fila: {line!r}")
        times.append(_row_time(f[i_t]))
        az.append(a % 360.0)  # el contrato usa [0, 360)
        el.append(e)
    if not times:
        raise HorizonsError("La tabla de Horizons está vacía")
    return {"time_utc": times, "azimuth_deg": az, "elevation_deg": el}


def split_range(start_utc: str, stop_utc: str, step_s: int,
                max_rows: int = MAX_ROWS_PER_QUERY) -> list[tuple[str, str]]:
    """Parte [start, stop] (inclusivo) en tramos de como máximo `max_rows` instantes."""
    start, stop, step = _parse_iso(start_utc), _parse_iso(stop_utc), timedelta(seconds=step_s)
    chunks, s = [], start
    while s <= stop:
        e = min(s + step * (max_rows - 1), stop)
        chunks.append((_fmt_iso(s), _fmt_iso(e)))
        s = e + step
    return chunks


def get_az_el(lat_deg: float, lon_deg: float, body: str, start_utc: str, stop_utc: str,
              step_s: int = 3600, cache_dir: Path = CACHE_DIR, session=None) -> dict:
    """Azimut y elevación topocéntricos de `body` ('sun' o 'earth') desde (lat, lon) en la Luna.

    Devuelve {"time_utc": [...], "azimuth_deg": [...], "elevation_deg": [...]}, una muestra
    cada `step_s` segundos desde start_utc hasta stop_utc inclusive.
    """
    out = {"time_utc": [], "azimuth_deg": [], "elevation_deg": []}
    for s, e in split_range(start_utc, stop_utc, step_s):
        params = build_params(lat_deg, lon_deg, body, s, e, step_s)
        part = parse_result(fetch(params, cache_dir=cache_dir, session=session), lat_deg, lon_deg)
        for k in out:
            out[k].extend(part[k])

    t0 = _parse_iso(start_utc)
    expected = [_fmt_iso(t0 + timedelta(seconds=step_s * i)) for i in range(len(out["time_utc"]))]
    if out["time_utc"] != expected or out["time_utc"][-1] > stop_utc:
        raise HorizonsError("Los tiempos de Horizons no forman una serie regular desde start_utc")
    return out


def main(argv=None) -> None:
    ap = argparse.ArgumentParser(description="Azimut y elevación del Sol o la Tierra desde la Luna (JPL Horizons)")
    ap.add_argument("--lat", type=float, required=True, help="latitud planetocéntrica, grados")
    ap.add_argument("--lon", type=float, required=True, help="longitud este-positiva, grados")
    ap.add_argument("--body", choices=sorted(BODIES), required=True)
    ap.add_argument("--start", required=True, help="UTC, p. ej. 2026-11-14T00:00:00Z")
    ap.add_argument("--stop", required=True, help="UTC, inclusivo")
    ap.add_argument("--step-s", type=int, default=3600)
    a = ap.parse_args(argv)
    out = get_az_el(a.lat, a.lon, a.body, a.start, a.stop, a.step_s)
    print("time_utc,azimuth_deg,elevation_deg")
    for row in zip(out["time_utc"], out["azimuth_deg"], out["elevation_deg"]):
        print(f"{row[0]},{row[1]:.6f},{row[2]:.6f}")


if __name__ == "__main__":
    main()
