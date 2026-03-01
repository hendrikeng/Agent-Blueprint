# Automation Outcomes

Status: canonical
Owner: {{DOC_OWNER}}
Last Updated: {{LAST_UPDATED_ISO_DATE}}
Source of Truth: This document.

## Purpose

Keep automation value measurable with a compact, repeatable scorecard.
Use this to demonstrate that orchestration reduces blast radius and debugging overhead.

## Data Sources

- `docs/ops/automation/run-events.jsonl`
- `docs/generated/perf-comparison.json`
- `docs/exec-plans/evidence-index/*.md`
- `docs/generated/run-outcomes.json`

## Scorecard Metrics

- Lead time:
  - Definition: first plan event timestamp to terminal plan event timestamp.
  - Output: mean/median lead time seconds across plans.
- Validation reliability:
  - Definition: counts of passed/failed host and always validation events.
  - Output: pass/fail totals and failure rate.
- Evidence compactness:
  - Definition: number of evidence lifecycle/compaction events per run.
  - Output: curated vs noisy evidence trend.
- Rework loops:
  - Definition: count rollover/handoff and repeated non-terminal sessions.
  - Output: indicator of unclear scope or missing preconditions.

## Report Workflow

1. Run automation (`automation:run` or `automation:run:parallel`).
2. Generate scorecard JSON: `npm run outcomes:report`.
3. Inspect `docs/generated/run-outcomes.json`.
4. Reference key numbers in plan closure notes or release notes.

## Interpretation Guide

- Good signal:
  - Stable lead times for similar risk tiers.
  - Validation failures trend down over time.
  - Evidence compaction keeps references concise.
- Investigation signal:
  - Spiking handoff/rework counts.
  - Repeated validation failures on same plan group.
  - High event volume with low completion throughput.

## Notes

- This scorecard is intentionally lightweight.
- It is an operational summary, not a replacement for domain-level KPIs.
