"""API de efemérides y horizonte en vivo (issue #104, ADR-015 y ADR-018). Documentación interactiva (Swagger UI) en /docs.

Levantar en local, desde la raíz del repo:
    .venv/bin/python -m uvicorn data.api.main:app --reload --port 8000
"""
from __future__ import annotations

import os
from pathlib import Path

import requests
from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from data.api import service
from precompute.ephemeris import horizons_client as hc
from precompute.terrain import lola_horizon as lh

# Orígenes que pueden llamar a la API desde el navegador: desarrollo local, GitHub Pages y Vercel (producción).
# Se pueden cambiar con la variable CORS_ORIGINS (separados por comas), p. ej. en Render.
DEFAULT_ORIGINS = [
    "http://localhost:5173", "http://127.0.0.1:5173",
    "http://localhost:4173", "http://127.0.0.1:4173",
    "https://vainstubtomas.github.io",
    "https://vizcachasfueradeorbita.vercel.app",
]

DESCRIPTION = """
Azimut y elevación del **Sol** y la **Tierra** vistos desde un punto de la Luna, consultados en vivo a
**JPL Horizons** (ADR-006, ADR-015). La respuesta tiene el mismo formato que `ephemeris.json`
(`docs/03-DATA-CONTRACT.md`).

Convenciones: azimut en grados, 0° = norte y sentido horario; elevación en grados sobre el horizonte;
latitud planetocéntrica y longitud este-positiva; tiempo en UTC, paso de 1 hora.
La API **nunca devuelve datos inventados**: si Horizons falla, responde un error.

`/horizon` devuelve el **relieve** alrededor del punto (formato `horizon.json`), calculado con el mapa de
elevación **LOLA** de NASA Moon Trek igual que los sitios guardados (ADR-018): 360 elevaciones del horizonte,
hasta 20 km. La primera consulta de un punto baja el recorte del mapa y puede tardar varios segundos.
"""

app = FastAPI(
    title="Lunar Landing Site Navigator: efemérides y horizonte en vivo",
    version="1.0.0",
    description=DESCRIPTION,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in os.environ.get("CORS_ORIGINS", ",".join(DEFAULT_ORIGINS)).split(",") if o.strip()],
    allow_methods=["GET"],
    allow_headers=["*"],
)


class Series(BaseModel):
    azimuth_deg: list[float] = Field(description="Azimut (0° = norte, horario), [0, 360)")
    elevation_deg: list[float] = Field(description="Elevación sobre el horizonte, grados")


class TimeAxis(BaseModel):
    start_utc: str = Field(examples=["2026-11-30T06:00:00Z"])
    step_s: int = Field(description="Paso entre muestras, en segundos", examples=[3600])
    count: int = Field(description="Cantidad de muestras de cada arreglo")


class AngularRadius(BaseModel):
    sun: float = 0.25
    earth: float = 1.0


class EphemerisResponse(BaseModel):
    schema_version: str = "1.0"
    site_id: str = Field(examples=["live-n0p0-e30p0"])
    time: TimeAxis
    sun: Series
    earth: Series
    angular_radius_deg: AngularRadius
    source: str = Field(description="Consulta a Horizons y fecha de descarga")


class DemInfo(BaseModel):
    name: str = Field(examples=[lh.DEM_NAME])
    pixel_m: int = Field(description="Tamaño del píxel del mapa, en metros", examples=[lh.DEM_PIXEL_M])


class HorizonResponse(BaseModel):
    schema_version: str = "1.0"
    site_id: str = Field(examples=["live-n0p0-e30p0"])
    azimuth_start_deg: float = 0
    azimuth_step_deg: float = 1
    elevation_deg: list[float] = Field(description="360 elevaciones del horizonte (azimut 0°, 1°, …, 359°), grados")
    max_distance_km: float | None = Field(None, description="Distancia máxima del relieve considerado")
    observer_height_m: float | None = Field(None, description="Altura del observador sobre el suelo")
    dem: DemInfo | None = Field(None, description="Mapa usado. Sin `dem` es la Luna lisa: no hay mapa para esa latitud")


class ErrorResponse(BaseModel):
    detail: str


def get_session():
    """Sesión HTTP hacia Horizons (None = `requests`). Los tests la reemplazan por una falsa."""
    return None


def get_cache_dir() -> Path:
    return hc.CACHE_DIR


def get_site_horizon():
    """Cálculo del horizonte de un sitio (baja el recorte de Moon Trek). Los tests lo reemplazan por uno falso."""
    return lh.site_horizon


def get_dem_dir() -> Path:
    return lh.RAW_DIR


@app.get(
    "/ephemeris",
    response_model=EphemerisResponse,
    summary="Efemérides del Sol y la Tierra desde un punto de la Luna",
    responses={
        422: {"description": "Entrada inválida (latitud, longitud, fecha o días fuera de rango)"},
        502: {"model": ErrorResponse, "description": "Horizons falló o devolvió algo que no se puede leer"},
        504: {"model": ErrorResponse, "description": "Horizons no respondió a tiempo"},
    },
)
def get_ephemeris(
    lat: float = Query(..., ge=-90, le=90, description="Latitud planetocéntrica en grados, [-90, 90]", examples=[0]),
    lon: float = Query(..., ge=-180, le=180, description="Longitud este-positiva en grados, [-180, 180]",
                       examples=[30]),
    start: str = Query(..., description="Inicio en UTC, ISO 8601 (YYYY-MM-DDTHH:MM:SSZ), entre 2026-11-01 y "
                                        "2027-12-31", examples=["2026-11-30T06:00:00Z"]),
    days: int = Query(service.DEFAULT_DAYS, ge=service.MIN_DAYS, le=service.MAX_DAYS,
                      description="Días de la ventana, de 1 a 14 (si pasa del 2027-12-31 se recorta)"),
    session=Depends(get_session),
    cache_dir: Path = Depends(get_cache_dir),
):
    try:
        return service.build_live_ephemeris(lat, lon, start, days, session=session, cache_dir=cache_dir)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except requests.Timeout:
        raise HTTPException(status_code=504, detail="JPL Horizons no respondió a tiempo. Probá de nuevo en un rato.")
    except requests.RequestException as e:
        raise HTTPException(status_code=502, detail=f"No se pudo consultar JPL Horizons: {type(e).__name__}")
    except hc.HorizonsError as e:
        raise HTTPException(status_code=502, detail=f"JPL Horizons devolvió un error: {e}")


@app.get(
    "/horizon",
    response_model=HorizonResponse,
    response_model_exclude_none=True,
    summary="Horizonte con relieve alrededor de un punto de la Luna",
    responses={
        422: {"description": "Entrada inválida (latitud o longitud fuera de rango)"},
        502: {"model": ErrorResponse, "description": "Moon Trek falló o el mapa de elevación no se pudo leer"},
        504: {"model": ErrorResponse, "description": "Moon Trek no respondió a tiempo"},
    },
)
def get_horizon(
    lat: float = Query(..., ge=-90, le=90, description="Latitud planetocéntrica en grados, [-90, 90]", examples=[0]),
    lon: float = Query(..., ge=-180, le=180, description="Longitud este-positiva en grados, [-180, 180]",
                       examples=[30]),
    site_horizon=Depends(get_site_horizon),
    dem_dir: Path = Depends(get_dem_dir),
):
    try:
        return service.build_live_horizon(lat, lon, raw_dir=dem_dir, site_horizon=site_horizon)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except requests.Timeout:
        raise HTTPException(status_code=504, detail="NASA Moon Trek no respondió a tiempo. Probá de nuevo en un rato.")
    except requests.RequestException as e:
        raise HTTPException(status_code=502, detail=f"No se pudo bajar el mapa de elevación de Moon Trek: {type(e).__name__}")
    except service.TerrainError as e:
        raise HTTPException(status_code=502, detail=f"No se pudo calcular el relieve: {e}")
