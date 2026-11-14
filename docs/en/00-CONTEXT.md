> 🇪🇸 [Leer en español](../00-CONTEXT.md)

# 00. Event and challenge context

Last update: 2026-11-14

## The event
NASA Space Apps Challenge 2026, a global two-day hackathon (Saturday 14 and Sunday 15 November). Our site is in person.

**Deliverables**: the project uploaded to GitHub and a presentation (defense before the jury). Confirm with the organizers whether they ask for anything else (video, written summary).

### On-site schedule
| Time | What happens |
|---|---|
| Fri 13 | Challenge resources are released (time not confirmed) |
| Sat 14, 08:30 | Check-in, breakfast, opening 09:15, get to work 09:30 |
| Sat 11:30 | In-person talk |
| Sat 12:30 to 13:30 | Lunch and break |
| Sat 14:30 to 16:30 | Table mentoring (mentors and invited jurors) |
| Sat 16:30 / 17:00 | Snack; work resumes |
| Sat 18:30 | Tour of the facilities |
| Sat 19:00 | End of the day. **We keep working as a team at a house until the early hours of Sunday** |
| Sun 15, 09:00 | Second day. Observations 10:30, group mentoring 11:30 |
| Sun 12:30 | Talk about GitHub. Lunch 13:00 to 14:00 |
| Sun 14:30 | Final adjustments and upload of the project to GitHub |
| Sun 16:30 | Defense before the jury |
| Sun 18:00 | Closing. The jury evaluates in private; the decision arrives in about 7 days |

Effective work time: about 15 hours (estimate: ~10 on site and ~5 in the Saturday night session).

## The chosen challenge
**Lunar Landing Site Navigator**: a tool that, given a site on the Moon and a date, shows where the Sun and the Earth are relative to the terrain, and therefore how much solar energy and how much direct communication with the Earth there will be.

> Full official text (translated) in [`07-DESAFIO-OFICIAL.md`](07-DESAFIO-OFICIAL.md). Resources released on 13/11 (see "Resources" below and ADR-006). **The challenge page does not publish evaluation criteria**, but Space Apps does publish its 10 global awards (see "Awards" below; we aim for Best Use of Data, ADR-012). The jury's scoring rubric is still to be confirmed with the organizers (C0-11). The page says more resources may be added before the hackathon: check the Resources tab on Saturday morning.

### What the challenge asks, translated
| Request | In practice |
|---|---|
| Site selection | List of known places (Apollo, CLPS missions, south pole, other countries) and custom coordinates |
| Date and time | Date selector and a player to move forward in time |
| Position of the Sun and the Earth | Horizon drawing with the Sun and the Earth above it |
| Energy and communication | Height of the Sun, hours of light, hours with the Earth visible |
| Time until they set | Countdown |
| Comparison | Two or three scenarios side by side |
| Accessible | Understandable by an engineer and by a high-school student |

Not everything has to be done: what matters is that what we build works well and is clearly shown.

### Official text vs. our scope (review of 13/11)
| The official text says | Status in our plan | What to do |
|---|---|---|
| Ephemerides with Horizons or precalculated data | Covered (ADR-006) | Nothing |
| LOLA topography for the horizon; without atmosphere, the horizon is the terrain plus the edge of the lunar sphere | Flat Moon first (0° horizon, layers 1 to 4); LOLA relief goes last, in layer 5 (ADR-011) | Make C5-06 include curvature and no refraction; show "no relief" in the web in the meantime |
| Sun elevation as the key metric, "prominently" | Covered (C1-03) | Make it the most visible number on the screen (C3-05) |
| Time until sunset **and** Earth set | Covered (C3-04) | Nothing |
| Libration and orbital variations | Covered: Horizons already includes them | Mention it in the pitch |
| **Quick comparison of scenarios** ("its interface could prioritize…") | Layer 4, mandatory (ADR-009) | Decided: raised in priority |
| Apollo, CLPS, commercial and other-country sites, plus custom coordinates | List from C0-07 (decision pending in that issue); custom coordinates open (C5-04) | Resolved by ADR-011: with the flat Moon all sites fit, including the Apollo sites (far from the pole). When relief arrives, only the south-pole sites (80°S to 90°S) will have it; the rest keep a flat horizon |
| Animations or a timeline of a lunar day | Covered (C3-02, C3-03) | Nothing |
| Why small changes of place or date change everything | Layer 5 (C5-01) | Can go in the texts and the demo without extra code |
| Useful for planners, educators and the public | Covered (PRD, C3-05) | Nothing |

## Awards
Source: https://www.spaceappschallenge.org/awards/ (copied 2026-11-14). These are the 10 global Space Apps awards. **We aim for Best Use of Data and, as a second choice, Best Use of Science** (ADR-012). This does not change the scope; it changes how we tell it.

| Award | Official definition (translated) | Fit with the project |
|---|---|---|
| **Best Use of Data** | The project that best makes space data accessible or uses it in a unique application | **Main.** This is our value proposition: Horizons and LRO data, today in complex tools, answered on one screen |
| **Best Use of Science** | The project that makes the best and most valid use of science or the scientific method | **Secondary.** Validation against Horizons (C0-05, C3-06) and declared limits ("ideal horizon, no relief", ADR-011) |
| Best Use of Storytelling | The project that most creatively communicates the potential of open data through the art of storytelling | Pitch angle: the story "the mission got delayed" |
| Best Mission Concept | The project with the most plausible concept and design | Pitch angle: planning Artemis landings. We are not a mission concept |
| Galactic Impact | The project with the most potential to improve life on Earth or in the universe | Low: indirect impact |
| Best Use of Technology | The project that exemplifies the most innovative use of technology | Low: simple web app on precalculated JSON files, on purpose |
| Most Inspirational | The project that wins our hearts | Low |
| Global Connection | The project that best connects people around the world through technology | Low |
| Art & Technology | The project that best combines technical and creative skills | Low |
| Local Impact | The project with the greatest potential for local impact | Low |

## Why it matters (for the pitch)
- Future missions aim at the lunar south pole because of its water ice. There, the Sun and the Earth sit right at the horizon, and any relief hides them.
- NASA published landing constraints for Artemis that include maximum slope, direct communication with the Earth, and illumination. Source: [Artemis Human Landing System Overview, NASA NTRS 20250009323](https://ntrs.nasa.gov/api/citations/20250009323/downloads/ArtemisOverview2025IntSPAPPSChallenge.pdf).
- Today this information exists in NASA tools (Quickmap, Moon Trek, Horizons), but they are complex. Our value is making it simple, visual, and comparable.

## Resources
- Event site: https://www.spaceappschallenge.org/
- Challenge page (Resources tab): https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/?tab=resources

### Official challenge resources (released 13/11)
| Resource | What it is | How we use it |
|---|---|---|
| **JPL Horizons** (NASA/JPL), https://ssd.jpl.nasa.gov/horizons/ | Ephemerides: position of the Sun and the Earth seen from any point on the Moon | **Source** of azimuth and elevation (part 1), via its API. See ADR-006 |
| **Quickmap** (Arizona State University, NASA LRO data) | Interactive map with high-resolution images and topography | Explore and verify sites and coordinates; check whether it exports the elevation map or illumination layers |
| **Moon Trek** (NASA) | 3D visualization of the surface and its topography | Same as Quickmap; candidate source of the elevation map (part 2) |
| **CSA Lunar Exploration** (Canadian Space Agency) | Portal about the missions and Canada's contribution to Artemis | Context for the pitch (issue C0-12) |

**Important**: the repo was set up assuming SPICE kernels and the map `LDEM_80S_80MPP_ADJ.TIF` in the Resources tab. **They were not delivered.** The adjustment is in ADR-006.

### Other resources (not official challenge resources)
- LOLA elevation map of the south pole in the PDS archive (`LDEM_80S_80MPP_ADJ.TIF`, ~180 MB): backup plan for the terrain if Moon Trek and Quickmap do not allow export; use it only with the organizers' OK (C0-11).
- Previous team documents: technical guide and work plan from Fer (reference, already integrated into these docs).

## Pending questions for the organizers
1. Can we arrive with the repo, data, and calculations prepared in advance, or must the code be written during the event? Can we use public NASA data that is not on the resources list (for example, the LOLA map from the PDS)?
2. Jury rubric (local and global) and exact deliverables. The awards are already published (see "Awards").
3. If the presentation is live, how long it lasts and whether there is a projector and connection (C0-11).
