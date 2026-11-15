> 🇪🇸 [Leer en español](../../adr/ADR-016-vista-3d-del-cielo.md)

# ADR-016: 3D sky view with the flat horizon

- **Status**: Proposed
- **Date**: 2026-11-14
- **Decided by**: to be confirmed by the team (records a decision already made in PR #88, issue #30)

## Context
The PRD and ADR-001 left "3D visualization of the terrain or realistic rendering of the surface" out of scope because it did not fit in the hackathon hours. On Saturday 14, PR #88 was merged: a 3D sky view (three.js) that shows the Sun and the Earth over the flat horizon, with a draggable view. Nobody wrote an ADR, so the docs and the code said different things.

The official challenge text invites teams to explore "2D maps, 3D surface visualizations, or other creative representations".

## Decision
The 3D **sky** view is in scope. It uses the same data as the rest of the web app (`ephemeris.json` and `horizon.json`) and computes nothing of its own. Realistic rendering of the **terrain** (relief, surface textures) stays **out** of scope: real relief only reaches `horizon.json`, in layer 5 (ADR-011).

## Rejected alternatives
- **Remove the 3D view:** it was already built and tested, and it speaks to the challenge's "Multiple visualization approaches" and to the Presentation criterion.
- **Grow it into realistic 3D terrain:** that is exactly what ADR-001 ruled out for time, and without real relief it would show made-up mountains.

## Consequences
- The PRD changes its "Out of scope" line: realistic terrain rendering is out, the 3D sky view is not.
- The web app lazy-loads three.js (about 120 kB gzipped) and, if the browser has no WebGL, falls back to the 2D compass and elevation ruler.
- three.js (MIT) is listed in the README credits.
- The 3D view shows the ideal horizon; the "ideal horizon, no terrain" notice is still required.
