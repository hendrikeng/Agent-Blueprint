# Reliability

Status: canonical
Owner: {{DOC_OWNER}}
Last Updated: {{LAST_UPDATED_ISO_DATE}}
Source of Truth: This document.

## Reliability Goals

- Deterministic behavior for domain-critical workflows.
- Retry/idempotency safety for external integrations.
- Graceful failure behavior with explicit retries where appropriate.

## Critical Flows

- {{CRITICAL_FLOW_1}}
- {{CRITICAL_FLOW_2}}
- {{CRITICAL_FLOW_3}}

## Reliability Controls

- Transaction boundaries around critical mutations.
- Deduplication/idempotency controls where applicable.
- Monitoring and alerting for failure spikes.

## Validation Baseline

- `npm run verify:fast`
- `npm run verify:full`
- Focused tests for critical reliability-sensitive paths.
