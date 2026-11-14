# ADR-003: MiniGitFlow as the branching workflow

- **Status**: Accepted (partly replaced by ADR-007: commit format and protection of `dev`)
- **Date**: 2026-11-12
- **Decided by**: full team

## Context
Four people editing the same repo during two intense days, with uneven Git experience. Two of us use GitFlow at work. We want nobody to block or break someone else's work, and `main` to always be ready to show.

## Decision
**MiniGitFlow**: `main` (demoable) and `dev` (integration), both protected; branches `feature/<n>-<slug>` and `fix/<n>-<slug>` from `dev`, one per issue, short-lived; PR to `dev` with 1 approval and squash merge. `dev` goes to `main` only at the schedule's milestones. No `release/*` or `hotfix/*`. Details in `docs/en/04-GIT-WORKFLOW.md`.

## Discarded alternatives
- Full GitFlow: ceremony that adds nothing in two days.
- Everyone working on `main`: they break each other.
- Trunk-based without PRs: no review, silent errors in the numbers.

## Consequences
- Each task is an issue with an acceptance criterion and a maximum size of ~4 hours.
- Main folder per area to minimize conflicts; heavy data and notebooks outside git.
- The first PRs of people starting out are done in pairs.
