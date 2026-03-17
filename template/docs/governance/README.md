# Governance README

Status: canonical
Owner: {{DOC_OWNER}}
Last Updated: {{LAST_UPDATED_ISO_DATE}}
Source of Truth: This document.

## Canonical Governance Docs

- `docs/governance/RULES.md`
- `docs/governance/GOLDEN-PRINCIPLES.md`
- `docs/governance/policy-manifest.json`
- `docs/governance/policy-manifest.schema.json`
- `docs/governance/doc-checks.config.json`
- `docs/governance/architecture-rules.json`

## Verification

- Runtime context build: `npm run context:compile`
- Harness alignment check: `npm run harness:verify`
- Plan metadata check: `npm run plans:verify`
- Fast profile: `npm run verify:fast`
- Full profile: `npm run verify:full`

## Operational References

- Lite onboarding: `docs/ops/automation/LITE_QUICKSTART.md`
- Queue runtime: `docs/ops/automation/README.md`
- Provider compatibility: `docs/ops/automation/PROVIDER_COMPATIBILITY.md`
