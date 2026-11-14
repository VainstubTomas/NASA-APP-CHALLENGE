# ADR-009: Scenario comparison (layer 4) becomes mandatory

- **Status**: Proposed
- **Date**: 2026-11-13
- **Decided by**: pending confirmation by the team

## Context
ADR-001 set layers 1 to 3 as the goal, with layer 4 (comparing 2 or 3 scenarios side by side) as a "probable stretch goal". The official challenge text, published on 13/11, puts comparison at the center: "its interface could prioritize quick comparison of scenarios" (`docs/en/07-DESAFIO-OFICIAL.md`). The review of `docs/en/00-CONTEXT.md` left raising its priority pending.

## Decision
- Layer 4 moves from **desirable** to **mandatory**. The MVP goal is layers 1 to 4.
- The order does not change: layer 4 is built on top of layer 3, because it compares scenarios with the same numbers and charts.
- The rule "cut, do not stretch" still applies: in case of delay, the last working layer is shown.

## Discarded alternatives
- Leaving it as desirable: the jury evaluates against the official text, and comparison is what it asks for most.
- Doing it before layer 3: without a timeline or metrics there is not much to compare.

## Consequences
- The Saturday night session aims to close layers 3 and 4.
- Comparison enters the demo script as a fixed step and leaves "What comes next" in the pitch.
- Layer 5 remains only if time allows.
