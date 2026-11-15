# 08. Submission form draft (Space Apps project page)

> 🇪🇸 Borrador de los campos del formulario de entrega en spaceappschallenge.org. **Está en inglés a propósito**: Space Apps pide inglés en el formulario y en todo lo enlazado, así que se copia y pega tal cual. No tiene versión en `docs/en/`. Requisitos y checklist en `docs/00-CONTEXT.md` ("Entrega oficial y rúbrica") y `docs/06-PITCH-DEMO.md`. Antes de pegar, revisar que cada dato siga siendo cierto en la versión final (sitios, capas que llegaron, links).

Fill in the `[brackets]` before pasting. Source: [Project Submission Guide](https://www.spaceappschallenge.org/resources/project-submission-guide/).

## Project Name
Lunar Landing Site Navigator

## High-Level Project Summary
Lunar Landing Site Navigator answers one question in a single screen: if I land at this place on the Moon on this date, will I have Sun (power) and will I see Earth (direct communication)? Pick a landing site and a date, and the app shows the Sun and Earth over the local horizon, the Sun's elevation, how many hours of sunlight and Earth visibility the next days bring, and a countdown to the next sunset or Earthset. Two or three site-date scenarios can be compared side by side, and the app marks which has more Sun hours and which has more Earth hours, leaving the choice to the user. Every number comes from NASA/JPL Horizons and is checked against saved Horizons answers. The data already exists in NASA tools, but they are built for specialists; we made it quick to compare for mission planners, educators and the public.

## Link to Project Demo
[Public link to the 7-slide deck or the 30-second video, tested in a private window]

## Link to Final Project
- Web app: https://vizcachasfueradeorbita.vercel.app/?lang=en
- Code: https://github.com/VainstubTomas/NASA-APP-CHALLENGE

## Detailed Project Description
**What it does**
- Site and date selection: [14] landing sites (Apollo missions, CLPS and other commercial landers, and other countries' programs), any hour from today to the end of December 2027, in UTC.
- Sun and Earth position: azimuth and elevation of both bodies, drawn over the horizon in a 3D sky view (with a 2D compass and elevation ruler as fallback). The Sun's elevation is the most visible number on the screen, because it drives solar power.
- Time: a time player, a 7-day timeline of when the Sun and Earth are above the horizon, and a live countdown to the next sunset/sunrise and Earthset/Earthrise.
- Scenario comparison: 2 or 3 site-date scenarios side by side with hours of Sun and of Earth in view over 7 days. The tool does not pick a winner: for each metric it marks which scenario has more Sun hours and which has more Earth hours, and the user decides according to their mission requirements (ADR-017).
- Validation panel: our values next to JPL Horizons reference values, with the difference.
- [Only if the live API is deployed (ADR-015): custom coordinates. Any latitude and longitude on the Moon are sent to our own API, which queries JPL Horizons live.]
- Plain-language texts, mobile layout, and four languages (English, Spanish, Hindi, Simplified Chinese).

**How it works**
1. Ephemeris (Python, offline): we query the JPL Horizons API for topocentric azimuth and elevation of the Sun and Earth from each lunar site, one sample per hour, and store them as JSON.
2. Horizon (Python, offline): a 360-value horizon profile per site. For now it is flat (0°, a smooth Moon) and the app shows an "ideal horizon, no terrain" notice. Real terrain from LOLA elevation data is the next step.
3. Web app (JavaScript, Vite, three.js): reads the precomputed JSON and compares each body against the horizon. A body counts as visible when the upper edge of its disk is above the horizon. Without an atmosphere there is no refraction, so the horizon is only the terrain and the curvature of the Moon.

**Benefits**
When a launch slips, planners need to know fast how a new date or a nearby site changes power and communications. Today that means juggling Horizons tables, Quickmap and Moon Trek. Our tool answers it in seconds, with numbers traceable to NASA data, and explains it simply enough for a classroom.

**What we hope to achieve**
[Next steps: real LOLA terrain for south-pole sites, custom coordinates, a "best landing windows" finder.]

**Tools**
Python (NumPy, Requests, pytest, jsonschema, FastAPI), JavaScript with Vite and three.js, GitHub Actions, Vercel and GitHub Pages.

## Use of Super Intelligence (SI)
Yes. We used Claude (Anthropic) as a coding assistant to write and review code, tests and documentation; every change went through a pull request reviewed by a team member, and commits where it took part carry a `Co-Authored-By: Claude` line. The English, Hindi and Simplified Chinese interface texts were translated with AI and were not reviewed by native speakers; the app says so in its footer. The idea and the design of the solution are the team's. The numbers are not AI-generated: they come from JPL Horizons and are checked by automated tests. Only the team logo was generated with AI (ChatGPT, OpenAI); the other images come from the USGS Moon mosaic and public Figma files (Space Elements community file and others), and no video or audio was generated with AI. Details in the README, section "Use of AI".

## NASA Data
- **JPL Horizons System** (NASA/JPL), https://ssd.jpl.nasa.gov/horizons/ : the source of every Sun and Earth position in the app (topocentric azimuth and elevation from each lunar site, hourly). It already includes libration and the Moon's orbital variations.
- **Quickmap** (Arizona State University, Lunar Reconnaissance Orbiter data), https://quickmap.lroc.asu.edu/ : checking site coordinates and terrain.
- **Moon Trek** (NASA), https://trek.nasa.gov/moon/ : exploring the sites and their topography.

## Space Agency Partner Data and Other References
- CSA (Canadian Space Agency), Moon Exploration portal, https://www.asc-csa.gc.ca/eng/astronomy/moon-exploration/ : context for the pitch.
- Landing site coordinates: each site in `data/public/sites.json` lists its own source.
- Open source software: three.js (MIT), Vite (MIT), NumPy (BSD-3-Clause), Requests (Apache-2.0), rasterio (BSD-3-Clause), pyproj (MIT), Matplotlib (Matplotlib license), pytest (MIT), jsonschema (MIT), FastAPI (MIT), Uvicorn (BSD-3-Clause), HTTPX (BSD-3-Clause).
- Images: the 2D Moon maps come from the USGS "Image mosaic and topographic map of the Moon" (Scientific Investigations Map 3316, 2015), https://pubs.usgs.gov/sim/3316/downloads/sim3316_sheet1_lo_res.pdf ; the Sun and Earth images come from the Figma Community file "Space Elements", https://www.figma.com/design/cd2hSZ5cz9CFRURSDR5w1x/Space-Elements--Community---Community-?m=auto&t=QqI0kQe9hwV0xPfn-1 ; the ground texture and interface icons come from public Figma files and projects. The team logo was generated with ChatGPT (OpenAI).
- [Add any other external code, text or image used in the slides or the video.]
