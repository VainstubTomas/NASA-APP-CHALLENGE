> 🇪🇸 [Leer en español](../../adr/ADR-018-relieve-en-vivo.md)

# ADR-018: Real relief for a free position: `GET /horizon` in the API and the loader waits for the relief

- **Status**: Proposed
- **Date**: 2026-11-15
- **Decided by**: the team (who confirms is still to be recorded).
- **Replaces**: point 4 of [ADR-015](ADR-015-live-horizons-api.md) (flat horizon for the free site)

## Context
The sites in `sites.json` already have real relief: their `horizon.json` is computed offline from the LOLA map (`precompute/terrain/lola_horizon.py`, #13 and #16). In "Specific location" and "Lunar map", however, the API only returned ephemerides and the web app built the flat Moon (ADR-015, point 4). From the web app it looked like a bug: the same point had mountains in the historical mode and none in the free query.

The cost was measured on 2026-11-15 against the real NASA Moon Trek API:

| Point | Map | First query | Repeated (cache) |
|---|---|---|---|
| 10.5° N, 20.25° E | global 128 ppd (~260 KB) | 2.4 s | 0.1 s |
| 86.3° S, 45.1° E | polar 30 m (~9 MB) | 28.6 s | 0.1 s |

## Decision
1. **New `GET /horizon?lat&lon` endpoint** in `data/api/`, with the same structure as `/ephemeris`: response model in `main.py`, logic in `service.py` (no FastAPI) and 422/502/504 errors. It answers in the `horizon.json` format, with the same `live-...` `site_id` as the ephemerides.
2. **Same computation as the saved sites**: `service.build_live_horizon` calls `lola_horizon.site_horizon` (30 m polar map south of -75.7°; 128 ppd global map elsewhere; 20 km rays). There is no second algorithm.
3. **Coverage**: north of 85° the global map crop becomes too wide; there it answers the flat Moon **without `dem`** (the web app already shows "ideal horizon, no relief").
4. **Cache**: the crop stays in `data/raw/` (`dem_<site_id>.tif` or `dem30_<site_id>.tif`, not versioned). An unreadable crop is deleted so the next request retries. A per-point lock avoids downloading the same crop twice at once.
5. **The web app waits for the relief with the central loader**: the relief is requested in parallel with the ephemerides, and the loader already used for the API stays visible until both arrive. The sky is drawn once, already with the relief (it does not appear flat first and with mountains later). The relief is cached per point (it does not depend on the date), so changing the date does not request it again. If it fails, the sky shows the flat horizon and the query status says so.

## Discarded alternatives
- **Showing the flat sky first and drawing the relief on top when it arrives** (two-stage loading): the loader is shorter, but the horizon changes in front of the person and for a few seconds the Sun and Earth hours are not the real ones. The team preferred to keep the loader until the full data is there.
- **Computing the relief in the browser**: the map would have to be downloaded from the web app (Moon Trek and CORS) and the computation ported to JavaScript, duplicating what is already validated in Python.
- **Global map for the whole Moon**: the file is 2.2 GB; only the crop around each point is still requested.

## Consequences
- The Sun and Earth hours of a free position now take the relief into account, like the saved sites.
- The API needs `rasterio` and `pyproj` (added to `data/api/requirements.txt`) and also depends on Moon Trek.
- On free Render the disk is not persistent: the crop cache is lost when the service sleeps, and the computation can be slower due to the limited CPU.
- Cost: the first query of a south-pole point keeps the loader ~30 s (outside the pole, ~2–3 s more than before). Later queries of the same point add no wait.
