> 🇪🇸 [Leer en español](../../adr/ADR-014-criterio-comparacion-escenarios.md)

# ADR-014: "Which one is better" criterion in the scenario comparison

- **Status**: Proposed
- **Date**: 2026-11-14
- **Decided by**: pending team confirmation (see #95)

## Context
Layer 4 compares 2 or 3 scenarios side by side and must say which one is better (#94, C4-01d). Without a written rule, the summary can contradict the numbers or change depending on who reads it. The rule must come from data already computed (`summarizeScenario` in `web/src/compare-core.js`, #91) and be the same in the web app, the demo and the script (#96).

## Decision
Over the 7-day window from the chosen UTC day (the same window as the timeline, C3-03):
1. The better scenario has **more hours of visible Sun**.
2. On a Sun tie, the better one has **more hours of visible Earth**.
3. If Earth also ties, the summary says there is **no difference** and does not pick one.

Hours come from `visibilitySeries` (contract rule: upper edge above the horizon), at the data's one-hour resolution.

## Discarded alternatives
- **Weighted score (Sun and Earth with weights):** the weights would be arbitrary and cannot be defended to the jury.
- **Earth first:** communication matters, but without Sun there is no power for the solar panels, so the site does not work even with contact.
- **Night length (time until next sunset):** that is the countdown metric (C3-04), not the comparison metric, and it does not say how much useful time there is in the window.

## Consequences
- `pickBest` in `compare-core.js` implements this rule. If the team changes it, this ADR and the code must be updated in the same PR.
- The C4-01d summary uses the same wording: "more hours of Sun" and "tie".
- The criterion does not measure site quality (slope, latitude, terrain). That belongs in the presentation, not in the rule.
- Cost: the rule only compares light and contact hours. A scenario with a very low Sun counts the same as one with a high Sun.
