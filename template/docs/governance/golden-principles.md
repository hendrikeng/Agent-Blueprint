# Golden Principles

Status: canonical
Owner: {{DOC_OWNER}}
Last Updated: {{LAST_UPDATED_ISO_DATE}}
Source of Truth: This document.

## Principles

- Correctness over speed.
- Explicit invariants over implied behavior.
- Shared contracts and primitives over divergence.
- Security and boundary isolation by default.
- Mechanical checks over manual interpretation.

## Mechanical Enforcement Map

- Docs governance: `npm run docs:verify`
- Scope/conformance guardrail: `npm run conformance:verify`
- Architecture constraints: `npm run architecture:verify`
- Agent hardening constraints: `npm run agent:verify`
- Plan metadata constraints: `npm run plans:verify`
