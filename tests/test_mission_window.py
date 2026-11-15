"""Ventanas de misión (ADR-019): mission.json de cada sitio con `landing_utc`.

- Cumplen el contrato (ephemeris.schema.json) y la ventana de 3 días antes y después del alunizaje.
- Para las 6 misiones Apolo, Sol y Tierra a la hora del alunizaje coinciden con la tabla independiente
  de Scotti (Apollo Lunar Surface Journal, NASA), que usa el Nautical Almanac y no Horizons.
"""
from datetime import datetime, timedelta, timezone

import pytest

from precompute.ephemeris.build_mission import WINDOW_DAYS, mission_window
from tests.helpers import PUBLIC, _assert_valid, _load

SITES = _load(PUBLIC / "sites.json")["sites"]
MISSIONS = [s for s in SITES if "landing_utc" in s]
_ISO = "%Y-%m-%dT%H:%M:%SZ"


def _utc(text):
    return datetime.strptime(text, _ISO).replace(tzinfo=timezone.utc)


def test_hay_14_misiones_con_fecha_y_fuente():
    assert len(MISSIONS) == 14
    for s in MISSIONS:
        assert s["landing_source"].strip(), f"{s['id']}: falta la fuente de landing_utc"
        assert s["landing_source_url"].startswith("https://"), f"{s['id']}: falta la URL de la fuente"


def test_mission_window_es_tres_dias_antes_y_despues_de_la_hora():
    assert mission_window("1969-07-20T20:17:39Z") == ("1969-07-17T20:00:00Z", "1969-07-23T20:00:00Z")
    assert WINDOW_DAYS == 3


@pytest.mark.parametrize("site", MISSIONS, ids=lambda s: s["id"])
def test_mission_json_valido_y_con_la_ventana_esperada(site):
    path = PUBLIC / "sites" / site["id"] / "mission.json"
    _assert_valid("ephemeris.schema.json", path)
    doc = _load(path)
    start, stop = mission_window(site["landing_utc"])
    assert doc["site_id"] == site["id"]
    assert doc["time"] == {"start_utc": start, "step_s": 3600, "count": 2 * WINDOW_DAYS * 24 + 1}
    n = doc["time"]["count"]
    for body in ("sun", "earth"):
        assert len(doc[body]["azimuth_deg"]) == n
        assert len(doc[body]["elevation_deg"]) == n
    last = _utc(start) + timedelta(seconds=3600 * (n - 1))
    assert last == _utc(stop)


# Referencia: tabla de Scotti (ALSJ), hora UT del alunizaje, altitud y azimut del Sol y de la Tierra.
# https://www.nasa.gov/wp-content/uploads/static/history/alsj/Scotti_AltAz.txt
ALSJ = {
    "apollo-11": ("1969-07-20T20:17:39Z", 10.65, 88.81, 59.43, 272.16),
    "apollo-12": ("1969-11-19T06:54:36Z", 5.19, 91.16, 61.56, 86.95),
    "apollo-14": ("1971-02-05T09:18:13Z", 10.36, 89.54, 66.10, 96.70),
    "apollo-15": ("1971-07-30T22:16:29Z", 12.05, 95.73, 69.28, 203.00),
    "apollo-16": ("1972-04-21T02:23:35Z", 14.76, 86.01, 77.16, 319.70),
    "apollo-17": ("1972-12-11T19:54:58Z", 13.33, 95.83, 45.52, 240.88),
}
# El Sol coincide con Horizons dentro de 0,1°. La Tierra se deja en 0,5°: la tabla usa coordenadas de
# sitio un poco distintas y una interpolación del Nautical Almanac (diferencia observada: hasta ~0,4°).
SUN_TOL_DEG, EARTH_TOL_DEG = 0.1, 0.5


def _at(doc, body, key, when):
    """Valor interpolado linealmente entre las dos muestras horarias que rodean a `when`."""
    t0 = _utc(doc["time"]["start_utc"])
    pos = (when - t0).total_seconds() / doc["time"]["step_s"]
    i = int(pos)
    a, b = doc[body][key][i], doc[body][key][i + 1]
    if key == "azimuth_deg" and abs(b - a) > 180:  # cruce del norte (360° -> 0°)
        b += 360 if b < a else -360
    return (a + (pos - i) * (b - a)) % 360 if key == "azimuth_deg" else a + (pos - i) * (b - a)


@pytest.mark.parametrize("site_id", sorted(ALSJ))
def test_apolo_coincide_con_la_tabla_del_alsj(site_id):
    landing, sun_el, sun_az, earth_el, earth_az = ALSJ[site_id]
    site = next(s for s in SITES if s["id"] == site_id)
    assert site["landing_utc"] == landing
    doc = _load(PUBLIC / "sites" / site_id / "mission.json")
    when = _utc(landing)
    assert _at(doc, "sun", "elevation_deg", when) == pytest.approx(sun_el, abs=SUN_TOL_DEG)
    assert _at(doc, "sun", "azimuth_deg", when) == pytest.approx(sun_az, abs=SUN_TOL_DEG)
    assert _at(doc, "earth", "elevation_deg", when) == pytest.approx(earth_el, abs=EARTH_TOL_DEG)
    assert _at(doc, "earth", "azimuth_deg", when) == pytest.approx(earth_az, abs=EARTH_TOL_DEG)


# Horas de alunizaje de las misiones sin tabla independiente (Sol y Tierra no se validan acá).
# Fuente: Wikipedia, que a su vez cita reportes de prensa del día del evento. Tolerancia: 1 minuto.
# Chandrayaan-3: reportes del 23/08/2023 dan ~12:33 UTC (~18:03-18:04 IST).
# IM-2: Wikipedia da 17:28:50 UTC el 06/03/2025.
REFERENCIA_ALUNIZAJE = {
    "chandrayaan-3": "2023-08-23T12:33:00Z",
    "intuitive-machines-2": "2025-03-06T17:28:50Z",
}
TOLERANCIA_ALUNIZAJE = timedelta(minutes=1)


@pytest.mark.parametrize("site_id", sorted(REFERENCIA_ALUNIZAJE))
def test_alunizaje_coincide_con_la_referencia_publica(site_id):
    site = next(s for s in SITES if s["id"] == site_id)
    referencia = REFERENCIA_ALUNIZAJE[site_id]
    assert abs(_utc(site["landing_utc"]) - _utc(referencia)) <= TOLERANCIA_ALUNIZAJE


@pytest.mark.parametrize("site_id", sorted(REFERENCIA_ALUNIZAJE))
def test_ventana_no_cambia_con_el_minuto_exacto(site_id):
    site = next(s for s in SITES if s["id"] == site_id)
    assert mission_window(site["landing_utc"]) == mission_window(REFERENCIA_ALUNIZAJE[site_id])
