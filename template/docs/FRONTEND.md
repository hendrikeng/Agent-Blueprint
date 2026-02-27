# Frontend

Status: canonical
Owner: {{DOC_OWNER}}
Last Updated: {{LAST_UPDATED_ISO_DATE}}
Source of Truth: This document.

## Frontend Stack

- {{FRONTEND_STACK}}
- Shared UI primitives/components are canonical
- Shared contracts/types are consumed from workspace packages

## UI Rules

- Do not fork shared primitives unless approved by design/system policy.
- Keep critical state transitions explicit in UI behavior.
- Match server-side authority assumptions in UX.

## Data-Wiring Rules

- Use typed contract boundaries between UI and API.
- Avoid client-side authority for sensitive state.
- Handle loading/error/retry paths explicitly.

## Current Workspace Entry Points

- {{FRONTEND_ENTRYPOINT_1}}
- {{FRONTEND_ENTRYPOINT_2}}
