"""Helpers compartidos de los tests que validan data/public/ contra data/schema/."""
import json
from pathlib import Path

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
