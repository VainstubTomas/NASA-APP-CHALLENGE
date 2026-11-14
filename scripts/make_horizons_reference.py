"""Regenera la referencia de Horizons en tests/reference/ (C0-05, ADR-005/ADR-006).

Requiere red hacia la API de JPL Horizons. Las respuestas crudas quedan en
tests/reference/raw/ con la consulta exacta (clave "query") y la fecha de descarga;
horizons_reference.csv se deriva de esas respuestas con el parser del cliente.

Uso (desde la raíz del repo):
    .venv\\Scripts\\python.exe scripts\\make_horizons_reference.py

Los sitios salen de la lista verificada de issue 17 (NASA NSSDCA, LRO, Wagner et al. 2017).
No se inventan coordenadas: si cambian en data/public/sites.json, cambian acá con su fuente.
"""
import csv
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from precompute.ephemeris import horizons_client as hc  # noqa: E402

REFERENCE_DIR = ROOT / "tests" / "reference"
RAW_DIR = REFERENCE_DIR / "raw"
CSV_PATH = REFERENCE_DIR / "horizons_reference.csv"

SITES = [
    {"id": "apollo-12", "lat_deg": -3.0128, "lon_deg": -23.4219},
    {"id": "apollo-15", "lat_deg": 26.13239, "lon_deg": 3.6333},
    {"id": "apollo-16", "lat_deg": -8.9734, "lon_deg": 15.5011},
]
DATES = ["2026-11-14", "2027-03-20", "2027-06-21"]  # día UTC completo, 24 muestras de 1 h
BODIES = ["sun", "earth"]
STEP_S = 3600

CSV_FIELDS = ["site_id", "lat_deg", "lon_deg", "body", "time_utc", "azimuth_deg", "elevation_deg"]


def build_rows():
    rows = []
    for site in SITES:
        for day in DATES:
            start, stop = f"{day}T00:00:00Z", f"{day}T23:00:00Z"
            for body in BODIES:
                out = hc.get_az_el(site["lat_deg"], site["lon_deg"], body, start, stop,
                                   STEP_S, cache_dir=RAW_DIR)
                for t, az, el in zip(out["time_utc"], out["azimuth_deg"], out["elevation_deg"]):
                    rows.append({
                        "site_id": site["id"],
                        "lat_deg": site["lat_deg"],
                        "lon_deg": site["lon_deg"],
                        "body": body,
                        "time_utc": t,
                        "azimuth_deg": f"{az:.6f}",
                        "elevation_deg": f"{el:.6f}",
                    })
    return rows


def main():
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    rows = build_rows()
    with CSV_PATH.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=CSV_FIELDS)
        w.writeheader()
        w.writerows(rows)
    print(f"{len(rows)} filas escritas en {CSV_PATH}")


if __name__ == "__main__":
    main()
