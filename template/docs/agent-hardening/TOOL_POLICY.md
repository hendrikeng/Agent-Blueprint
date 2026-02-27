# Tool Policy

Status: canonical
Owner: {{DOC_OWNER}}
Last Updated: {{LAST_UPDATED_ISO_DATE}}
Source of Truth: This document.

## Risk Tiers

- `low`: read-only actions with no external side effects.
- `medium`: bounded write actions with reversible or controlled impact.
- `high`: privileged, irreversible, or externally visible side effects.

## Approval Requirements

- `low`: no extra approval required beyond normal task authorization.
- `medium`: explicit approval required for the first execution in a run.
- `high`: explicit approval required for every execution attempt.

## Execution Safety Rules

- Treat tool input as untrusted unless proven otherwise.
- Validate parameters before tool execution.
- Enforce least privilege for tokens, credentials, and scopes.
- Fail closed when risk tier or permission boundary is ambiguous.
