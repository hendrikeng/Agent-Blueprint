# Planning Workflow

Status: canonical
Owner: {{DOC_OWNER}}
Last Updated: {{LAST_UPDATED_ISO_DATE}}
Source of Truth: This document delegates to `docs/exec-plans/README.md`.

Use execution plans for all implemented changes so intent, decisions, and rollout state stay discoverable.

## Work Classes

Use `docs/future/` before execution when any of these are true:

- The change spans multiple domains, apps, or deployment steps.
- The change affects architecture boundaries or critical invariants.
- The implementation is expected to span multiple pull requests.
- The rollout risk is medium/high and benefits from staged promotion.

Use direct `docs/exec-plans/active/` entry for quick/manual fixes when all of these are true:

- The change is isolated and low risk.
- No architecture boundary or critical invariant changes are required.
- The work can complete as one focused slice while preserving full plan metadata/evidence.

Examples:

- `future required`: major feature slice, migration, cross-cutting refactor.
- `direct active allowed`: isolated UI color tweak, contained bug fix, minor copy/label update.

## Lifecycle

1. Strategic/non-trivial path: draft in `docs/future/` and set readiness (`draft` -> `ready-for-promotion`), then promote into `docs/exec-plans/active/` (normally via orchestrator).
2. Quick/manual path: create the plan directly in `docs/exec-plans/active/` with complete metadata.
3. Record decisions and acceptance criteria before implementation.
4. Implement the smallest safe slice and update tests/docs in the same change.
5. Validate plan metadata with `npm run plans:verify`.
6. During implementation, run `npm run verify:fast`.
7. Before merge/completion, run `npm run verify:full` plus relevant domain tests.
8. Complete by moving to `docs/exec-plans/completed/` with concise summary/closure and canonical `Done-Evidence` index references.

Orchestration is the default execution driver. Manual execution is valid only if it preserves status transitions, metadata integrity, and evidence/index curation behavior.

## Structure

- `docs/exec-plans/README.md`
- `docs/exec-plans/active/README.md`
- `docs/exec-plans/completed/README.md`
- `docs/exec-plans/tech-debt-tracker.md`
