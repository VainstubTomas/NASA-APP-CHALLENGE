# API de efemérides en vivo (issue #104, ADR-015)

Servicio FastAPI que consulta **JPL Horizons** para una posición libre de la Luna (latitud, longitud) y devuelve el azimut y la elevación del Sol y la Tierra con **el mismo formato que `ephemeris.json`** (`docs/03-DATA-CONTRACT.md`). La web no llama a Horizons: Horizons no permite CORS, así que pasa por esta API. Los sitios de `sites.json` siguen usando los JSON precalculados.

- `main.py`: la app (endpoint, validación de parámetros, errores, CORS y documentación Swagger).
- `service.py`: arma la respuesta reusando `precompute/ephemeris/horizons_client.py` (consulta validada en el ADR-006).

## Levantarla en local
Desde la **raíz del repo**:
```bash
.venv/bin/pip install -r data/api/requirements.txt     # o: uv pip install --python .venv/bin/python -r data/api/requirements.txt
.venv/bin/python -m uvicorn data.api.main:app --reload --port 8000
```
- **Swagger UI** (probar a mano): <http://localhost:8000/docs> → `GET /ephemeris` → *Try it out*.
- Esquema OpenAPI: <http://localhost:8000/openapi.json>.
- Ejemplo: <http://localhost:8000/ephemeris?lat=0&lon=30&start=2026-11-30T06:00:00Z&days=1>

## Endpoint
`GET /ephemeris?lat=<°>&lon=<°>&start=<UTC>&days=<n>`

| Parámetro | Qué es | Rango |
|---|---|---|
| `lat` | latitud planetocéntrica, grados | -90 a 90 |
| `lon` | longitud este-positiva, grados | -180 a 180 |
| `start` | inicio, UTC ISO 8601 (`2026-11-30T06:00:00Z`) | 2026-11-01 a 2027-02-28 |
| `days` | días de la ventana, paso de 1 h (por defecto 7) | 1 a 14; si pasa del 2027-02-28 se recorta |

| Código | Cuándo |
|---|---|
| 200 | Efemérides en formato `ephemeris.json` (`site_id` tipo `live-n0p0-e30p0`). |
| 422 | Latitud, longitud, fecha o `days` fuera de rango o con formato inválido. No se consulta a Horizons. |
| 502 | Horizons devolvió un error, no se pudo conectar, o respondió algo que no coincide con lo pedido. |
| 504 | Horizons no respondió a tiempo. |

La API **nunca devuelve datos inventados**: si Horizons falla, responde el error. Cada consulta se guarda en `data/raw/horizons/` (no versionado); repetirla no vuelve a llamar a Horizons.

## Conectar la web
La caja de latitud y longitud de la web aparece **solo si hay una URL de API**. En local, crear `web/.env.local` (no se commitea):
```
VITE_API_URL=http://localhost:8000
```
y correr `npm run dev` en `web/`. Sin esa variable la web funciona como siempre, con los sitios precalculados. En el deploy a GitHub Pages, la URL va en la variable de repositorio `VITE_API_URL` (Settings → Secrets and variables → Actions → Variables).

CORS permite `localhost:5173`, `localhost:4173` y `https://vainstubtomas.github.io`. Para otros orígenes: variable de entorno `CORS_ORIGINS` (separados por comas).

## Deploy en Render (ADR-015)
1. New → **Web Service**, conectar el repo, rama `main`.
2. Build command: `pip install -r data/api/requirements.txt`
3. Start command: `uvicorn data.api.main:app --host 0.0.0.0 --port $PORT`
4. Copiar la URL (`https://<nombre>.onrender.com`) a la variable de repositorio `VITE_API_URL` y relanzar el deploy de la web.
5. El plan gratuito duerme el servicio tras un rato sin tráfico: abrir `<URL>/docs` unos minutos antes de la demo para despertarlo. Plan B: la API en una notebook (`localhost`).

## Tests
```bash
.venv/bin/python -m pytest tests/test_api_ephemeris.py
```
Corren sin red con un Horizons falso (valores sintéticos, solo prueban formato, validaciones, errores y caché). El caso conocido (lat 0, lon 30 E, 2026-11-30T06:00:00Z) contra la respuesta guardada de Horizons lleva el marcador `network`: consulta Horizons la primera vez y después lee del caché.
