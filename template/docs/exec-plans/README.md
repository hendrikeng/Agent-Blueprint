# Execution Plans

Status: canonical
Owner: {{DOC_OWNER}}
Last Updated: {{LAST_UPDATED_ISO_DATE}}
Source of Truth: This document.

## Directory Layout

- `docs/exec-plans/active/`
- `docs/exec-plans/completed/`
- `docs/exec-plans/tech-debt-tracker.md`

## Plan Metadata Header

Every plan in `active/` and `completed/` must include `## Metadata` with:

- `Plan-ID`
- `Status`
- `Priority`
- `Owner`
- `Acceptance-Criteria`
- `Dependencies`
- `Spec-Targets`
- `Done-Evidence`

Optional fields:

- `Autonomy-Allowed` (`guarded` | `full` | `both`)
- `Risk-Tier` (`low` | `medium` | `high`)

## Status Conventions

- Active plan statuses: `queued`, `in-progress`, `blocked`, `validation`, `completed`, `failed`.
- Completed plan status: `completed`.

## Workflow

1. Track non-trivial work in `active/`.
2. Validate plan metadata with `npm run plans:verify`.
3. Execute one plan at a time with isolated context/session.
4. Move completed plans to `completed/` with closure notes and validation evidence.
5. Keep tech debt references current.
