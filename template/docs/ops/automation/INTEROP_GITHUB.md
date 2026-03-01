# GitHub Interop Mapping

Status: canonical
Owner: {{DOC_OWNER}}
Last Updated: {{LAST_UPDATED_ISO_DATE}}
Source of Truth: This document.

## Purpose

Define a stable bridge from blueprint policy/orchestration contracts to GitHub-native agent profile scaffolds.
This keeps the blueprint provider-agnostic while making platform-native adoption easier.

## Inputs

- `AGENTS.md`
- `docs/governance/policy-manifest.json`
- `docs/ops/automation/orchestrator.config.json`

## Mapped Concepts

- Safety policy:
  - Source: `policy-manifest.mandatorySafetyRules`
  - Export: baseline policy profile.
- Role profiles:
  - Source: `orchestrator.config.roleOrchestration.roleProfiles`
  - Export: role capability profile per stage (`planner`, `explorer`, `worker`, `reviewer`).
- Risk routing:
  - Source: `orchestrator.config.roleOrchestration.pipelines`
  - Export: lane routing map (`low`, `medium`, `high`).
- Validation lanes:
  - Source: `orchestrator.config.validation`
  - Export: always/host-required checks metadata.
- Canonical entrypoints:
  - Source: `policy-manifest.docContract.canonicalEntryPoints`
  - Export: docs entrypoint hints.

## Export Contract

- Command: `npm run interop:github:export`
- Default mode: dry run (no `.github/agents/` files written).
- Report output: `docs/generated/github-agent-export.json`
- Optional file emission: pass `--write-profiles true` to write scaffolds under `.github/agents/`.

## Scaffold Files

When write mode is enabled, exporter writes:

- `.github/agents/base-policy.json`
- `.github/agents/role-profiles.json`
- `.github/agents/risk-pipelines.json`

These are scaffolds and may require project-specific adjustments.

## Non-Goals

- Enforcing a single platform-specific schema in governance checks.
- Replacing canonical blueprint policy docs.
- Auto-enabling orchestration features not explicitly configured.
