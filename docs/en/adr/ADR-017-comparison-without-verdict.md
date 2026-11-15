> 🇪🇸 [Leer en español](../../adr/ADR-017-comparacion-sin-veredicto.md)

# ADR-017: The scenario comparison does not pick a "best": it marks more Sun and more Earth

- **Status**: Proposed
- **Date**: 2026-11-15
- **Decided by**: the team, on Sunday 15 (who confirms is still to be recorded). Work in #94.
- **Replaces**: [ADR-014](ADR-014-scenario-comparison-criterion.md) in the web comparison (#94, #95)

## Context
ADR-014 defined a "which one is better" rule: more Sun hours; if tied, more Earth hours. Reviewing it with the comparison on screen showed that:
- **No official source defines that rule.** The challenge text (`docs/en/07-DESAFIO-OFICIAL.md`) has no evaluation criteria and no weights between Sun and Earth: it asks to assess "the potential for power generation and the windows of direct communication with Earth", both at once. The Artemis landing constraint (NASA NTRS 20250009323) also lists them as separate requirements. Putting the Sun first was our own decision.
- **The rule declared a winner on tiny differences** (one hour in 168), and Earth only broke ties, although for a mission both can matter equally depending on the case.
- **The decision depends on the mission**, not on the tool: a rover with solar panels needs power; a mission with live operations needs contact.

## Decision
The web **does not say which scenario is better**. For each metric, separately, it compares the scenarios with each other and marks which one has more hours (the larger number is shown in bold):
1. **Hours of Sun in view** (power).
2. **Hours of Earth in view** (direct communication).

Rules (implemented in `compareMetrics`, `web/src/compare-summary-core.js`):
- A scenario "has more" in a metric if it beats each of the others. With 3 scenarios it is compared against the next one. If two are tied at the top, both are marked.
- If all have the same hours, it says "the same" and marks nobody.
- It is a mathematical rule: no threshold and no combined score. A small difference is also marked, and the numbers are on screen so the reader can judge whether it matters.
- A scenario can win one metric and lose the other. They are not added or weighted.
- The person (mission planner, astronaut, student) decides which one fits their requirements. The web says so in the summary and in the README.
- Repeated scenarios (same site and hour) are still grouped (#107); if all are the same case it says "same date and place" and does not compare.
- The hours are those of `visibilitySeries` (contract rule, upper limb above the horizon), at the one-hour resolution of the data, over the 7 days from the chosen UTC day.

## Discarded alternatives
- **Keep ADR-014:** putting the Sun first comes from no source and presents a preference as a conclusion.
- **Weighted score of Sun and Earth:** the weights would be arbitrary and cannot be defended in front of the judges.
- **An "almost equal" threshold:** adds an invented number. We prefer showing the hours and letting the person judge.
- **Adding the Sun's maximum elevation to the comparison:** the challenge asks to highlight solar elevation, but today it only appears in the main panel. It stays as an improvement (layer 5), outside this decision.

## Consequences
- The web drops "Better", the green badge and the winning column. New texts under `compare.summary.*` in the 4 languages.
- `pickBest` and `explainBest` are gone; `compareMetrics` replaces them.
- The **landing window finder** (C5-03, `precompute/ephemeris/windows.py`) still sorts with the ADR-014 rule. It is an ordering of windows, not a verdict on a web scenario. If the team wants to change it too, that is a separate issue.
- The demo script and the presentation (#113) stop saying "which one is better": they say which has more Sun and which more Earth, and that the decision depends on the mission.
- The README states that the tool does not recommend a site.
- The horizon is still ideal, without relief, until layer 5 (ADR-011): the compared hours do not include terrain shadow.
