# 02. Arquitectura

Última actualización: 2026-11-12

## Idea central
El problema se divide en **tres piezas independientes**. Las dos primeras corren en Python **antes** de la demo y producen archivos JSON. La tercera es una web estática que lee esos archivos y compara. Así la web es rápida, no depende de internet durante la demo y nadie bloquea a nadie: el frontend arranca con datos sintéticos mientras el backend calcula los reales.

```
   SPICE kernels ──► [1. Efemérides] ──► ephemeris.json ─┐
   (NAIF/JPL)         precompute/ephemeris/              │
                                                          ├──► [3. Web] ──► pantalla
   LOLA DEM  ───────► [2. Terreno]   ──► horizon.json  ───┘     web/
   (LRO/NASA)         precompute/terrain/                         compara elevación vs horizonte
                                                                  
   JPL Horizons ──► tests/ (valida la pieza 1 y la regla de visibilidad)
```

## Pieza 1: dónde están el Sol y la Tierra
- Entrada: sitio (lat/lon), rango de fechas, kernels SPICE.
- Salida: `data/public/sites/<id>/ephemeris.json` con azimut y elevación del Sol y la Tierra por hora (topocéntrico).
- Herramientas: `spiceypy` (o `skyfield`), `numpy`.
- Cuidados: marco de referencia de la Luna, escalas de tiempo (UTC/TDB), observar desde la superficie y no desde el centro, libración (ya incluida en las efemérides).

## Pieza 2: cómo es el horizonte
- Entrada: mapa de alturas LOLA (`LDEM_80S_80MPP_ADJ.TIF`, píxeles 80 m, proyección polar estereográfica en metros) y coordenadas del sitio.
- Proceso: desde el punto, en cada una de las 360 direcciones recorrer el terreno hasta ~150 km y quedarse con el ángulo máximo de elevación que ve el observador.
- Salida: `data/public/sites/<id>/horizon.json` con 360 valores de elevación del horizonte.
- Herramientas: `rasterio`, `pyproj`, `numpy`.
- Cuidados: convertir lat/lon a píxel con la librería, unidades (metros vs kilómetros), curvatura lunar, memoria (resolución media o recorte).

## Pieza 3: qué se ve
- Para un instante, el cuerpo es visible si su elevación supera la del horizonte en su azimut (regla exacta y provisional en `docs/03-DATA-CONTRACT.md`).
- La web calcula la visibilidad hora por hora combinando ambos JSON, dibuja el panorama y deriva horas de luz, horas con Tierra y cuenta regresiva.
- `metrics.json` (backend) trae los mismos números precalculados para **cruzar resultados**: si web y backend no coinciden, hay un bug.

## Estructura de datos en el repo
```
data/raw/                      kernels y LOLA (NO versionado; copia en la nube del equipo)
data/public/sites.json         lista de sitios
data/public/sites/<id>/        horizon.json, ephemeris.json, metrics.json
data/schema/*.schema.json      esquemas del contrato
```
La web sirve `data/public/` como carpeta estática (Vite `publicDir`), así que no hay copia intermedia. Detalle del formato en `docs/03-DATA-CONTRACT.md`.

## Frontend
- Vite + JavaScript, sin framework pesado. Dibujo del horizonte en SVG o canvas (ver ADR-004).
- Estado en la URL (`?site=...&t=...`) para poder compartir.
- Funciona sin conexión durante la demo (todo estático).
- Despliegue: GitHub Pages o Vercel desde `main`.

## Validación
`tests/` compara contra valores de referencia de JPL Horizons guardados en `tests/reference/` (ver ADR-005). Además, `tests/test_contract.py` valida que todo JSON de `data/public/` cumple el esquema.

## Datos pesados
No se commitean. Quien los descarga los sube a la carpeta compartida del equipo (nube) y deja la ruta en el issue de descarga. Plan B si falla internet en el lugar: copia en pendrive y Google Colab para Python.

## Decisiones abiertas
- Coordenadas personalizadas del usuario (grilla precalculada o servidor).
- Radio angular variable del Sol y la Tierra (v1 usa valores nominales).
