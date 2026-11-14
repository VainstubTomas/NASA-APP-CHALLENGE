"""Descarga masiva de efemérides de Horizons para todos los sitios (issue C0-13).

Todo offline: una sesión falsa imita la respuesta de Horizons y cuenta cuántas consultas recibe.
"""
import json
import re
from datetime import datetime, timedelta, timezone

import pytest
import requests

from precompute.ephemeris import download_horizons as dl

START, STOP = "2026-11-14T00:00:00Z", "2026-11-14T05:00:00Z"  # 6 muestras horarias


class FakeResponse:
    def __init__(self, payload):
        self._payload = payload

    def raise_for_status(self):
        pass

    def json(self):
        return self._payload


class FakeSession:
    """Responde como Horizons para cualquier sitio y rango; `fail_first` errores de red antes de responder."""

    def __init__(self, fail_first=0):
        self.calls = []
        self.fail_first = fail_first

    def get(self, url, params, timeout):
        self.calls.append(params)
        if self.fail_first:
            self.fail_first -= 1
            raise requests.ConnectionError("sin red")
        lon, lat, _ = (float(x) for x in params["SITE_COORD"].strip("'").split(","))
        t0 = datetime.strptime(params["START_TIME"].strip("'"), "%Y-%m-%d %H:%M")
        t1 = datetime.strptime(params["STOP_TIME"].strip("'"), "%Y-%m-%d %H:%M")
        step = timedelta(minutes=int(params["STEP_SIZE"].strip("'").split()[0]))
        rows, t = [], t0
        while t <= t1:
            rows.append(f"{t:%Y-%b-%d %H:%M}, , , 90.000000, 10.000000,")
            t += step
        result = (
            f"Center geodetic : {lon}, {lat}, 0.0 {{E-lon(deg),Lat(deg),Alt(km)}}\n"
            " Date__(UT)__HR:MN, , , Azi_(a-app), Elev_(a-app),\n"
            "$$SOE\n" + "\n".join(rows) + "\n$$EOE\n"
        )
        return FakeResponse({"result": result})


def _sitio(id_, lat, lon, synthetic=False):
    return {"id": id_, "name": id_, "lat_deg": lat, "lon_deg": lon,
            "source": "test", "source_url": "https://example.org", "synthetic": synthetic}


@pytest.fixture
def sitios_json(tmp_path):
    path = tmp_path / "sites.json"
    sitios = [_sitio("demo", -89.5, 0.0, synthetic=True), _sitio("a", 0.67, 23.47), _sitio("b", -3.01, -23.42)]
    path.write_text(json.dumps({"sites": sitios}), encoding="utf-8")
    return path


def test_load_sites_omite_el_sintetico_por_defecto(sitios_json):
    assert [s["id"] for s in dl.load_sites(sitios_json)] == ["a", "b"]


def test_load_sites_puede_incluir_el_sintetico(sitios_json):
    assert [s["id"] for s in dl.load_sites(sitios_json, include_synthetic=True)] == ["demo", "a", "b"]


def test_load_sites_real_del_repo_tiene_sitios_reales():
    sitios = dl.load_sites()
    assert len(sitios) >= 14
    assert all(not s.get("synthetic") for s in sitios)


def test_descarga_una_consulta_por_sitio_y_cuerpo(tmp_path):
    sesion = FakeSession()
    informe = dl.download_all([_sitio("a", 0.67, 23.47), _sitio("b", -3.01, -23.42)], START, STOP,
                              cache_dir=tmp_path, session=sesion, pause_s=0)
    assert len(sesion.calls) == 4  # 2 sitios x (sol, tierra)
    assert informe["failed"] == []
    assert len(informe["ok"]) == 4
    assert len(list(tmp_path.glob("*.json"))) == 4


def test_pide_sol_y_tierra_y_el_rango_pedido(tmp_path):
    sesion = FakeSession()
    dl.download_all([_sitio("a", 0.67, 23.47)], START, STOP, cache_dir=tmp_path, session=sesion, pause_s=0)
    assert sorted(p["COMMAND"] for p in sesion.calls) == ["'10'", "'399'"]
    assert all(p["START_TIME"] == "'2026-11-14 00:00'" and p["STOP_TIME"] == "'2026-11-14 05:00'"
               and p["STEP_SIZE"] == "'60 m'" for p in sesion.calls)


def test_segunda_corrida_sale_del_cache(tmp_path):
    sitios = [_sitio("a", 0.67, 23.47)]
    dl.download_all(sitios, START, STOP, cache_dir=tmp_path, session=FakeSession(), pause_s=0)
    segunda = FakeSession()
    informe = dl.download_all(sitios, START, STOP, cache_dir=tmp_path, session=segunda, pause_s=0)
    assert segunda.calls == []
    assert len(informe["ok"]) == 2


def test_reintenta_ante_error_de_red(tmp_path):
    sesion = FakeSession(fail_first=2)
    esperas = []
    informe = dl.download_all([_sitio("a", 0.67, 23.47)], START, STOP, cache_dir=tmp_path, session=sesion,
                              retries=3, pause_s=0, sleep=esperas.append)
    assert informe["failed"] == []
    assert len(esperas) >= 2  # esperó entre los intentos


def test_si_agota_los_reintentos_lo_informa_y_sigue_con_el_resto(tmp_path):
    class SiempreFalla(FakeSession):
        def get(self, url, params, timeout):
            if "'10'" == params["COMMAND"]:
                raise requests.ConnectionError("sin red")
            return super().get(url, params, timeout)

    informe = dl.download_all([_sitio("a", 0.67, 23.47)], START, STOP, cache_dir=tmp_path,
                              session=SiempreFalla(), retries=2, pause_s=0, sleep=lambda s: None)
    assert [(f["site"], f["body"]) for f in informe["failed"]] == [("a", "sun")]
    assert [(o["site"], o["body"]) for o in informe["ok"]] == [("a", "earth")]


def test_rango_por_defecto_son_2880_muestras_horarias():
    t0 = datetime.strptime(dl.DEFAULT_START, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
    t1 = datetime.strptime(dl.DEFAULT_STOP, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
    assert (t1 - t0) // timedelta(hours=1) + 1 == 2880
    assert re.fullmatch(r"2026-11-01T00:00:00Z", dl.DEFAULT_START)


def test_main_devuelve_distinto_de_cero_si_algo_falla(tmp_path, sitios_json, monkeypatch):
    monkeypatch.setattr(dl, "download_all", lambda *a, **k: {"ok": [], "failed": [{"site": "a", "body": "sun", "error": "x"}]})
    assert dl.main(["--sites", str(sitios_json), "--cache-dir", str(tmp_path)]) == 1


def test_main_devuelve_cero_si_todo_sale_bien(tmp_path, sitios_json, monkeypatch):
    monkeypatch.setattr(dl, "download_all", lambda *a, **k: {"ok": [{"site": "a", "body": "sun"}], "failed": []})
    assert dl.main(["--sites", str(sitios_json), "--cache-dir", str(tmp_path)]) == 0
