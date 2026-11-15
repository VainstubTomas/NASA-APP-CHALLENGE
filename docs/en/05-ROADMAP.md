> 🇪🇸 [Leer en español](../05-ROADMAP.md)

# 05. Roadmap and initial issues

Last update: 2026-11-14 · Source of truth for issues: `scripts/issues.json`. This document is maintained by hand: if `issues.json` changes, it is updated here in the same PR. The general map of the phases is in the [README](../../README.md#project-map).

Issues are loaded into GitHub with `python scripts/create_issues.py` (see `04-GIT-WORKFLOW.md`). Each layer is an **epic** (`[EPICA] ...`, parent issue) and its issues hang from it as sub-issues (see "Epics" in `04-GIT-WORKFLOW.md` and ADR-008). Each issue is a task of up to ~4 hours, with a single assigned owner, and layer, area and size labels. It is a multidisciplinary team: there are no fixed roles, and anyone takes issues from any area.

## Milestones

| When | Goal | Merge to `main` |
|---|---|---|
| Thu 12 (night) | Kickoff: repo, `main` protected, epics and issues loaded, mini Git session | Initial structure |
| Fri 13 | Resources released: adjust ADR-001 and PRD. Layer 0 complete, with Horizons downloaded for all sites (C0-13); dress rehearsal at night (Sun validated against Horizons) | Layer 0 |
| Sat 14, 09:30 to 12:30 | Layer 1; first integration (web reads real data) before 12:30 | |
| Sat 14, 13:30 to 14:30 | Layer 2 and minimal demo | **Minimal demo before 14:30** |
| Sat 14, 14:30 to 16:30 | Mentoring with invited jurors: `main` demoable. Take feedback as issues | |
| Sat 14, 17:00 to 19:00 and session at home until ~01:00 | Layer 3 and layer 4 | Whatever works, ~01:00 |
| Sun 15, 09:00 to 12:30 | Pending items, polish and texts | **12:30: freeze features** |
| Sun 15, 12:30 to 14:30 | Only `fix/*`, README and script | |
| Sun 15, 14:30 | Final adjustments and upload to GitHub | Final version |
| Sun 15, 16:30 | Defense before the jury | |

Rule: **cut, do not stretch**. If there is a delay, drop one layer and show the last one that works.

## Issues by layer

### Layer 0: base (before Saturday)

| ID | Task | Area | Size |
|---|---|---|---|
| C0-01 | Create the web project with Vite and publish a test version | Web | S |
| C0-02 | Reproducible, tested Python environment | Ephemerides | S |
| C0-04 | Horizons API client: azimuth and elevation of the Sun and the Earth from a lunar site | Ephemerides | L |
| C0-05 | Automated test against saved Horizons responses | Ephemerides | M |
| C0-07 | List of 10 to 20 sites with verified coordinates and source | Product | M |
| C0-08 | Review and approve data contract v1.0 | Web | S |
| C0-09 | Protect main, load labels, epics and issues, and set up the board | Product | S |
| C0-10 | Try Quickmap, Moon Trek and Horizons and note what is confusing | Product | S |
| C0-11 | Ask the organizers whether we can arrive with prior work | Product | S |
| C0-12 | Read the CSA Lunar Exploration portal and pull data for the pitch | Product | S |
| C0-13 | Download ephemerides for all sites from Horizons and cache them | Ephemerides | M |

> Issues C0-03 and C0-06 (elevation map and horizon profile) were moved to layer 5 as C5-05 and C5-06 (ADR-011). IDs are not reused.

### Layer 1: site, date and positions (mandatory)

| ID | Task | Area | Size |
|---|---|---|---|
| C1-01 | Script that generates ephemeris.json per site | Ephemerides | L |
| C1-02 | Site selector and date and time selector from the first screen | Web | M |
| C1-03 | Numbers panel: elevation and azimuth of the Sun and the Earth | Web | M |

### Layer 2: flat horizon with Sun and Earth (mandatory)

Smooth sphere Moon: the horizon is 0° in all directions (ADR-011).

| ID | Task | Area | Size |
|---|---|---|---|
| C2-01 | Generate flat horizon.json (360 zeros) for all sites | Terrain | S |
| C2-02 | Smooth horizon drawing with the Sun and the Earth above it and a "no relief" warning | Web | M |
| C2-03 | Hour-by-hour visibility combining ephemerides and horizon | Ephemerides | M |
| C2-04 | First integration: the web reads real data | Web | S |

### Layer 3: timeline and countdown (mandatory)

| ID | Task | Area | Size |
|---|---|---|---|
| C3-01 | Generate metrics.json with hours of light and contact | Ephemerides | M |
| C3-02 | Time player | Web | M |
| C3-03 | Timeline of the Sun and the Earth for the coming days | Web | M |
| C3-04 | Countdown: the Sun sets in N hours | Web | S |
| C3-05 | Plain-language texts and web design | Product | M |
| C3-06 | Validation panel: the web's numbers against JPL Horizons | Web | M |

### Layer 4: scenario comparison (mandatory since ADR-009)

| ID | Task | Area | Size |
|---|---|---|---|
| C4-01 | Comparison of 2 or 3 scenarios side by side | Web | L |

### Layer 5: extras and, at the end, real relief (only if time allows)

Order: first the extras and **last of all the relief** (ADR-011).

| ID | Task | Area | Size |
|---|---|---|---|
| C5-01 | "The launch was delayed" button | Web | M |
| C5-03 | Best landing window finder | Ephemerides | L |
| C5-04 | Decide custom coordinates: precalculated grid or server | Terrain | M |
| C5-05 | Get the south pole elevation map (Moon Trek, Quickmap or PDS). Formerly C0-03 | Terrain | M |
| C5-06 | Horizon profile of a site (360 values) and silhouette chart. Formerly C0-06 | Terrain | L |
| C5-07 | Generate horizon.json with relief for the south pole sites | Terrain | M |
| C5-08 | Silhouette drawing with relief and visible or hidden by relief in the web | Web | M |
| C5-02 | Terrain slope per site | Terrain | M |

### Delivery and demo

| ID | Task | Area | Size |
|---|---|---|---|
| E-01 | Repo ready for delivery: final README and cleanup of synthetic data | Product | S |
| E-02 | Demo script and rehearsal | Product | M |
| E-03 | Presentation and backup video | Product | M |
| E-04 | Moon vs. Earth slide: sunlight hours at a lunar site and in a city on Earth | Product | S |

## How the work is split

- **Data and logic in Python** (ephemerides and terrain): critical path. First is the Horizons client with verified conventions (C0-04 and C0-05) and the full download to cache before Saturday (C0-13). The elevation map is no longer on the critical path: it is left for the end of layer 5 (C5-05, ADR-011).
- **Web**: starts with the synthetic data in `data/public/` while the Python precalculation generates the real data; the first integration is on Saturday before 12:30.
- **Product, content and demo**: list of sites, texts, design, script and presentation; everyone's work.
- Workload is balanced, not the number of issues. Whoever finishes takes the next available issue from any area.
