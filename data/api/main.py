"""API de efemérides en vivo (issue #104, ADR-015). Documentación interactiva (Swagger UI) en /docs.

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

# Orígenes que pueden llamar a la API desde el navegador: desarrollo local y GitHub Pages.
# Se pueden cambiar con la variable CORS_ORIGINS (separados por comas), p. ej. en Render.
DEFAULT_ORIGINS = [
    "http://localhost:5173", "http://127.0.0.1:5173",
    "http://localhost:4173", "http://127.0.0.1:4173",
    "https://vainstubtomas.github.io",
]

DESCRIPTION = """
Azimut y elevación del **Sol** y la **Tierra** vistos desde un punto de la Luna, consultados en vivo a
**JPL Horizons** (ADR-006, ADR-015). La respuesta tiene el mismo formato que `ephemeris.json`
(`docs/03-DATA-CONTRACT.md`).

Convenciones: azimut en grados, 0° = norte y sentido horario; elevación en grados sobre el horizonte;
latitud planetocéntrica y longitud este-positiva; tiempo en UTC, paso de 1 hora.
La API **nunca devuelve datos inventados**: si Horizons falla, responde un error.
"""

app = FastAPI(
    title="Lunar Landing Site Navigator: efemérides en vivo",
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


class ErrorResponse(BaseModel):
    detail: str


def get_session():
    """Sesión HTTP hacia Horizons (None = `requests`). Los tests la reemplazan por una falsa."""
    return None


def get_cache_dir() -> Path:
    return hc.CACHE_DIR


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
                                        "2027-02-28", examples=["2026-11-30T06:00:00Z"]),
    days: int = Query(service.DEFAULT_DAYS, ge=service.MIN_DAYS, le=service.MAX_DAYS,
                      description="Días de la ventana, de 1 a 14 (si pasa del 2027-02-28 se recorta)"),
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
