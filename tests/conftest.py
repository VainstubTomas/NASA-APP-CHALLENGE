"""Configuración común de pytest: raíz del repo en sys.path y marcador `network`."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


def pytest_configure(config):
    config.addinivalue_line(
        "markers",
        "network: consulta la API de Horizons la primera vez; después lee del caché de data/raw/horizons/",
    )
