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

- Fast iteration profile: `npm run verify:fast`
- Full merge profile: `npm run verify:full`
- Runtime context compiler: `npm run context:compile`
