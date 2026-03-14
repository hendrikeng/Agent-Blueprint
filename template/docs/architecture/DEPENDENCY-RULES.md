# Dependency Rules

Status: canonical
Owner: {{DOC_OWNER}}
Last Updated: {{LAST_UPDATED_ISO_DATE}}
Source of Truth: This document and `docs/governance/architecture-rules.json`.

## Rules

- Enforce module boundaries with explicit dependency constraints.
- Keep dependency direction aligned with architecture layers.
- Preserve server-authority boundaries for sensitive domain operations.

## Verification

- Run `npm run architecture:verify`.
- Keep rule config synchronized with actual project tags and imports.
