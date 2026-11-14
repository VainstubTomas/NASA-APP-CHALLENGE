# ADR-001: Chosen challenge and MVP scope by layers

- **Status**: Accepted (layer 4 priority replaced by ADR-009; scope of layers 2 and 5, flat Moon and relief at the end, replaced by ADR-011)
- **Date**: 2026-11-12
- **Decided by**: full team

## Context
We chose the lunar landing site navigation challenge (south pole): given a site and a date, show whether there will be Sun and direct communication with the Earth. We have about 15 effective working hours (≈10 on site and ≈5 in the Saturday night session), 4 people with uneven experience, and official resources that are released on Friday.

## Decision
Build a static web app that reads precalculated data, organized in **MVP layers** where each one is a complete demo on its own (see `docs/en/01-PRD.md`). Goal: layers 1 to 3 secured, layer 4 as a probable stretch goal, layer 5 only if time allows. Freeze features on Sunday 15 at 12:30.

## Discarded alternatives
- Live calculation in the browser or on a server: more risk, more work, and depends on the internet during the demo.
- 3D visualization of the terrain: eye-catching but outside the available hours.
- Covering the whole pole with illumination maps: a different problem and much heavier.

## Consequences
- Heavy calculations must be precalculated before Saturday; that is why layer 0 comes first.
- "Cut, do not stretch": in case of delay, drop one layer rather than stretching time.
- The official name of the challenge and the evaluation criteria are added to `docs/en/00-CONTEXT.md` when the resources are released.
