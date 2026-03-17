# Memory and Context Policy

Status: canonical
Owner: {{DOC_OWNER}}
Last Updated: {{LAST_UPDATED_ISO_DATE}}
Source of Truth: This document.

## Context Budget Rules

- Treat the repo as the main operating system for long-running agent work.
- Keep plans, evidence, docs, code, and validation output as the source of truth.
- Treat `## Must-Land Checklist` as the execution contract and keep `## Already-True Baseline`, `## Must-Land Checklist`, and `## Deferred Follow-Ons` separate so memory does not silently absorb unfinished target state.
- Prioritize active task requirements and recent authoritative state.
- Default to the smallest durable context that can safely resume the current slice.
- Trim low-value context before truncating policy or invariants.
- Keep prompts deterministic for critical workflows.
- Use a four-layer memory model:
  - active working context: runtime policy, current plan, latest checkpoint, latest handoff, and only the evidence needed for the current step
  - queue state: `run-state.json` plus `run-events.jsonl`
  - resumable plan state: `docs/ops/automation/runtime/state/<plan-id>/latest.json` plus `docs/ops/automation/handoffs/<plan-id>.md`
  - external artifacts: source files, plan docs, evidence indexes, logs, and validation output
- Treat logs and large tool output as external by default. Promote only distilled findings and stable pointers into active context.
- Separate reasoning state from evidence state in durable memory:
  - reasoning: current subtask, next action, blockers, rationale
  - evidence: accepted facts, artifact references, extracted findings, validation/log references
- Keep retrieval selective. Load only the current plan, the latest checkpoint, the latest handoff, and artifact references relevant to the current role/stage.
- Persist distilled findings and stable references, not raw session history.

## Persistence Rules

- Persist only data required for continuity, audit, or user intent.
- Do not persist secrets, credentials, or transient sensitive payloads.
- Define expiration and deletion behavior for persisted memory.
- Persist continuity as repo-local runtime artifacts:
  - `run-state.json` for the current queue snapshot
  - `run-events.jsonl` for append-only queue events
  - `latest.json` for the newest machine-readable plan checkpoint
  - operator-facing markdown handoff notes
  - per-run result payloads, validation payloads, and command logs under `docs/ops/automation/runtime/`
- Checkpoint at every session end, every stage completion, every `pending` or `handoff_required`, and immediately before validation handoff.
- Summaries are replaceable, not sacred. Durable state must stay small, versioned, and reconstructable from the latest checkpoint plus external artifacts.

## Improve Before Re-Architecture

- better checkpoint contents
- better handoff notes
- better evidence compaction
- better validation and observability
- fix plan quality and queue-discipline gaps before changing architecture

## Do Not Add Yet

- Do not add external retrieval just because work is long.
- Do not add provider-thread persistence just because context is limited.
- Do not move important working memory outside the repo while repo-local continuity is sufficient.
- Do not treat extra memory systems as a substitute for better checkpoints, handoffs, and plans.

## Consider Bigger Changes Later

- agents repeatedly miss important context even though it exists
- repo-local checkpoints and handoffs stop being enough
- important memory starts living outside the repo
- you need one agent to search across many unrelated systems
- you can point to repeated failures, not just a vague worry

## Safe Rule

- If repo-local state is enough, keep this design.
- If important context lives outside the repo and agents keep missing it, then consider external retrieval.

## Provenance and Redaction

- Record provenance for retrieved memory/context used in decisions.
- Prefer canonical local docs over ad-hoc memory for policy decisions.
- Redact sensitive fields in stored memory and retrieval logs.
- Retain exact anchors in durable state when they matter for resumption: file paths, plan IDs, run IDs, session log paths, evidence index paths, validation references, and concrete blockers.
