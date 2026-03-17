# Automation Outcomes

Status: canonical
Owner: {{DOC_OWNER}}
Last Updated: {{LAST_UPDATED_ISO_DATE}}
Source of Truth: This document.

## Purpose

Keep automation value measurable with a compact, repeatable scorecard.
Use this to confirm that the flat queue stays fast, predictable, and low-noise.

## Data Sources

- `docs/ops/automation/run-events.jsonl`
- `run-state.json` in `docs/ops/automation/`
- `docs/exec-plans/evidence-index/*.md`
- optional generated outcome reports if the repository enables them

## Scorecard Metrics

- Time to first worker edit:
  - Definition: plan start to first worker session that touches repository files.
  - Output: mean/median seconds across recent runs.
- Review rate:
  - Definition: share of completed plans that required a reviewer pass.
  - Output: count and percentage for medium/high-risk work.
- Lead time:
  - Definition: first plan event timestamp to terminal plan event timestamp.
  - Output: mean/median lead time seconds across plans.
- Validation reliability:
  - Definition: counts of passed/failed host and always validation events.
  - Output: pass/fail totals and failure rate.
- Rework loops:
  - Definition: count handoffs, blocked plans, and repeated worker passes.
  - Output: totals plus sessions-per-completed-plan distribution.

## Report Workflow

1. Run automation (`automation:run`, `automation:resume`, or `automation:grind`).
2. Inspect `run-events.jsonl`, the latest `run-state.json`, and recent evidence indexes.
3. Reference the key numbers in plan closure notes or release notes.

## Interpretation Guide

- Good signal:
  - Time-to-first-edit medians trend down for similar risk tiers.
  - Sessions per completed plan stay low and stable.
  - Stable lead times for similar risk tiers.
  - Validation failures trend down over time.
  - Resume succeeds from the latest checkpoint and handoff without operator confusion.
- Investigation signal:
  - Time-to-first-edit spikes without corresponding risk increase.
  - Repeated worker/reviewer loops on the same plan.
  - Spiking handoff/rework counts.
  - Repeated validation failures on same plan group.
  - High event volume with low completion throughput.

## Notes

- This scorecard is intentionally lightweight.
- It is an operational summary, not a replacement for domain-level KPIs.
