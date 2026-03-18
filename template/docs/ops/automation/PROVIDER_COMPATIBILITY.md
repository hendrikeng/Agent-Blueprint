# Provider Compatibility

Status: canonical
Owner: {{DOC_OWNER}}
Last Updated: {{LAST_UPDATED_ISO_DATE}}
Source of Truth: This document.

## Purpose

Define the minimum provider CLI contract required by the sequential automation conveyor.
Keep this file current when changing provider commands, flags, or output behavior.

## Supported Providers

- Codex CLI (provider key: `codex`)
- Claude Code CLI (provider key: `claude`)

## Required Execution Contract

Every provider command must support:

- Non-interactive invocation suitable for orchestration runs.
- Prompt injection via `{prompt}` placeholder.
- Runtime role selection for `worker` and `reviewer`.
- Command exit status propagation.
- Structured result payload written to `ORCH_RESULT_PATH`.

Provider live-progress text is optional and best-effort only; it is not part of the required execution contract.

## Baseline Command Templates

- Codex: `codex -a never exec --json --sandbox {sandbox_mode} -c model_reasoning_effort={reasoning_effort} -m {model} {prompt}`
- Claude: `claude -p --model {model} {prompt}`

These are baseline templates, not universal guarantees across all versions.

## Compatibility Notes

- If a provider CLI version removes or changes required flags, update:
  - `docs/ops/automation/orchestrator.config.json`
  - this document
- any exported interop scaffolds
- Prefer explicit pinning in project setup docs when reproducibility matters.
- Portable runtime profiles may use `sandboxMode: full-access`, but the Codex CLI flag for that mode is `--sandbox danger-full-access`.

## Structured Payload Guarantee

The orchestrator relies on the executor contract to enforce structured output:

- Required payload fields: `status`, `summary`, `reason`, `contextRemaining`
- Recommended payload fields when available: `contextWindow`, `currentSubtask`, `nextAction`, `stateDelta`
- Payload path: `ORCH_RESULT_PATH`
- Allowed status values: `completed`, `blocked`, `handoff_required`, `pending`

If payload is missing or invalid, orchestration treats the session as incomplete and forces safe continuation behavior.

## Low-Context Handoff Behavior

- Providers must report a truthful `contextRemaining` estimate for each session result.
- Providers should report `contextWindow` when possible so percent-based thresholds can be enforced.
- If a session is near the configured threshold and the current role boundary is not safely complete, return `handoff_required` with a concrete `nextAction` and `pendingActions`.
- The runtime may override a misleading `completed` result into a forced handoff when the reported remaining context is too low for safe continuation.

## Live Activity Telemetry (Optional)

- Orchestrator heartbeats may surface provider text as `agent="..."` when available.
- For Codex, `--json` output is preferred so orchestrator can parse structured progress/status events.
- This channel is informational only and must not control retries, completion, or policy gates.
- Missing, delayed, or format-shifted provider text must not fail orchestration.

## GitHub Interop Caveat

GitHub custom agent profiles (`.agent.md`) are exported as scaffolds.
Some profile properties may behave differently between GitHub.com and IDE integrations.
Treat exported profiles as starting points, not canonical policy.

## Verification Checklist

When updating provider commands:

1. Run `npm run verify:fast`.
2. Run `npm run verify:full`.
3. Confirm required placeholders remain present (`{prompt}`, `{model}`, `{reasoning_effort}` when used).
