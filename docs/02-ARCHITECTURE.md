# 02. Arquitectura

Última actualización: 2026-11-13

## Idea central
El problema se divide en **tres piezas independientes**. Las dos primeras corren en Python **antes** de la demo y producen archivos JSON. La tercera es una web estática que lee esos archivos y compara. Así la web es rápida, no depende de internet durante la demo y nadie bloquea a nadie: la web arranca con datos sintéticos mientras Python calcula los reales.

```
   API Horizons ───► [1. Efemérides] ──► ephemeris.json ─┐
   (JPL, caché)       precompute/ephemeris/              │
                                                          ├──► [3. Web] ──► pantalla
   DEM LOLA  ───────► [2. Terreno]   ──► horizon.json  ───┘     web/
   (Moon Trek/        precompute/terrain/                         compara elevación vs horizonte
    Quickmap o PDS)
                                                                  
   Respuestas guardadas de Horizons ──► tests/ (valida la lectura, las convenciones y la regla de visibilidad)
```

## Pieza 1: dónde están el Sol y la Tierra
- Entrada: sitio (lat/lon), rango de fechas. Fuente: **API de JPL Horizons** (recurso oficial del desafío, ADR-006).
- Consulta de referencia (confirmar contra la documentación de la API en C0-04): tabla de observador (`EPHEM_TYPE=OBSERVER`), objetivo Sol (`10`) o Tierra (`399`), observador en la superficie lunar (`CENTER='coord@301'`, `COORD_TYPE=GEODETIC`, `SITE_COORD='lon,lat,alt_km'`), azimut y elevación (`QUANTITIES=4`), grados, paso de 1 h, sin refracción (`APPARENT=AIRLESS`), tiempo UTC.
- Las respuestas crudas se guardan en `data/raw/horizons/` (no versionado) para no repetir consultas y para reproducir el resultado.
- Salida: `data/public/sites/<id>/ephemeris.json` con azimut y elevación del Sol y la Tierra por hora (topocéntrico).
- Herramientas: `requests`, `numpy`.
- Cuidados (verificar con un caso conocido antes de generar todo): que el azimut de Horizons sea 0° = norte y sentido horario, que la longitud sea este-positiva, que la latitud de la consulta coincida con nuestra planetocéntrica, la escala de tiempo (UTC) y el límite de filas por consulta (partir el rango si hace falta).

## Pieza 2: cómo es el horizonte
- Entrada: mapa de alturas LOLA del polo sur y coordenadas del sitio. Los recursos oficiales no incluyen el archivo: la fuente (Moon Trek, Quickmap o, como plan B, `LDEM_80S_80MPP_ADJ.TIF` del PDS, 80 m por píxel, polar estereográfica en metros) se fija en C0-03 y se anota en el ADR-006.
- Proceso: desde el punto, en cada una de las 360 direcciones recorrer el terreno hasta ~150 km y quedarse con el ángulo máximo de elevación que ve el observador.
- Salida: `data/public/sites/<id>/horizon.json` con 360 valores de elevación del horizonte.
- Herramientas: `rasterio`, `pyproj`, `numpy`.
- Cuidados: convertir lat/lon a píxel con la librería, unidades (metros vs kilómetros), curvatura lunar, memoria (resolución media o recorte).

## Pieza 3: qué se ve
- Para un instante, el cuerpo es visible si su elevación supera la del horizonte en su azimut (regla exacta y provisional en `docs/03-DATA-CONTRACT.md`).
- La web calcula la visibilidad hora por hora combinando ambos JSON, dibuja el panorama y deriva horas de luz, horas con Tierra y cuenta regresiva.
- `metrics.json` (Python) trae los mismos números precalculados para **cruzar resultados**: si la web y Python no coinciden, hay un bug.

## Estructura de datos en el repo
```
data/raw/                      mapa de elevación y caché de Horizons (NO versionado; copia en la nube del equipo)
data/public/sites.json         lista de sitios
data/public/sites/<id>/        horizon.json, ephemeris.json, metrics.json
data/schema/*.schema.json      esquemas del contrato
```
La web sirve `data/public/` como carpeta estática (Vite `publicDir`), así que no hay copia intermedia. Detalle del formato en `docs/03-DATA-CONTRACT.md`.

## Web
- Vite + JavaScript, sin framework pesado. Dibujo del horizonte en SVG o canvas (ver ADR-004).
- Estado en la URL (`?site=...&t=...`) para poder compartir.
- Funciona sin conexión durante la demo (todo estático).
- Despliegue: GitHub Pages o Vercel desde `main`.

## Validación
Horizons es la fuente, así que `tests/` verifica que lo leemos bien: compara `ephemeris.json` contra respuestas de Horizons guardadas en `tests/reference/` y, a mano, contra la interfaz web de Horizons en 3 sitios y 3 fechas (ver ADR-006, que reemplaza en parte al ADR-005). Además, `tests/test_contract.py` valida que todo JSON de `data/public/` cumple el esquema.

## Datos pesados
No se commitean. Quien los descarga los sube a la carpeta compartida del equipo (nube) y deja la ruta en el issue de descarga. Plan B si falla internet en el lugar: copia en pendrive y Google Colab para Python.

## Decisiones abiertas
- Coordenadas personalizadas del usuario (grilla precalculada o servidor).
- Radio angular variable del Sol y la Tierra (v1 usa valores nominales; Horizons puede dar el diámetro angular en la misma consulta, a confirmar).
