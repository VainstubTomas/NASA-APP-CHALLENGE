# ADR-011: Flat Moon first, date from the start and relief at the end

- **Status**: Proposed
- **Date**: 2026-11-14
- **Decided by**: pending confirmation by the team (Saturday morning proposal)
- **Partly replaces**: ADR-001 (scope of layers 2 and 5) and ADR-006 (the elevation map stops being part of layer 0)

## Context
The official resources did not bring an elevation map (ADR-006). Getting it and turning it into a 360-value horizon (C0-03, C0-06 and C2-01) is the most uncertain part of the project and today blocks layer 2, which is the minimal demo on Saturday at 14:30. In addition, Horizons already delivers topocentric azimuth and elevation over a flat lunar sphere, so with those numbers alone the whole web can be built and validated.

## Decision
1. **We start with a smooth lunar sphere, no relief.** The local horizon is 0° of elevation at all 360 azimuths (no refraction, because the Moon has no atmosphere). A body is visible if `elevation + angular radius > 0` (the contract's rule with a 0 horizon). Layers 1 to 4 are built this way.
2. **The date and time are entered from the first screen.** The UTC date and time selector is the first thing built in the web (C1-02) and the state goes in the URL. There is no version of the web without a date, not even with synthetic data.
3. **Real relief (LOLA elevation map) is left for last**, inside layer 5 and after the other extras. If it does not arrive, the project is still complete.

### What changes in the contract
Nothing. `horizon.json` is still generated for each site, with 360 zeros and without the optional `dem` field. The web reads the same with or without relief: when relief arrives only the data changes, not the code.

### Issues that change
| Before | Now |
|---|---|
| C0-03 Get the elevation map | **C5-05** (layer 5, relief) |
| C0-06 Horizon profile of 360 values | **C5-06** (layer 5, relief) |
| C2-01 Generate horizon.json for all sites | **C2-01** now generates the flat horizon (360 zeros). The version with relief is **C5-07** |
| C2-02 Drawing of the horizon with Sun and Earth | **C2-02** draws the flat horizon. Drawing the silhouette with relief is **C5-08** |
| Layer 2: "real horizon" | Layer 2: "flat horizon with the Sun and the Earth above it" |
| Layer 5: extras | Layer 5: extras and, at the end, real relief |

## Discarded alternatives
- **Leaving relief in layer 2**: the minimal demo would depend on data we do not have yet.
- **Dropping relief from the project**: the official text asks for real topography and it is what makes the south pole unique; it is kept as the final goal.
- **Flat horizon without a `horizon.json` file**: changes the contract and forces two code paths in the web.

## Consequences
- **The result is optimistic**: without relief, a site looks better than it is (a hill a couple of degrees high hides the Sun or the Earth). The web must visibly say "ideal horizon, no relief" (criterion of C2-02), and the pitch cannot claim the tool shows mountains hiding things until layer 5 arrives.
- **Apollo sites and sites far from the pole enter without problems**: the south pole map did not cover them, and with a flat horizon it no longer matters. This resolves the pending decision in C0-07.
- **More direct validation**: what the web shows uses the same geometry as Horizons, so the numbers can be compared one by one.
- **The critical path stays on Horizons** (C0-04, C0-05, C0-13): without the download and verified reading there is no layer 1.
- **Issues already created on GitHub**: they must be adjusted by hand (title, `capa:N` label and epic). Do not run `scripts/create_issues.py` again without reviewing it: it avoids duplicates by comparing titles, and the titles have changed.
- The order inside layer 5 is: extras (C5-01, C5-03, C5-04) and, last of all, relief (C5-05 to C5-08, with C5-02).
