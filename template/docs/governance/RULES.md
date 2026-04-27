# Governance Rules

Status: canonical
Owner: {{DOC_OWNER}}
Last Updated: {{LAST_UPDATED_ISO_DATE}}
Source of Truth: This document.

## Core Rules

- Canonical docs are source-of-truth for behavior and constraints.
- Correctness over speed for sensitive domains.
- Shared contracts/primitives are canonical.
- Server-side authority for critical invariants.
- No fabricated production behavior paths.
- Keep architecture boundaries enforceable.
- Keep agent hardening policy canonical from bootstrap.
- Keep security and data-safety controls explicit.
- Docs are part of done.
- Root `README.md` is a concise orientation surface, not a rolling delivery log; detailed current behavior belongs in `docs/product-specs/CURRENT-STATE.md` and domain docs.
- Harness-defined canonical framework docs under `docs/` use uppercase basenames with lowercase `.md`; folder entrypoints remain `README.md`, and newly created repo-local docs stay lowercase unless explicitly promoted into the canonical harness contract.
- Canonical docs must remain environment-agnostic: no personal machine paths, hostnames, credentials, or private runbooks.
- `docs/governance/policy-manifest.json` is the machine-readable policy source for runtime context compilation.

## Planning and Scope

- Non-trivial work must be planned before implementation.
- One executable slice maps to one future or active plan; split broader initiatives into ordered slices with explicit dependencies.
- Use `docs/future/` before implementation when work crosses domains, changes architecture or critical invariants, requires staged rollout, is expected to span multiple sessions or PRs, or carries medium/high risk.
- Direct active execution is acceptable only for isolated, low-risk fixes with one focused acceptance surface.
- If direct work expands beyond that boundary, stop and create or promote a future slice before continuing.
- Plans must keep `## Already-True Baseline`, `## Must-Land Checklist`, and `## Deferred Follow-Ons` separate so merge scope stays explicit.

## Branch and Merge Discipline

- Do not switch branches or worktrees unless the user explicitly requests it in-thread.
- Prefer short-lived slice branches and PR review for shared-repository work.
- Atomic commits provide slice isolation inside a checkout; they are not a substitute for branch policy when a repo defines one.
- Repo-specific `dev`, `main`, release branch, or merge-strategy rules must be documented in repo-local ops docs before they are treated as mandatory.
- Merge-ready slices should close or update their active plan state and preserve review evidence in completed plans or evidence docs.

## Documentation Discipline

- Docs are part of done for behavior, workflow, architecture, and critical invariant changes.
- Root `README.md` is a concise orientation and current top-level scope surface, not a delivery log or exhaustive docs index.
- Detailed current behavior belongs in current-state, domain, governance, design, automation, or evidence docs.
- Historical/archive material is not canonical unless it is explicitly promoted into a canonical doc.
- Do not duplicate full navigation into `README.md` or `AGENTS.md`; keep `docs/README.md` as the documentation index.

## Execution Quality

- Translate implementation requests into verifiable goals before editing.
- For multi-step work, pair each planned step with the check that proves it.
- Prefer the smallest implementation that satisfies the must-land checklist, and keep every changed line traceable to the user request, active plan, or required validation.
- State material assumptions when intent has multiple plausible interpretations; ask or stop rather than silently choosing a risky path.

## Verification Profiles

- Fast iteration profile: `npm run verify:fast`
  - Scope-aware checks + mandatory safety checks.
- Full merge profile: `npm run verify:full`
  - `node ./scripts/automation/compile-runtime-context.mjs`
  - `node ./scripts/docs/check-governance.mjs`
  - `node ./scripts/check-article-conformance.mjs`
  - `node ./scripts/architecture/check-dependencies.mjs`
  - `node ./scripts/agent-hardening/check-agent-hardening.mjs`
  - `node ./scripts/agent-hardening/check-evals.mjs`
  - `node ./scripts/automation/check-harness-alignment.mjs`
  - `node ./scripts/automation/check-plan-metadata.mjs`
- Relevant domain tests remain required for changed behavior.
