# ADR-004: Stack tecnológico

- **Estado**: Propuesto (confirmar con Fer y Facu para el frontend, y con Toto y Panchi para Python)
- **Fecha**: 2026-11-12

## Contexto
Las piezas 1 y 2 son cálculo científico; la pieza 3 es una web de visualización. Necesitamos herramientas conocidas, instalables rápido y con ejemplos abundantes para que Claude y el equipo avancen sin fricción.

## Decisión
**Precálculo (Python 3.11+)**: `numpy`, `spiceypy` (efemérides con kernels NAIF; `skyfield` queda como alternativa), `rasterio` y `pyproj` (mapa LOLA y proyección polar), `matplotlib` (gráficos de prueba), `pytest` y `jsonschema` (tests y contrato). Scripts `.py`, no notebooks. Entorno virtual en `.venv`.

**Web**: Vite + JavaScript sin framework pesado. Dibujo del horizonte en SVG o canvas, con D3 solo si ayuda; líneas de tiempo con la herramienta más simple. Vite sirve `data/public/` como carpeta estática (`publicDir: '../data/public'`).

**Despliegue**: GitHub Pages o Vercel desde `main`.

**Plan B**: Google Colab para quien no pueda instalar `rasterio` (en Windows suele fallar; alternativa: Anaconda).

## Alternativas descartadas
- Cálculo en el navegador con librerías de astronomía: pocas garantías con efemérides lunares y terreno.
- Backend con servidor: más piezas que fallar durante la demo.
- Framework completo (React u otro) desde el inicio: costo de arranque sin necesidad clara.

## Consecuencias
- Todos instalan y prueban su entorno antes del viernes por la noche (ver capa 0).
- La elección exacta de librería de gráficos puede ajustarse con un ADR nuevo si el frontend lo necesita.
