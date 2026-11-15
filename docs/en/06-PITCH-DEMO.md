> 🇪🇸 [Leer en español](../06-PITCH-DEMO.md)

# 06. Pitch, demo and delivery

Last update: 2026-11-14 · Status: draft. The final script is closed on Saturday night.

## Target award (ADR-012)
We aim for **Best Use of Data** ("the project that best makes space data accessible") and, as a second choice, **Best Use of Science** ("the most valid use of science"). Storytelling and Mission Concept are angles, not goals. The 10 awards are in `00-CONTEXT.md`, section "Awards". Pitch rule: every number shown says which NASA data it comes from.

## Core message
> NASA's data to know whether a lunar site has Sun and line of sight with the Earth already exists, but it is in complex tools. We made it accessible: one screen, one question, and numbers verified against JPL Horizons.

## Presentation structure (3 to 5 minutes, adjust to the time given)
> This is the **in-person defense** before the local jury. The demo uploaded to Space Apps is a different thing with strict limits: up to 7 slides or a 30 s video, in English (see "Official submission and rubric" in `00-CONTEXT.md`).

In brackets, the award each block speaks to.
1. **The problem** (30 s) [Mission Concept]: lunar south pole, Sun and Earth stuck to the horizon, any mountain hides them; Artemis requires illumination and direct communication. Campsite analogy: sun for the solar panel and signal for the phone.
2. **Why it is hard today** (30 s) [Data]: the data exists in Quickmap, Moon Trek and Horizons, but it is powerful and confusing. Show 2 or 3 screenshots and what is confusing (full list below, in "Why it is hard today: what we found").
3. **Our solution** (30 s) [Data]: the same NASA data (Horizons, LRO), on one screen and one question.
4. **Live demo** (90 s) [Storytelling]: see script.
5. **How we know it is right** (30 s) [Science]: the data comes from JPL Horizons, NASA's official tool, and we verified against its interface that we show it correctly at three sites and three dates. Also state the limit: ideal horizon while there is no relief (ADR-011).
6. **What comes next** (15 s): real terrain relief with LOLA (if it did not arrive), custom coordinates, more missions, best landing windows.

International context (optional, issue C0-12): the CSA Lunar Exploration portal, an official challenge resource, describes Canada's contribution to Artemis. Sourced data:
- Canada provides **Canadarm3**, a robotic system for the Gateway lunar station, which can help maintain, repair and inspect the station. Source: [Canada's role in Moon exploration, CSA](https://www.asc-csa.gc.ca/eng/astronomy/moon-exploration/canada-role.asp) (last page modification: 2025-06-05).
- Canadian astronaut **Jeremy Hansen** is part of the Artemis II crew, the first crewed mission to the Moon since 1972. Source: [Canada's role in Moon exploration, CSA](https://www.asc-csa.gc.ca/eng/astronomy/moon-exploration/canada-role.asp) (last page modification: 2025-06-05).

## Why it is hard today: what we found (C0-10)
Test done on 14/11/2026 by someone on the team using the tools for the first time, with a single question: **"does the lunar south pole (Shackleton crater) have Sun in November?"**. In Quickmap and Moon Trek we searched for Shackleton; in Horizons we used a point near the pole (lat -89.5, lon 0°), not the exact crater, which according to Quickmap is at lat -89.67, lon 129.78. Screenshots in [`../img/c0-10/`](../img/c0-10/).

**For the pitch (top 3):**
1. In Horizons, searching "moon" as observer location returns Earth observatories with "Moon" in the name, not the Moon (screenshot 02).
2. With default options, Horizons' answer to "is there Sun?" is an asterisk `*` next to the date, explained about 70 lines further down; and an `i` appears ("interfering body"; you have to look at the header to know it is the Earth: `Vis. interferer: EARTH`) (screenshot 07). Horizons does give azimuth and elevation if that option is checked: the confusing part is knowing which one to check.
3. In Moon Trek, when searching for Shackleton, the south pole looks like stretched, unrecognizable stripes (screenshot 12).

### JPL Horizons
| # | Screenshot | What we tried | What confuses |
|---|---|---|---|
| 1 | [01](../img/c0-10/01-horizons-inicio.png) | Open the tool | Starts set up for Mars seen from Earth's center (`Geocentric [code: 500]`). Five steps with jargon: *Ephemeris Type*, *Observer Table*, *Time Specification* |
| 2 | [02](../img/c0-10/02-horizons-buscar-luna.png) | Set ourselves on the Moon | Searching "moon" lists 6 Earth observatories ("Desert Moon Observatory", etc.). To pick the Moon you have to know codes like `@301` |
| 3 | [03](../img/c0-10/03-horizons-table-settings.png) | Ask which data to show | 49 technical options ("Astrometric RA & DEC", "Delta-T (TDB - UT)") and about 20 more settings. The one that matters, "Apparent AZ & EL" (height of the Sun above the horizon), is not checked by default |
| 4 | [04](../img/c0-10/04-horizons-target-body.png) | Choose the Sun | Empty search box, no suggestions: you have to know the body's name or code in advance |
| 5 | [05](../img/c0-10/05-horizons-resultado-inicio.png) | See the result | The first thing shown is the Sun's physical profile (mass, temperature, sunspot cycle), which does not answer the question |
| 6 | [06](../img/c0-10/06-horizons-resultado-encabezado.png) | Find the data | Almost 60 lines of technical header (`DE441`, `EOP file`, `Center cylindric`…) before the first data point |
| 7 | [07](../img/c0-10/07-horizons-resultado-tabla.png) ([full text](../img/c0-10/07-horizons-resultado-completo.txt)) | Know whether there is Sun | Table of 15 columns with mixed units (hours, degrees, AU). The answer is a `*` whose meaning is at the end of the document; an `i` ("interfering body") also appears; only the header reveals it is the Earth (`Vis. interferer: EARTH`) |

### Quickmap (ASU / LROC)
| # | Screenshot | What we tried | What confuses |
|---|---|---|---|
| 8 | [08](../img/c0-10/08-quickmap-inicio.png) | Open the tool | Unlabeled icons in the sidebar; the search box asks for `lat,lon(,height)` |
| 9 | [09](../img/c0-10/09-quickmap-shackleton.png) | See whether Shackleton gets light | Finds the crater and shows who Shackleton was, the diameter and a code, but nothing about light. The height (`-2788.33`) has no unit, and the view is not centered on the crater |
| 10 | [10](../img/c0-10/10-quickmap-reloj.png) | Change the date | There is a timeline, but when the date changes the Moon looks the same, fully lit. We did not find how to see whether a place has Sun on a given date |

### Moon Trek (NASA)
| # | Screenshot | What we tried | What confuses |
|---|---|---|---|
| 11 | [11](../img/c0-10/11-moontrek-inicio.png) | Open the tool | Flat map with no instructions; the search box is hidden at the bottom right |
| 12 | [12](../img/c0-10/12-moontrek-shackleton.png) | Go to Shackleton | Finds the crater, but the south pole looks like stretched stripes: relief is not distinguishable, let alone where there is light or shadow |

**Conclusion for the pitch**: the data exists (Horizons knows exactly where the Sun is), but none of the three tools answers the question directly. We answer with one screen: the place's horizon, the Sun and the Earth above it, and "Sun / contact" in plain language.

## Demo script (story)
"A mission was going to land on day X at this site. It got delayed. What changes?"
1. Choose a site from the list and the original date: the horizon, the Sun and the Earth, and the numbers are shown. While there is no relief (layer 5), say the horizon is ideal and the mountain is the next step; do not claim the tool shows mountains hiding the Sun (ADR-011).
2. Advance the time player: the Sun approaches the horizon (a mountain, once there is relief). The countdown appears: "the Sun sets in N hours".
3. Change the date (delay): look at the timeline of light and of contact with the Earth.
4. Compare the two scenarios side by side (layer 4): show which has more Sun hours and which has more Earth hours. The tool does not pick a "better" one: say it depends on what the mission needs (more power or more communication) and that the user decides (ADR-017).
5. Show the validation panel against Horizons (C3-06): for known cases, our numbers next to Horizons', with the difference.

Choose a site and dates where the difference is visible and dramatic; test them on Saturday.

## Demo plan B
- The web is deployed, but also have a local copy running and a short video recorded in case the internet or the projector fails.
- If a layer did not arrive, demonstrate the previous one without apology and present the rest as future work.

## Rehearsal
- Run the full demo at least twice before the defense (Sun 15, between 14:30 and 16:30).
- Test with someone from outside (a mentor or a teammate from another team) and note where they get confused.

## Submission checklist (official guides: see "Official submission and rubric" in `00-CONTEXT.md`)
**Repo and web app**
- [x] English README as the front page, with use of AI, credits and license (#110)
- [x] The web app opens in English with `?lang=en` and uses English when the browser language is not supported (#110)
- [ ] `main` contains the final version and runs by following the README
- [ ] Synthetic development data removed (`synthetic: true` out of `sites.json`, E-01 #48)
- [ ] Web app deployed from the final version, with a link in the README

**Demo** (E-03, #50)
- [ ] Up to 7 slides counting title and intro, in English, with team name, members and challenge; or a video of up to 30 s (with English subtitles if another language is spoken)
- [ ] Public link with no login, tested in a private window

**Form on spaceappschallenge.org** (draft in `../08-SUBMISSION.md`)
- [ ] Every field filled in, in English
- [ ] Final project link: the web app with `?lang=en` and the repo
- [ ] All members appear in the Members tab
- [ ] Both checkboxes ticked and "Submit for Judging" before Sunday 15 at 23:59 (we aim for 14:30)

**In-person defense**
- [ ] Presentation ready and rehearsed
- [ ] Short backup video in case the internet or the projector fails
