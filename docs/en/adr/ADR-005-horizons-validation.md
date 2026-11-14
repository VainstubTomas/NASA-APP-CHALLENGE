# ADR-005: Validation against JPL Horizons

- **Status**: Partly replaced by ADR-006: Horizons went from being the reference to being the source of the ephemerides. The idea of saving reproducible references in `tests/reference/` remains in force
- **Date**: 2026-11-12

## Context
The biggest risk of the project is not that something fails to work, but that it works and gives a false result that looks reasonable: crossed axes, wrong azimuth convention, wrong reference frame, or badly converted time. Claude cannot know whether an angle is correct.

## Decision
- **JPL Horizons is the source of truth** for the azimuth and elevation of the Sun and the Earth from a point on the lunar surface.
- Reference values are saved in `tests/reference/` (CSV with site, UTC date, expected azimuth and elevation), obtained from Horizons for **3 sites and 3 dates** at minimum.
- `tests/` compares our calculation against that reference. The initial starting tolerance is **0.1°** in azimuth and elevation; it is adjusted with evidence in the first test and recorded here.
- Every change to the ephemeris calculation or to the visibility rule must pass these tests before merging into `dev`.
- Each reference file states how it was generated (Horizons query parameters) so it can be repeated.

## Discarded alternatives
- Validating by eye against Quickmap or Stellarium: useful as an extra check, not as a test.
- Trusting the calculation without an external reference: exactly the risk we want to avoid.

## Consequences
- Whoever takes the validation issue maintains the reference tests; the demo's validation panel is fed from them.
- Secondary validation of the terrain: compare our horizon roughly against the percentage of time in light from NASA's illumination maps (should look similar in broad strokes).
