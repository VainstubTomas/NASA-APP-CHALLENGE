> 🇪🇸 [Leer en español](../01-PRD.md)

# 01. PRD: Lunar Landing Site Navigator

Last update: 2026-11-14 · Status: draft to validate with the team

## Problem
To plan a landing near the lunar south pole you need to know, for a place and a date, whether there will be Sun (energy, temperature) and line of sight with the Earth (communication). With the Sun and the Earth a few degrees above the horizon, a hill of a couple of degrees hides them, and moving 1 km or delaying 2 days changes the result. The information exists in NASA tools, but they are hard to use for non-specialists.

## Users
| User | What they need |
|---|---|
| Student or curious person | Understand in 5 seconds whether a place works and why |
| Engineer or mission planner | Verifiable numbers (elevation, azimuth, hours of light and contact) and comparing scenarios |
| Jury | See a clear and credible demo, with validation against official sources. We aim for Best Use of Data and Best Use of Science (ADR-012) |

## Value proposition
Answer a single question visually and comparably: **do I have Sun and can I talk to Earth at this site and on this date?**

## Scope: MVP by layers
Each layer is a complete demo. If something breaks, we show the last one that works.

| Layer | Deliverable | Priority |
|---|---|---|
| 0 | Repo, data contract, test data, test deploy, tests against Horizons | Before Saturday |
| 1 | Choose site, date and time from the first screen; see elevation and azimuth of the Sun and the Earth | Mandatory |
| 2 | Flat horizon drawing (smooth sphere Moon, no relief, 0°) with the Sun and the Earth above it | Mandatory |
| 3 | Multi-day timeline and countdown until they set | Mandatory |
| 4 | Comparison of 2 or 3 scenarios side by side | Mandatory (ADR-009) |
| 5 | "The launch was delayed", best windows, simple explanations and, **last of all**, real relief (elevation map, horizon with mountains, terrain slope) | Only if time allows |

Goal: layers 1 to 4 (layer 4 was raised in priority by ADR-009 because it is the core of the official text). If there is a delay, we cut as before: we show the last layer that works.

**Flat Moon first (ADR-011).** Layers 1 to 4 assume a sphere Moon with no relief: the horizon is 0° in every direction. Real relief arrives at the end and only changes the data in `horizon.json`, not the web. Meanwhile the web shows "ideal horizon, no relief": the result is optimistic, because a hill of a couple of degrees can hide the Sun or the Earth.

## Out of scope
- 3D visualization of the terrain or realistic rendering of the surface.
- Real relief before layers 1 to 4 are closed (ADR-011).
- Calculating illumination for the whole pole (only the listed sites and, at most, a grid).
- Production backend, user accounts, database.
- Native mobile app (the web must look good on a phone, nothing more).
- Trajectory, fuel or landing vehicle simulation.
- Any feature that is not in an issue of the current layer.

## Functional requirements (summary)
1. List of 10 to 20 sites with verified coordinates and source.
2. Date and time selector (UTC) from the first screen, and a time player.
3. For each instant: azimuth and elevation of the Sun and the Earth, and whether each one is visible above the horizon.
4. Horizon of the site drawn with the Sun and the Earth as discs: flat (0°) through layer 4, and a 360° silhouette with relief when layer 5 arrives.
5. Metrics: hours of light per day, hours with the Earth visible, time until the next sunset.
6. The URL stores site and date so it can be shared.

## Non-functional requirements
- **Correctness**: the angles are those of JPL Horizons, read without errors of convention, units or time (verification in ADR-006).
- **Performance**: the web does no heavy calculation; it reads precalculated JSON and works offline during the demo.
- **Clarity**: plain-language text, understandable by a high-school student.
- **Responsive**: looks good on a phone.

## Success criteria
1. For a known site and date, the web shows the same values as the Horizons interface (automated test passing).
2. The demo tells a complete story in under 3 minutes (see `06-PITCH-DEMO.md`).
3. Anyone new understands what the screen shows without explanation.
4. The repo runs from scratch following the README.
5. Every number on the screen says which NASA data it comes from (Horizons, LRO/LOLA), and the demo shows the validation against Horizons (C3-06). This is what supports Best Use of Data and Best Use of Science (ADR-012).

## Main risks
| Risk | Mitigation |
|---|---|
| A false result that looks reasonable (axes, azimuth, units) | Conventions written in `CLAUDE.md` and validation against Horizons from layer 0 |
| Without relief, the tool is optimistic (shows Sun or Earth where a mountain would hide them) | Visible warning "ideal horizon, no relief" in the web and in the pitch (ADR-011); relief is added in layer 5 |
| Misuse of the LOLA map projection (layer 5 only) | Use `pyproj`/`rasterio`, never convert by hand |
| Huge files (layer 5 only) | Medium resolution or cropping the south pole; data outside git |
| Little effective time | Precalculate the heavy parts on Friday, aim for layers 1 to 4, cut without guilt |
| Official resources do not include data files (only Quickmap, Moon Trek, Horizons and the CSA portal) | ADR-006: ephemerides from the Horizons API; elevation map to be confirmed in C5-05, formerly C0-03, with a backup plan |
| Horizons down or rate-limited during the event | Download everything before Saturday; cache in `data/raw/horizons/` and a copy in the cloud |

## Open questions
- Custom coordinates: precalculated grid or a small server? (decide in an ADR; by default, only the listed sites).
- Visibility rule: does a body count as visible with its center or its edge above the horizon? (see `03-DATA-CONTRACT.md`, provisional rule).
- Time range of the data (by default, from November 2026, hourly resolution).
