> 🇪🇸 [Leer en español](README.md)

# Live ephemeris API (issue #104, ADR-015)

FastAPI service that queries **JPL Horizons** for a free position on the Moon (latitude, longitude) and returns the Sun and Earth azimuth and elevation in **the same format as `ephemeris.json`** (`docs/en/03-DATA-CONTRACT.md`). The web app does not call Horizons: Horizons does not allow CORS, so it goes through this API. The sites in `sites.json` keep using the precomputed JSON files. A full usage guide is in [`docs/en/09-API.md`](../../docs/en/09-API.md).

- `main.py`: the app (endpoint, parameter validation, errors, CORS and Swagger documentation).
- `service.py`: builds the response reusing `precompute/ephemeris/horizons_client.py` (query validated in ADR-006).

## Run it locally
From the **repo root**:
```bash
.venv/bin/pip install -r data/api/requirements.txt     # or: uv pip install --python .venv/bin/python -r data/api/requirements.txt
.venv/bin/python -m uvicorn data.api.main:app --reload --port 8000
```
- **Swagger UI** (manual testing): <http://localhost:8000/docs> → `GET /ephemeris` → *Try it out*.
- OpenAPI schema: <http://localhost:8000/openapi.json>.
- Example: <http://localhost:8000/ephemeris?lat=0&lon=30&start=2026-11-30T06:00:00Z&days=1>

## Endpoint
`GET /ephemeris?lat=<deg>&lon=<deg>&start=<UTC>&days=<n>`

| Parameter | What it is | Range |
|---|---|---|
| `lat` | planetocentric latitude, degrees | -90 to 90 |
| `lon` | east-positive longitude, degrees | -180 to 180 |
| `start` | start, UTC ISO 8601 (`2026-11-30T06:00:00Z`) | 2026-11-01 to 2027-12-31 |
| `days` | window length in days, 1-hour step (default 7) | 1 to 14; trimmed if it goes past 2027-12-31 |

| Code | When |
|---|---|
| 200 | Ephemerides in `ephemeris.json` format (`site_id` like `live-n0p0-e30p0`). |
| 422 | Latitude, longitude, date or `days` out of range or badly formatted. Horizons is not queried. |
| 502 | Horizons returned an error, could not be reached, or answered something that does not match the request. |
| 504 | Horizons did not answer in time. |

The API **never returns made-up data**: if Horizons fails, it answers the error. Every query is saved in `data/raw/horizons/` (not versioned); repeating it does not call Horizons again.

## Connect the web app
The latitude and longitude box in the web app appears **only if there is an API URL**. Locally, create `web/.env.local` (not committed):
```
VITE_API_URL=http://localhost:8000
```
and run `npm run dev` in `web/`. Without that variable the web app works as usual, with the precomputed sites. For the GitHub Pages deploy, the URL goes in the repository variable `VITE_API_URL` (Settings → Secrets and variables → Actions → Variables). In **Vercel**, it goes in the project's Settings → Environment Variables (same name), and it must be redeployed.

CORS allows `localhost:5173`, `localhost:4173`, `https://vainstubtomas.github.io` and `https://vizcachasfueradeorbita.vercel.app` (Vercel, production). Vercel previews (`...-git-...vercel.app`) have a different domain on every branch and are not allowed. For other origins: `CORS_ORIGINS` environment variable (comma-separated).

## Deploy on Render (ADR-015)
1. New → **Web Service**, connect the repo, branch `main`.
2. Build command: `pip install -r data/api/requirements.txt`
3. Start command: `uvicorn data.api.main:app --host 0.0.0.0 --port $PORT`
4. Copy the URL (`https://<name>.onrender.com`) to the repository variable `VITE_API_URL` and redeploy the web app.
5. The free plan puts the service to sleep after a while without traffic: open `<URL>/docs` a few minutes before the demo to wake it up. Plan B: the API on a laptop (`localhost`).

## Tests
```bash
.venv/bin/python -m pytest tests/test_api_ephemeris.py
```
They run offline with a fake Horizons (synthetic values that only test format, validation, errors and cache). The known case (lat 0, lon 30 E, 2026-11-30T06:00:00Z) against the saved Horizons response carries the `network` marker: it queries Horizons the first time and then reads from the cache.
