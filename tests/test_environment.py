"""Comprueba que el entorno Python del equipo tiene las librerías del precálculo (issue C0-02).

Si falla, reinstalar con `pip install -r precompute/requirements.txt` dentro del venv.
rasterio y pyproj solo hacen falta para el relieve (capa 5, ADR-011): si no se pueden
instalar (por ejemplo en Windows) el test se omite en vez de fallar.
"""
import importlib

import pytest

REQUERIDAS = ["numpy", "requests", "matplotlib", "jsonschema"]
SOLO_RELIEVE = ["rasterio", "pyproj"]


@pytest.mark.parametrize("nombre", REQUERIDAS)
def test_libreria_requerida_importa(nombre):
    importlib.import_module(nombre)


@pytest.mark.parametrize("nombre", SOLO_RELIEVE)
def test_libreria_de_relieve_importa(nombre):
    pytest.importorskip(nombre, reason=f"{nombre} solo hace falta para el relieve (capa 5)")
