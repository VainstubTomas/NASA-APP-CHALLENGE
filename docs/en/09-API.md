> 🇪🇸 [Leer en español](../09-API.md)

# 09. Live ephemeris API

Last update: 2026-11-15 · Decision: [ADR-015](adr/ADR-015-live-horizons-api.md) · Code: [`data/api/`](../../data/api/) · Issue: #104

## What it is for
The sites in `data/public/sites.json` have precomputed ephemerides. For **any** point on the Moon (a latitude and longitude chosen by the user) there is no stored data, so the web app asks this API for it. The API queries **JPL Horizons** and answers in the same format as `ephemeris.json` ([contract](03-DATA-CONTRACT.md)).

The web app does not call Horizons directly: Horizons does not allow requests from the browser (CORS). That is why this intermediary is needed. The precomputed sites keep working without the API and offline.

## Try it in 1 minute
From the repo root:
```bash
pip install -r data/api/requirements.txt
python -m uvicorn data.api.main:app --reload --port 8000
```
- **Swagger UI**: <http://localhost:8000/docs>. Open `GET /ephemeris` → *Try it out* → *Execute*. The parameters come with examples.
- **curl**:
  ```bash
  curl "http://localhost:8000/ephemeris?lat=0&lon=30&start=2026-11-30T06:00:00Z&days=1"
  ```
- OpenAPI schema: <http://localhost:8000/openapi.json>.

## The endpoint
`GET /ephemeris?lat=<deg>&lon=<deg>&start=<UTC>&days=<n>`

| Parameter | What it is | Range |
|---|---|---|
| `lat` | Planetocentric latitude, degrees | -90 to 90 |
| `lon` | East-positive longitude, degrees | -180 to 180 |
| `start` | Start, UTC ISO 8601 (`2026-11-30T06:00:00Z`) | 2026-11-01 to 2027-02-28 |
| `days` | Window length in days, one sample per hour. Default 7 | 1 to 14. If it goes past 2027-02-28 it is trimmed |

Conventions: azimuth in degrees with 0° = north, clockwise; elevation in degrees above the horizon; time in UTC; topocentric frame (from the chosen point). They are the same as in the rest of the project.

### Example response
For `lat=0&lon=30&start=2026-11-30T06:00:00Z&days=1` (only the first 3 of the 24 samples are shown; the Sun values are verified against Horizons, the Earth values are not):
```json
{
  "schema_version": "1.0",
  "site_id": "live-n0p0-e30p0",
  "time": { "start_utc": "2026-11-30T06:00:00Z", "step_s": 3600, "count": 24 },
  "sun":   { "azimuth_deg": [268.498, 268.496, 268.493], "elevation_deg": [-10.816, -11.322, -11.829] },
  "earth": { "azimuth_deg": [270.41, 270.577, 270.743],  "elevation_deg": [66.164, 66.191, 66.217] },
  "angular_radius_deg": { "sun": 0.25, "earth": 1.0 },
  "source": "JPL Horizons API (...), center coord@301 at lat 0, lon 30 (east-positive), live query; downloaded ..."
}
```
- `site_id` encodes the position: `live-` + latitude (`n` north, `s` south) + longitude (`e` east, `w` west), with `p` instead of the decimal point. Example: `live-s89p5-e0p0` is 89.5° S and 0° E.
- Every array has exactly `time.count` values, and the azimuth is in [0, 360).
- Note: the `source` text comes from the code and is in Spanish.

### Errors
| Code | When | What to do |
|---|---|---|
| 422 | Latitude, longitude, date or `days` out of range or badly formatted. Horizons is not queried. | Fix the parameter; the body says which one |
| 502 | Horizons returned an error, could not be reached, or answered something that does not match the request | Retry; if it persists, check Horizons' status |
| 504 | Horizons did not answer in time | Retry in a while |

**The API never returns made-up data**: if Horizons fails, it answers the error and there is no data.

## How the web app uses it
- If an API URL is configured (`VITE_API_URL`), the web app shows the "Free position on the Moon" section: two inputs (latitude and longitude) that use the date from the selector.
- The web app validates the ranges before calling the API and shows the error if it fails. Each query asks for the 7 days from the start of the chosen UTC day and is kept while the person stays on that day.
- The horizon of a free position is **ideal** (smooth Moon, 360 zeros, ADR-011): the web app warns "ideal horizon, no relief". The Sun and Earth hours are those of a Moon without mountains, not the real ones.
- Without `VITE_API_URL` the section does not appear and the web app works only with the precomputed sites.
- Code: `web/src/live-core.js` (logic, tested with `npm test`) and `web/src/live.js` (form).

## Technical details
- The Horizons query is the one validated in [ADR-006](adr/ADR-006-official-resources.md): `CENTER='coord@301'`, `COORD_TYPE='GEODETIC'`, `QUANTITIES='4'`, `APPARENT='AIRLESS'`, 1-hour step. It is built by `precompute/ephemeris/horizons_client.py`, the same client used by the precomputation.
- Every query is saved in `data/raw/horizons/` (not versioned): repeating it does not call Horizons again.
- Two Horizons queries per request (Sun and Earth); they can take a few seconds.
- CORS allows `localhost:5173`, `localhost:4173`, GitHub Pages and the Vercel domain. For other origins, use the `CORS_ORIGINS` environment variable (comma-separated).

## Tests
```bash
python -m pytest tests/test_api_ephemeris.py     # API
cd web && npm test                               # web logic (live-core.test.js)
```
The API tests run offline with a fake Horizons (synthetic values that only test format, validation, errors and cache). The known case (lat 0, lon 30 E, 2026-11-30T06:00:00Z) is compared against the saved Horizons response (`docs/adr/evidencia/ADR-006-horizons-web/`) and carries the `network` marker.

## More information
- How to run it, deploy and variables: [`data/api/README.md`](../../data/api/README.md) (Spanish) or [`data/api/README.en.md`](../../data/api/README.en.md).
- Decision and discarded alternatives: [ADR-015](adr/ADR-015-live-horizons-api.md).
- Response format: [data contract](03-DATA-CONTRACT.md), `ephemeris.json` section.
