> 🇪🇸 [Leer en español](../../adr/README.md)

# ADRs (Architecture Decision Records)

One important decision per file, one page at most. They take 2 minutes to write and avoid arguing about the same thing at 4 am.

Template: copy `ADR-000-template.md`, number the next one (`ADR-011-...`) and fill it in. If a decision changes, the ADR is not deleted: it is marked "Replaced by ADR-N" and a new one is written.

| ADR | Decision | Status |
|---|---|---|
| [001](ADR-001-challenge-and-mvp-scope.md) | Challenge and MVP scope by layers | Accepted (layer 4 priority replaced by 009) |
| [002](ADR-002-data-contract.md) | Data contract from Python to the web | Accepted |
| [003](ADR-003-minigitflow.md) | MiniGitFlow | Accepted (partly replaced by 007) |
| [004](ADR-004-stack.md) | Technology stack | Proposed (ephemerides replaced by 006) |
| [005](ADR-005-horizons-validation.md) | Validation against JPL Horizons | Partly replaced by 006 |
| [006](ADR-006-official-resources.md) | Official resources: Horizons as source and elevation map to be confirmed | Accepted |
| [007](ADR-007-commits-and-hooks.md) | Commit format, Git hooks and unprotected `dev` | Accepted |
| [008](ADR-008-epics.md) | One `[EPICA]` epic per layer, with its issues as sub-issues | Proposed |
| [009](ADR-009-layer-4-mandatory.md) | Scenario comparison (layer 4) becomes mandatory | Proposed |
| [010](ADR-010-issue-closing-automation.md) | Post-merge Action that closes issues and tracks across the "Hackaton" and "Main migrate" projects | Proposed |
| [011](ADR-011-flat-moon-date-and-relief-last.md) | Flat Moon first, date from the start and relief at the end (layer 5) | Proposed |
| [012](ADR-012-target-award.md) | Target award: Best Use of Data and, as a second choice, Best Use of Science | Proposed |
| [014](ADR-014-scenario-comparison-criterion.md) | "Which one is better" rule in the scenario comparison (Sun, then Earth) | Proposed |
| [015](ADR-015-live-horizons-api.md) | Own API in `data/api/` to query Horizons live for a user-chosen site | Proposed |
| [016](ADR-016-3d-sky-view.md) | 3D sky view with the flat horizon (terrain rendering stays out of scope) | Proposed |

Statuses: Proposed, Accepted, Replaced.
