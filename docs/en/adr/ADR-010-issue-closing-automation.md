# ADR-010: Issue-closing automation and tracking across projects

- **Status**: Proposed
- **Date**: 2026-11-13
- **Decided by**: pending confirmation by the team

## Context
PRs target `dev`, not `main`. GitHub only closes an issue with `Closes #n` when the PR is merged into the default branch, so with our flow the issues stayed open and the "Hackaton" board did not reflect what was done. We also want to track which issues closed in `dev` still have to reach `main`, without duplicating issues.

## Decision
- A GitHub Action (`.github/workflows/post-merge.yml`) runs when a PR is merged: it finds the linked issues (GraphQL `closingIssuesReferences`) and the number in the branch name (`feature/<n>-...`, `fix/<n>-...`), adds them the label `ready:to:main`, and closes them.
- The GitHub Projects workflows do the rest: on "Hackaton 🪐" (A) the issue moves to `Done`; on "Main migrate 🚀" (B) it enters through *Auto-add to project* and sits in `From dev`.
- The same issue lives in both projects; it is not duplicated.
- Operational detail in `docs/en/04-GIT-WORKFLOW.md`, section "Automations".

## Discarded alternatives
- Relying on `Closes #n`: does not close issues with PRs to `dev`.
- Duplicating the issues in project B: double maintenance and they drift apart.
- Closing the issues by hand: it gets forgotten, especially at night during the hackathon.

## Consequences
- The board updates itself on merge, with no extra steps for whoever opens the PR.
- The branch format `feature/<n>-<slug>` becomes important: it is the fallback if the PR does not have the issue linked.
- Accepted cost: if a branch carries the number of an issue that the PR does not fully resolve, the issue is closed anyway (it is reopened by hand). The rule "one PR per issue" mitigates it.
- The project workflows are only configured from the web and cannot be verified via API.
- The Action must exist in the PR's base branch (`dev`, and in `main` after the next milestone).
