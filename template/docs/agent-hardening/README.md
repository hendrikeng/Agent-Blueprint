# Agent Hardening

Status: canonical
Owner: {{DOC_OWNER}}
Last Updated: {{LAST_UPDATED_ISO_DATE}}
Source of Truth: This document and linked docs in this folder.

## Why This Exists

- Agent quality and safety requirements must be explicit and shared.
- Hardening policy is canonical from repository bootstrap.
- This folder defines stack-agnostic contracts for evals, observability, tool use, and memory/context behavior.

## Canonical Documents

- `docs/agent-hardening/EVALS.md`
- `docs/agent-hardening/evals.config.json`
- `docs/agent-hardening/continuity-fixtures.json`
- `docs/agent-hardening/resilience-fixtures.json`
- `docs/agent-hardening/OBSERVABILITY.md`
- `docs/agent-hardening/TOOL_POLICY.md`
- `docs/agent-hardening/MEMORY_CONTEXT.md`
- `docs/generated/evals-report.json`
- `docs/generated/continuity-evals-report.json`
- `docs/generated/resilience-evals-report.json`

## Enforcement

- Targeted policy checks: `npm run agent:verify` and `npm run eval:verify`
- Continuity fixture runner: `npm run eval:continuity`
- Resilience matrix runner: `npm run eval:resilience`
- Iteration profile: `npm run verify:fast`
- Merge profile: `npm run verify:full`

`agent:verify` and `eval:verify` are required and must pass before merge.
`eval:verify` gates generated eval freshness and required suite health. Continuity evals measure whether the latest checkpoint and handoff are enough to resume accurately, and resilience evals measure whether the harness fails closed and records usable recovery state when execution goes wrong.
