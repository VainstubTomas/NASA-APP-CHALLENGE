"""Valida que todo JSON de data/public/ cumple el contrato de docs/03-DATA-CONTRACT.md."""
import json
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator
from referencing import Registry, Resource

ROOT = Path(__file__).resolve().parent.parent
SCHEMA_DIR = ROOT / "data" / "schema"
PUBLIC = ROOT / "data" / "public"


def _load(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def _registry():
    resources = []
    for p in SCHEMA_DIR.glob("*.json"):
        doc = _load(p)
        resources.append((doc["$id"], Resource.from_contents(doc)))
    return Registry().with_resources(resources)


REGISTRY = _registry()


def _validator(schema_name):
    return Draft202012Validator(_load(SCHEMA_DIR / schema_name), registry=REGISTRY)


def _assert_valid(schema_name, path):
    errors = sorted(_validator(schema_name).iter_errors(_load(path)), key=lambda e: list(e.path))
    assert not errors, f"{path} incumple {schema_name}: " + "; ".join(e.message[:120] for e in errors[:3])


def site_files(name):
    return sorted((PUBLIC / "sites").glob(f"*/{name}"))


def test_sites_json_valido():
    _assert_valid("sites.schema.json", PUBLIC / "sites.json")


def test_ids_de_sitios_coinciden_con_carpetas():
    ids = {s["id"] for s in _load(PUBLIC / "sites.json")["sites"]}
    carpetas = {p.name for p in (PUBLIC / "sites").iterdir() if p.is_dir()}
    assert ids == carpetas, f"sites.json y data/public/sites/ no coinciden: {ids ^ carpetas}"


@pytest.mark.parametrize("path", site_files("horizon.json"), ids=lambda p: p.parent.name)
def test_horizon_valido(path):
    _assert_valid("horizon.schema.json", path)
    doc = _load(path)
    assert doc["site_id"] == path.parent.name
    assert len(doc["elevation_deg"]) * doc["azimuth_step_deg"] == 360, "el perfil debe cubrir 360 grados"


@pytest.mark.parametrize("path", site_files("ephemeris.json"), ids=lambda p: p.parent.name)
def test_ephemeris_valido(path):
    _assert_valid("ephemeris.schema.json", path)
    doc = _load(path)
    assert doc["site_id"] == path.parent.name
    n = doc["time"]["count"]
    for body in ("sun", "earth"):
        assert len(doc[body]["azimuth_deg"]) == n
        assert len(doc[body]["elevation_deg"]) == n


@pytest.mark.parametrize("path", site_files("metrics.json"), ids=lambda p: p.parent.name)
def test_metrics_valido(path):
    _assert_valid("metrics.schema.json", path)
    doc = _load(path)
    n = doc["time"]["count"]
    for key in ("sun_hours", "earth_hours", "both_hours"):
        assert len(doc["daily"][key]) == n
