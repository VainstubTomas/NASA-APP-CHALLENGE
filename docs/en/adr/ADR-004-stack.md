# ADR-004: Technology stack

- **Status**: Proposed (to be confirmed with the whole team). The ephemerides part was replaced by ADR-006
- **Date**: 2026-11-12

## Context
Parts 1 and 2 are scientific calculation; part 3 is a visualization web app. We need well-known tools, quick to install and with abundant examples, so that Claude and the team move forward without friction.

## Decision
**Precalculation (Python 3.11+)**: `numpy`, `requests` (JPL Horizons API, see ADR-006; replaces `spiceypy`), `rasterio` and `pyproj` (elevation map and its projection; source per ADR-006), `matplotlib` (test charts), `pytest` and `jsonschema` (tests and contract). `.py` scripts, not notebooks. Virtual environment in `.venv`.

**Web**: Vite + JavaScript, no heavy framework. Horizon drawing in SVG or canvas, with D3 only if it helps; timelines with the simplest tool. Vite serves `data/public/` as a static folder (`publicDir: '../data/public'`).

**Deployment**: GitHub Pages or Vercel from `main`.

**Backup plan**: Google Colab for anyone who cannot install `rasterio` (it usually fails on Windows; alternative: Anaconda).

## Discarded alternatives
- Calculation in the browser with astronomy libraries: few guarantees with lunar ephemerides and terrain.
- Server-side backend: more pieces that can fail during the demo.
- Full framework (React or other) from the start: startup cost without a clear need.

## Consequences
- Everyone installs and tests their environment before Friday night (see layer 0).
- The exact charting library may be adjusted with a new ADR if the frontend needs it.
