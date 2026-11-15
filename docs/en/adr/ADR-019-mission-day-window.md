> 🇪🇸 [Leer en español](../../adr/ADR-019-ventana-de-mision.md)

# ADR-019: Go to the day of a historic mission with a precomputed ephemeris window

- **Status**: Proposed
- **Date**: 2026-11-15
- **Decided by**: the team (who confirms is still to be recorded). Option A was chosen among four in the 2026-11-15 design conversation.

## Context
The sites in `sites.json` include historic missions (Apollo 11 to 17, Chang'e 3, 4 and 6, Chandrayaan-3, SLIM, Blue Ghost 1, IM-1 and IM-2), but the web only lets you pick dates from today to 2027-12-31: the range of the `ephemeris.json` files and of the live API. A person cannot see the sky on the day a mission landed.

It was measured on 2026-11-15 that Horizons answers for 1969: with the coordinates in `sites.json`, the Sun and Earth of the six Apollo missions match the Scotti table in NASA's Apollo Lunar Surface Journal within 0.05° for the Sun and 0.4° for the Earth (the table uses other coordinates and the Nautical Almanac).

## Decision
1. **Each site with a mission carries `landing_utc`** (UTC, ISO 8601), `landing_source` and `landing_source_url` in `sites.json`. They are optional. They are not invented: for Apollo they come from Orloff via ALSJ (to the second); for the rest they are published sources, to the minute. The two with a secondary source (Chandrayaan-3 and IM-2) say so in `landing_source`.
2. **`data/public/sites/<id>/mission.json`**: the site's ephemeris with **the same format and schema as `ephemeris.json`** (contract v1.0, unchanged), one sample per hour, from 3 days before to 3 days after the landing time (hour rounded down; 145 samples). `precompute/ephemeris/build_mission.py` generates them from Horizons.
3. **Mission mode on the web**, with no separate switch: if the date falls inside the site's mission window, the ephemeris comes from `mission.json` and the slider spans that window. Outside it the usual range applies (today to 2027-12-31). The rule lives in `web/src/state.js` (`missionWindow`, `rangeFor`) and is the same as Python's `mission_window`; a test checks they match for all 14 missions.
4. **Entering and leaving**: in the search panel, "Go to the mission day" (only if the site has a mission) sets the date to the landing hour; a URL such as `?site=apollo-11&t=1969-07-20T20:00Z` also works. In mission mode, a notice under the date shows the landing time and offers "Back to current dates". Changing site also leaves the mission.
5. **Scope**: the validation panel (Horizons reference values for current dates) is hidden in mission mode, and the scenario comparison keeps the normal range. The relief (`horizon.json`) does not depend on the date and is reused.

## Alternatives rejected
- **B. Live API for historic dates**: adds no files, but depends on the API being awake (free Render is slow) and widens the ADR-015 exception.
- **C. Precompute from 1969 to 2027**: at an hourly step that is ~500,000 samples per site and body; with a daily step "hours of light" loses its meaning.
- **D. Hybrid (A plus B as a fallback)**: more work than the value it adds for the demo; it can be added later on top of A.

## Consequences
- One new file per mission (~8 KB each, ~112 KB for the 14) and three optional fields in `sites.json`.
- Validation against published data covers the 6 Apollo missions (`tests/test_mission_window.py`). For the other 8 validation is against Horizons only: no independent Sun and Earth table was found.
- Apollo 16 landed on 1972-04-21 02:23:35 UTC; NSSDC lists 20/04 because it uses Houston local date. UTC is always stored.
- The Chandrayaan-3 (ISRO) and IM-2 (Intuitive Machines or NASA) times are still to be confirmed with a primary source. A one-minute error does not change the ±3 day window.
