"""Recorte del DEM LOLA 128 ppd por bbox (issue C5-05, #13; ADR-006).

Prueba la URL de exportImage y, si el TIFF ya está en data/raw/, que abra con rasterio como Float32 en metros.
"""
from pathlib import Path

import pytest

from precompute.terrain import lola_dem as ld


def test_url_pide_tiff_float32_en_coordenadas_lunares():
    url = ld.export_url((-18, -4, 24, 1), size=(5376, 640))
    assert url.startswith(ld.SERVICE + "/exportImage?")
    assert "bbox=-18,-4,24,1" in url
    assert "bboxSR=104903" in url and "imageSR=104903" in url
    assert "size=5376,640" in url
    assert "format=tiff" in url and "pixelType=F32" in url


def test_size_sale_del_paso_de_128_ppd():
    # 128 ppd = 1/128 de grado por píxel
    assert ld.size_for_bbox((0, 0, 1, 1)) == (128, 128)
    assert ld.size_for_bbox((-18, -4, 24, 1)) == (5376, 640)


@pytest.mark.parametrize("bbox", [(10, 0, 5, 1), (0, 1, 1, 0), (-200, 0, 0, 1), (0, -100, 1, 0)])
def test_bbox_invalido_falla(bbox):
    with pytest.raises(ValueError):
        ld.export_url(bbox, size=(10, 10))


def test_tiff_descargado_es_float32_en_metros():
    path = ld.RAW_DIR / "dem_apollo-11.tif"
    if not path.exists():
        pytest.skip("TIFF no descargado todavía (data/raw/, no versionado)")
    info = ld.check_tiff(path)
    assert info["dtype"] == "float32"
    # rasterio no lo mapea a EPSG: el WKT trae GCS_Moon_2000 con AUTHORITY ESRI 104903
    assert 'AUTHORITY["ESRI","104903"]' in info["crs_wkt"]
    assert info["count"] == 1
    # rango razonable de altura lunar: el relieve del mapa LOLA va de unos -10 km a +10 km
    assert -10_000 < info["min"] < info["max"] < 10_000


def test_url_polar_pide_un_cuadrado_de_30_m_en_la_proyeccion_del_servicio():
    from urllib.parse import parse_qs, urlparse

    url = ld.polar_export_url(1000.0, -2000.0, 22_000.0, 'PROJCS["Moon2000_spole"]')
    assert url.startswith(ld.POLAR_SERVICE + "/exportImage?")
    q = {k: v[0] for k, v in parse_qs(urlparse(url).query).items()}
    assert q["bbox"] == "-21000.0,-24000.0,23000.0,20000.0"
    assert q["size"] == "1467,1467"  # 44 km / 30 m
    assert '"wkt"' in q["bboxSR"] and q["bboxSR"] == q["imageSR"]
    assert q["format"] == "tiff" and q["pixelType"] == "F32"


def test_descarga_polar_rechaza_sitios_fuera_del_mapa(tmp_path):
    with pytest.raises(ValueError, match="fuera del mapa polar"):
        ld.download_polar(-69.37, 32.32, tmp_path / "x.tif")
