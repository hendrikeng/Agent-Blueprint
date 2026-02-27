# Security

Status: canonical
Owner: {{DOC_OWNER}}
Last Updated: {{LAST_UPDATED_ISO_DATE}}
Source of Truth: This document.

## Security Model

- Default-deny server-side authorization.
- Isolation boundaries as a mandatory constraint.
- Least-privilege access for privileged operations.

## Identity and Scope

- Use shared auth/session modules as source of truth.
- Enforce scope boundaries server-side for protected entities.
- Keep sensitive actions auditable.

## Data Safety Requirements

- Treat inbound integration payloads as untrusted.
- Validate and sanitize external input.
- Avoid secrets in source-controlled docs/code.

## Security Testing Expectations

- Regression tests for authorization boundaries.
- Validation tests around isolation constraints.
- Security-sensitive workflow tests in CI.
