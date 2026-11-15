> 🇪🇸 [Leer en español](../../adr/ADR-015-api-horizons-en-vivo.md)

# ADR-015: Own API in `data/api/` to query Horizons live for a user-chosen site

- **Status**: Proposed
- **Date**: 2026-11-14
- **Decided by**: pending team confirmation (proposal from issue #104)

## Context
Today the web app only shows the sites in `data/public/sites.json`, with ephemerides precomputed offline. An arbitrary point on the Moon has no stored data. Issue #104 asks that the user enters a latitude, longitude and date, and that the web app gets the Sun and Earth azimuth and elevation from JPL Horizons.

This changes two things that are written down today: Python and the web app "only talk through the JSON files in `data/public/`" (ADR-002), and deployment is static, with no server (ADR-004, GitHub Pages from `main`).

On 2026-11-14 we checked with `curl` that the Horizons API (`ssd.jpl.nasa.gov/api/horizons.api`) **does not return an `Access-Control-Allow-Origin` header**, even when sending an `Origin`. A browser cannot query it directly from our web app: an intermediary is needed.

## Decision
1. **The API is a small Python service in `data/api/`** that reuses `precompute/ephemeris/horizons_client.py` (query already validated in ADR-006: `CENTER='coord@301'`, `COORD_TYPE='GEODETIC'`, `QUANTITIES='4'`, `APPARENT='AIRLESS'`, UTC). The query and its parser are not rewritten.
2. **Proposed stack: FastAPI + uvicorn.** It validates parameters and ranges, and the team already uses Python. They are added to `precompute/requirements.txt` (or to a `data/api/requirements.txt`).
3. **A single endpoint**: `GET /ephemeris?lat=<deg>&lon=<deg>&start=<UTC>&days=<n>`. It answers with **the same format as `ephemeris.json`** (`schema_version: 1.0`, 1 h step, `source` with the query). The contract and its schema do not change.
   - `lat` in [-90, 90] (planetocentric), `lon` in [-180, 180] (east-positive), `start` ISO 8601 in UTC, `days` from 1 to 14 (default 7, the timeline window).
   - Invalid input: 422 error with the reason. If Horizons fails or does not answer: 502 error with a clear message. **Made-up data, or data from another site, is never returned.**
   - Two Horizons queries per request (Sun and Earth), using the `data/raw/horizons/` cache the client already has.
4. **Horizon for a free site: smooth Moon** (360 zeros, ADR-011). The web app builds that horizon on the client and shows "ideal horizon, no relief".
5. **The web app decides per site**: those in `sites.json` keep reading the precomputed JSON files, with no API. The latitude and longitude input only appears if an API URL is configured (`VITE_API_URL`). Without it, the web app works as today, offline.
6. **CORS on our API**: allows only the deployed web app origin and the local development one.
7. **Documentation and manual testing: Swagger.** FastAPI publishes interactive documentation at `/docs` (Swagger UI), with descriptions and examples for every parameter, so the API can be tested without going through the web app.
8. **Where it runs**: locally with `uvicorn` (documented in `data/api/README.md`) and, for the online demo, **on Render** as a web service from the repo (start command `uvicorn data.api.main:app --host 0.0.0.0 --port $PORT`). Its URL goes in `VITE_API_URL` and the API allows the GitHub Pages origin through CORS. Pending team confirmation: who sets it up, and that the free plan puts the service to sleep after a while without traffic (the first request takes about a minute), so it has to be woken up before the demo. **Plan B**: the API on a laptop.

## Discarded alternatives
- **Calling Horizons from the browser**: not possible because of CORS (see Context).
- **Precomputing a grid of sites**: it does not cover a user-chosen point and adds heavy data to the repo.
- **Serverless function on GitHub Pages or Vercel**: Pages does not run server code; Vercel would force moving deployment and the API to the repo root (`api/`), not `data/api/` as the issue asks.
- **Server using only the standard library (`http.server`)**: it avoids a dependency, but validation, errors and CORS must be written by hand.

## Consequences
- There is a new piece to maintain and deploy. The "works offline during the demo" requirement (`docs/en/02-ARCHITECTURE.md`) only holds for precomputed sites; the live query needs network and the API running.
- Horizons is a live external dependency, and each query takes a few seconds. The web app must show a loading state and the error if it fails.
- `docs/02-ARCHITECTURE.md` and `docs/03-DATA-CONTRACT.md` are updated to say that, besides the JSON files, the web app can read the API with the same format.
- If accepted, issue #104 is split into sub-issues: API with tests, input in the web app, and integration.
- Cost: a free site has no relief; the Sun and Earth hours are those of a smooth Moon, not the real ones.
