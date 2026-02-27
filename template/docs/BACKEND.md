# Backend

Status: canonical
Owner: {{DOC_OWNER}}
Last Updated: {{LAST_UPDATED_ISO_DATE}}
Source of Truth: This document.

## Backend Stack

- {{BACKEND_STACK}}
- Shared contracts/types are consumed from workspace packages.
- Server-side authority is enforced for sensitive operations.

## API and Boundary Rules

- Keep API handlers/controllers thin and domain services explicit.
- Enforce authorization and scope boundaries server-side.
- Validate inbound payloads at boundaries.

## Data and Persistence Rules

- Use explicit schemas/contracts at persistence boundaries.
- Keep transaction boundaries explicit for multi-step critical writes.
- Preserve auditability for critical state mutations.

## Runtime and Reliability Rules

- Handle retries/idempotency explicitly where external callbacks/integrations exist.
- Keep error surfaces structured and observable.
- Use deterministic behavior for critical lifecycle transitions.

## Current Workspace Entry Points

- {{BACKEND_ENTRYPOINT_1}}
- {{BACKEND_ENTRYPOINT_2}}
