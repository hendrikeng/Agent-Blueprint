# Agent Observability

Status: canonical
Owner: {{DOC_OWNER}}
Last Updated: {{LAST_UPDATED_ISO_DATE}}
Source of Truth: This document.

## Required Run Trace Fields

- Unique run identifier and task identifier.
- Model identifier and version.
- Tool invocation events with input/decision metadata.
- Approval events for gated actions.
- Final outcome classification and termination reason.

## Error Classification

- Classify failures as retryable, non-retryable, or policy-blocked.
- Record boundary and authorization failures distinctly from generic runtime errors.
- Capture the first failing step and the user-visible impact.

## Retention and Redaction

- Keep traces long enough to support incident review and regression analysis.
- Redact secrets and sensitive payloads from persistent logs.
- Preserve auditability for policy decisions without storing unnecessary sensitive content.
