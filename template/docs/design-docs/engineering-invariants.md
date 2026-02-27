# Engineering Invariants

Status: canonical
Owner: {{DOC_OWNER}}
Last Updated: {{LAST_UPDATED_ISO_DATE}}
Source of Truth: This document.

## Core Invariants

- Server-side authority for sensitive state.
- Authorization/isolation boundary enforcement.
- Deterministic numeric and timestamp handling for critical domains.
- Shared contracts define inter-module boundaries.

## Documentation Discipline

- Canonical docs must reflect real behavior.
- Behavior changes must update docs in the same change.
- Avoid parallel policy sources.
