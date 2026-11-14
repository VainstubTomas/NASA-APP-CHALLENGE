> 🇪🇸 [Leer en español](../03-DATA-CONTRACT.md)

# 03. Data contract (v1.0, approved)

Last update: 2026-11-14 · Status: **approved** by the team in issue C0-08 (ADR-002 accepted). The executable schemas are in `data/schema/`.

This is the agreement between Python and the web. Changing it requires an ADR and notifying the team. Every file carries `schema_version`.

## Conventions
| Topic | Rule |
|---|---|
| Azimuth | Degrees, 0° = north, clockwise, range [0, 360) |
| Elevation | Degrees above the local horizon, range [-90, 90] |
| Time | UTC. Stores `start_utc` (ISO 8601), `step_s` (seconds) and `count`; sample `i` is at `start_utc + i * step_s` |
| Series | In columns (parallel arrays), not a list of objects, so they stay light |
| Precision | Angles with 3 decimals at most |
| Coordinates | Planetocentric latitude and east-positive longitude, degrees, [-180, 180] |
| Frame | Topocentric, from the surface at the site's point |

## File structure
```
data/public/sites.json
data/public/sites/<site_id>/horizon.json
data/public/sites/<site_id>/ephemeris.json
data/public/sites/<site_id>/metrics.json        (layer 3)
```
`<site_id>` is a lowercase slug with hyphens (`shackleton-rim`).

## `sites.json`
```json
{
  "schema_version": "1.0",
  "sites": [
    {
      "id": "demo-sintetico",
      "name": "Sitio de demostración (datos sintéticos)",
      "lat_deg": -89.5,
      "lon_deg": 0.0,
      "source": "Dato inventado para desarrollo",
      "source_url": "",
      "synthetic": true
    }
  ]
}
```
Optional fields: `mission`, `country`, `notes`. Every real site carries a verified `source` and `source_url`. `synthetic: true` marks test data and **must be removed before delivery**.

> Note: the example's `id`, `name` and `source` values are kept as they appear in the schema example (Spanish text), since they are sample data.

## `horizon.json`
```json
{
  "schema_version": "1.0",
  "site_id": "demo-sintetico",
  "azimuth_start_deg": 0,
  "azimuth_step_deg": 1,
  "elevation_deg": [0.8, 0.9, "... 360 values ..."],
  "max_distance_km": 150,
  "observer_height_m": 0,
  "dem": { "name": "LDEM_80S_80MPP_ADJ", "pixel_m": 80 }
}
```
- `elevation_deg[i]` is the horizon elevation at azimuth `azimuth_start_deg + i * azimuth_step_deg`.
- The web interpolates linearly between samples and closes the circle (azimuth 359 connects to 0).
- **Flat Moon (ADR-011)**: until there is relief, `elevation_deg` is 360 zeros and `dem` is omitted (it is optional). It is the same format; the web does not distinguish, and when `dem` is missing it shows the warning "ideal horizon, no relief".
- `dem.name` and `dem.pixel_m` describe the map actually used (the source is fixed in ADR-006; the example shows the backup plan).

## `ephemeris.json`
```json
{
  "schema_version": "1.0",
  "site_id": "demo-sintetico",
  "time": { "start_utc": "2026-11-01T00:00:00Z", "step_s": 3600, "count": 2880 },
  "sun":   { "azimuth_deg": [], "elevation_deg": [] },
  "earth": { "azimuth_deg": [], "elevation_deg": [] },
  "angular_radius_deg": { "sun": 0.25, "earth": 1.0 },
  "source": "JPL Horizons API (parámetros de la consulta y fecha de descarga)"
}
```
- Each array has exactly `count` values.
- `angular_radius_deg` are nominal values for v1 (Sun ~0.5° diameter, Earth ~2°). A v1.1 may replace them with a variable radius per sample.

## `metrics.json` (layer 3)
```json
{
  "schema_version": "1.0",
  "site_id": "demo-sintetico",
  "time": { "start_utc": "2026-11-01T00:00:00Z", "step_s": 86400, "count": 120 },
  "daily": {
    "sun_hours": [],
    "earth_hours": [],
    "both_hours": []
  }
}
```
Hours per UTC day with the Sun visible, the Earth visible, and both at once, calculated with the visibility rule below. They serve to cross-check against what the web calculates.

## Visibility rule (confirmed, v1)
A body is **visible** at sample `i` if the upper edge of its disc is above the horizon at its azimuth:

```
visible(i) = elevation_deg[i] + angular_radius_deg > horizon(azimuth_deg[i])
```
and **fully visible** if `elevation_deg[i] - angular_radius_deg > horizon(azimuth_deg[i])`.

The team confirmed the upper edge as the official rule (versus the center and the full disc); it is fixed in ADR-002. Backend and web must implement **the same rule**.

## Validation
- `python -m pytest tests/test_contract.py` validates every JSON in `data/public/` against `data/schema/`.
- Regenerate synthetic development data: `python scripts/make_synthetic_data.py`.

## How to change the contract
1. Open an issue and describe the change.
2. Write an ADR (`docs/adr/`) explaining the reason.
3. Bump `schema_version` if the change breaks the web, and update schemas, test data and this document in the same PR.
