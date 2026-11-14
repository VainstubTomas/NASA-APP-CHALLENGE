# ADR-012: Target award: Best Use of Data and, as a second choice, Best Use of Science

- **Status**: Proposed
- **Date**: 2026-11-14
- **Decided by**: pending confirmation by the team

## Context
The challenge page does not include evaluation criteria, but Space Apps publishes 10 global awards at https://www.spaceappschallenge.org/awards/ (copied on 14/11; the full table is in `docs/en/00-CONTEXT.md`, section "Awards"). If the pitch speaks to all the awards, it wins none. We have to choose which one to aim for with what we are already going to build, without adding features.

## Decision
1. **Main award: Best Use of Data** ("the project that best makes space data accessible or uses it in a single application"). It is our value proposition word for word: JPL Horizons and LRO data exist, but their tools are complex, and we answer them on one screen and with one question.
2. **Secondary award: Best Use of Science** ("the most valid use of science or the scientific method"). It is supported by the validation against Horizons (C0-05, C3-06) and by our declared limits (ideal horizon while there is no relief, ADR-011).
3. **Pitch angles, with no extra work**: Best Use of Storytelling (the story "the mission got delayed") and Best Mission Concept (planning Artemis landings).

## Discarded alternatives
- **Best Use of Technology**: rewards the most innovative technology; ours is a simple web app on precalculated JSON files, on purpose.
- **Galactic Impact, Most Inspirational, Global Connection, Art & Technology, Local Impact**: the project fits them poorly, and aiming there would require features or a message we do not have.
- **Not choosing an award**: the pitch ends up generic.

## Consequences
- **Scope and contract do not change**: layers 1 to 4 stay the same, cut rather than stretch.
- The pitch opens with "NASA data that is hard to use, now accessible" and names the source of each number (Horizons, LRO/LOLA, Quickmap, Moon Trek).
- Validation against Horizons goes from detail to central argument of the demo (C3-06 gains priority within layer 3).
- The "ideal horizon, no relief" warning (ADR-011) is a condition for Best Use of Science: an optimistic result without a warning contradicts "valid use of science".
- The rubric the jury uses (local and global) is still unconfirmed: ask the organizers (C0-11).
