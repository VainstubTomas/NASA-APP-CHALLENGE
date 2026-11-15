> 🇪🇸 [Leer en español](../02-ARCHITECTURE.md)

# 02. Architecture

Last update: 2026-11-14

## Core idea
The problem is split into **three independent pieces**. The first two run in Python **before** the demo and produce JSON files. The third is a static web app that reads those files and compares. This way the web is fast, does not depend on the internet during the demo, and nobody blocks anybody: the web starts with synthetic data while Python calculates the real data.

```
   Horizons API ───► [1. Ephemerides] ──► ephemeris.json ─┐
   (JPL, cache)       precompute/ephemeris/                 │
                                                            ├──► [3. Web] ──► screen
   Flat Moon (layers 1 to 4) ► [2. Terrain] ► horizon.json ─┘     web/
   LOLA DEM (layer 5, last) precompute/terrain/                  compares elevation vs horizon
   (Moon Trek/Quickmap or PDS)
                                                                  
   Saved Horizons responses ──► tests/ (validates the reading, the conventions and the visibility rule)
```

## Piece 1: where the Sun and the Earth are
- Input: site (lat/lon), date range. Source: **JPL Horizons API** (official challenge resource, ADR-006).
- Reference query (confirm against the API documentation in C0-04): observer table (`EPHEM_TYPE=OBSERVER`), target Sun (`10`) or Earth (`399`), observer on the lunar surface (`CENTER='coord@301'`, `COORD_TYPE=GEODETIC`, `SITE_COORD='lon,lat,alt_km'`), azimuth and elevation (`QUANTITIES=4`), degrees, 1 h step, no refraction (`APPARENT=AIRLESS`), UTC time.
- Raw responses are saved in `data/raw/horizons/` (not versioned) so queries are not repeated and the result can be reproduced.
- Output: `data/public/sites/<id>/ephemeris.json` with azimuth and elevation of the Sun and the Earth per hour (topocentric).
- Tools: `requests`, `numpy`.
- Cautions (verify with a known case before generating everything): that Horizons' azimuth is 0° = north and clockwise, that longitude is east-positive, that the query latitude matches our planetocentric latitude, the time scale (UTC), and the row limit per query (split the range if needed).

## Piece 2: what the horizon looks like
**Stage 1, flat Moon (layers 1 to 4, ADR-011).** No elevation map: the horizon is 0° at all 360 azimuths. A trivial script writes `horizon.json` with 360 zeros and without the optional `dem` field, so the web always reads the same file. Horizons numbers are already topocentric over a smooth sphere, so they match this horizon without conversion.

**Stage 2, real relief (layer 5, last).** What follows in this section describes that stage; it is only done if time allows and replaces the zeros with real values without touching the web.

- Input: LOLA height map of the south pole and the site coordinates. The official resources do not include the file: the source (Moon Trek, Quickmap or, as backup, `LDEM_80S_80MPP_ADJ.TIF` from the PDS, 80 m per pixel, polar stereographic in meters) is fixed in C5-05 (formerly C0-03) and noted in ADR-006.
- Process: from the point, in each of the 360 directions walk the terrain up to ~150 km and keep the maximum elevation angle the observer sees.
- Output: `data/public/sites/<id>/horizon.json` with 360 horizon elevation values.
- Tools: `rasterio`, `pyproj`, `numpy`.
- Cautions: convert lat/lon to pixels with the library, units (meters vs kilometers), lunar curvature, memory (medium resolution or cropping).

## Piece 3: what is seen
- For an instant, the body is visible if its elevation is above the horizon elevation at its azimuth (exact provisional rule in `03-DATA-CONTRACT.md`).
- The web computes visibility hour by hour by combining both JSON files, draws the panorama, and derives hours of light, hours with the Earth, and the countdown.
- `metrics.json` (Python) carries the same numbers precalculated in order to **cross-check results**: if the web and Python do not match, there is a bug.

## Data structure in the repo
The heavy data in `data/raw/` is distributed as a `.zip` on Google Drive: https://drive.google.com/file/d/1eHksUGXfSD7nCEHd5K7PTSbDYjdNmFKH/view?usp=sharing. Unzip it into `data/raw/` before running `precompute/`.
```
data/raw/                      elevation map and Horizons cache (NOT versioned; copy in the team's cloud)
data/public/sites.json         list of sites
data/public/sites/<id>/        horizon.json, ephemeris.json, metrics.json
data/schema/*.schema.json      contract schemas
```
The web serves `data/public/` as a static folder (Vite `publicDir`), so there is no intermediate copy. Format details in `03-DATA-CONTRACT.md`.

## Web
- Vite + JavaScript, no heavy framework. Horizon drawing in SVG or canvas (see ADR-004).
- State in the URL (`?site=...&t=...`) so it can be shared.
- Works offline during the demo (everything is static) for the precomputed sites.
- **Live query (ADR-015, #104)**: if `VITE_API_URL` is set, the web app adds a latitude and longitude input that asks the API in `data/api/` (FastAPI, see its README) for the ephemerides; the API queries Horizons and answers in the `ephemeris.json` format. It is the only exception to "Python and the web app only talk through the JSON files in `data/public/`"; it needs network and the API running.
- Deployment: GitHub Pages or Vercel from `main`.

## Validation
Horizons is the source, so `tests/` verifies that we read it correctly: it compares `ephemeris.json` against Horizons responses saved in `tests/reference/` and, by hand, against the Horizons web interface at 3 sites and 3 dates (see ADR-006, which partly replaces ADR-005). In addition, `tests/test_contract.py` validates that every JSON in `data/public/` meets the schema.

## Heavy data
Not committed. Whoever downloads it uploads it to the team's shared folder (cloud) and leaves the path in the download issue. Backup plan if the internet fails on site: copy on a USB drive and Google Colab for Python.

## Open decisions
- Custom user coordinates (precalculated grid or server).
- Variable angular radius of the Sun and the Earth (v1 uses nominal values; Horizons may give the angular diameter in the same query, to be confirmed).
