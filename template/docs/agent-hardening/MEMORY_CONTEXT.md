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
- Default to task-scoped contact packs per role session; expand beyond the pack only for explicit blockers.
- Trim low-value context before truncating policy or invariants.
- Keep prompts deterministic for critical workflows.
- Use a four-layer memory model:
  - active working context: runtime policy, current task scope, latest state snapshot, and the last one or two checkpoints
  - session summary: the latest durable continuity snapshot for the plan
  - episodic memory: append-only checkpoint records for prior sessions/subtasks
  - external artifacts: source files, plan docs, evidence indexes, logs, and validation output
- Treat logs and large tool output as external by default. Promote only distilled findings and stable pointers into active context.
- Separate reasoning state from evidence state in durable memory:
  - reasoning: current subtask, next action, blockers, rationale
  - evidence: accepted facts, artifact references, extracted findings, validation/log references
- Keep retrieval selective. Load only the latest state, the most recent checkpoint slice, and artifact references relevant to the current role/stage.
- Persist distilled findings and stable references, not raw session history.

## Persistence Rules

- Persist only data required for continuity, audit, or user intent.
- Do not persist secrets, credentials, or transient sensitive payloads.
- Define expiration and deletion behavior for persisted memory.
- Persist continuity as repo-local runtime artifacts:
  - `latest.json` for machine-readable current state
  - `checkpoints.jsonl` for append-only episodic memory
  - structured JSON handoff packets plus operator-facing markdown handoff notes
  - contact-pack JSON manifests with scored selected inputs and thin-pack classification
  - incident replay bundles for failed or continuity-degraded sessions
- Checkpoint at every session end, every stage completion, every `pending` or `handoff_required`, and immediately before validation handoff.
- Score each checkpoint for resume safety before treating it as durable continuity.
- Summaries are replaceable, not sacred. Durable state must stay small, versioned, and reconstructable from checkpoints plus external artifacts.

## Improve Before Re-Architecture

- better checkpoint contents
- better contact-pack selection
- better evidence compaction
- better validation and observability
- fix rolling-context and contact-pack implementation gaps before changing architecture

## Do Not Add Yet

- Do not add external retrieval just because work is long.
- Do not add provider-thread persistence just because context is limited.
- Do not move important working memory outside the repo while repo-local continuity is sufficient.
- Do not treat extra memory systems as a substitute for better checkpoints and better contact packs.

## Consider Bigger Changes Later

- agents repeatedly miss important context even though it exists
- repo-local checkpoints/contact packs stop being enough
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
