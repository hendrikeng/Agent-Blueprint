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
- `docs/agent-hardening/OBSERVABILITY.md`
- `docs/agent-hardening/TOOL_POLICY.md`
- `docs/agent-hardening/MEMORY_CONTEXT.md`

## Enforcement

- `npm run agent:verify`
- `npm run docs:verify`
- `npm run conformance:verify`

`agent:verify` is required and must pass before merge.
