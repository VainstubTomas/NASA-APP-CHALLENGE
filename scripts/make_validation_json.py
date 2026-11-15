"""Genera data/public/validation.json desde tests/reference/ (C3-06, #39, ADR-013).

La web no puede leer tests/ (Vite solo sirve data/public/), así que los valores de
referencia de Horizons se copian acá. No se calcula nada nuevo: todo sale del CSV
y de las respuestas guardadas en tests/reference/raw/.

Uso (desde la raíz del repo):
    .venv/Scripts/python.exe scripts/make_validation_json.py
"""
import csv
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

REF_DIR = ROOT / "tests" / "reference"
CSV_PATH = REF_DIR / "horizons_reference.csv"
RAW_DIR = REF_DIR / "raw"
OUT_PATH = ROOT / "data" / "public" / "validation.json"

# Mismo valor que TOL_DEG en tests/test_ephemeris_horizons.py (ADR-005).
TOLERANCE_DEG = 0.1


def _source(raw_dir):
    entries = [json.loads(p.read_text(encoding="utf-8")) for p in sorted(raw_dir.glob("*.json"))]
    url = entries[0]["url"]
    downloads = sorted(e["downloaded_utc"] for e in entries)
    return (
        f"JPL Horizons API ({url}), tabla de observador QUANTITIES=4 (azimut y elevación aparentes, "
        f"AIRLESS), respuestas guardadas en tests/reference/raw/, descargadas entre "
        f"{downloads[0]} y {downloads[-1]}"
    )


def build_validation(csv_path, raw_dir):
    with csv_path.open(newline="", encoding="utf-8") as f:
        rows = [
            {
                "site_id": r["site_id"],
                "body": r["body"],
                "time_utc": r["time_utc"],
                "azimuth_deg": float(r["azimuth_deg"]),
                "elevation_deg": float(r["elevation_deg"]),
            }
            for r in csv.DictReader(f)
        ]
    return {
        "schema_version": "1.0",
        "tolerance_deg": TOLERANCE_DEG,
        "source": _source(raw_dir),
        "rows": rows,
    }


def main():
    doc = build_validation(CSV_PATH, RAW_DIR)
    OUT_PATH.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{OUT_PATH} escrito: {len(doc['rows'])} filas")


if __name__ == "__main__":
    main()
