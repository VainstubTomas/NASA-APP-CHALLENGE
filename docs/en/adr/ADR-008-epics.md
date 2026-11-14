# ADR-008: One epic per MVP layer, with its issues as sub-issues

- **Status**: Proposed
- **Date**: 2026-11-13
- **Decided by**: pending confirmation by the team

## Context
The roadmap issues are organized by MVP layer (phase), but on the GitHub board they appear as a flat list: the layer only shows up in a label and in the title prefix. It is hard to see at a glance how much is left to close a layer, which is what matters under the rule "cut, do not stretch".

## Decision
- Each layer (0 to 5) and delivery has an **epic**: a parent issue whose title starts with `[EPICA]` and that carries the labels `tipo:epica` and its layer's label.
- The layer's issues hang from its epic as GitHub **sub-issues**.
- The epic represents the complete demo of that layer. It is not worked on directly (no assignee, branch or PR) and it is closed when its sub-issues are closed or dropped.
- Epics are defined in `scripts/issues.json` (`epics`) and created by `scripts/create_issues.py`.

## Discarded alternatives
- GitHub milestones per layer: tied to dates, and layers do not always match a schedule milestone.
- Only `capa:N` labels: they already exist, but do not show the layer's progress.
- Task lists in the issue body: GitHub replaced them with sub-issues.

## Consequences
- The board shows progress per layer and each issue indicates which epic it belongs to.
- A new issue must hang from its layer's epic (by hand in GitHub or by adding it to `issues.json` and running the script).
- There are 7 more items on the board that nobody should take: hence the `[EPICA]` prefix in the title.
