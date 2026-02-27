# Planning Workflow

Status: canonical
Owner: {{DOC_OWNER}}
Last Updated: {{LAST_UPDATED_ISO_DATE}}
Source of Truth: This document delegates to `docs/exec-plans/README.md`.

Use plans for non-trivial changes so intent, decisions, and rollout state stay discoverable.

## When a Plan Is Required

- The change spans multiple domains, apps, or deployment steps.
- The change affects architecture boundaries or critical invariants.
- The implementation is split across multiple pull requests.

## Lifecycle

1. Create or update a plan in `docs/exec-plans/active/`.
2. Record decisions and acceptance criteria before implementation.
3. Implement the smallest safe slice and update tests/docs in the same change.
4. Validate plan metadata with `npm run plans:verify`.
5. Validate with `npm run docs:verify`, `npm run conformance:verify`, `npm run architecture:verify`, `npm run agent:verify`, and relevant tests.
6. For autonomous runs, use `node ./scripts/automation/orchestrator.mjs run` and `resume` with one-session-per-plan execution.
7. Move the plan to `docs/exec-plans/completed/` once shipped.

## Structure

- `docs/exec-plans/README.md`
- `docs/exec-plans/active/README.md`
- `docs/exec-plans/completed/README.md`
- `docs/exec-plans/tech-debt-tracker.md`
