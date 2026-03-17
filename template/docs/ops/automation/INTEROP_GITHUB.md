# GitHub Interop Mapping

Status: canonical
Owner: {{DOC_OWNER}}
Last Updated: {{LAST_UPDATED_ISO_DATE}}
Source of Truth: This document.

## Purpose

Define the optional bridge from harness policy/runtime contracts to GitHub-native agent profile scaffolds.
Canonical policy still lives in the repository docs, not in GitHub-specific exports.

## Inputs

- `AGENTS.md`
- `docs/governance/policy-manifest.json`
- `docs/ops/automation/orchestrator.config.json`

## Mapped Concepts

- Safety policy:
  - Source: `policy-manifest.mandatorySafetyRules`
  - Export: baseline policy profile.
- Role profiles:
  - Source: runtime/planning role profiles in policy + executor config
  - Export: role capability profile (`planner`, `explorer`, `worker`, `reviewer`).
- Risk routing:
  - Source: sequential runtime routing (`low`, `medium`, `high`)
  - Export: lane routing map for `worker` and `reviewer`.
- Validation lanes:
  - Source: `orchestrator.config.validation`
  - Export: always/host-required checks metadata.
- Canonical entrypoints:
  - Source: `policy-manifest.docContract.canonicalEntryPoints`
  - Export: docs entrypoint hints.

## Export Contract

- If a repository exports GitHub profiles, keep them derived from the canonical harness docs.
- Exported files are scaffolds, not the source of truth.
- Report output, if enabled, belongs under `docs/generated/`.

## Scaffold Files

When write mode is enabled, exporter should write only derived profile scaffolds and a small README explaining that the repository docs remain canonical.

## Platform Caveats

- GitHub.com and IDE integrations may support different profile/frontmatter capabilities.
- Model and handoff behavior can differ by surface/version.
- Treat exported profiles as scaffolds; canonical policy remains in `docs/governance/*`.

## Non-Goals

- Enforcing a single platform-specific schema in governance checks.
- Replacing canonical harness policy docs.
- Auto-enabling runtime behavior not explicitly configured in the repository.
