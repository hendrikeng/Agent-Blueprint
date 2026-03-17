# Generated Docs

Status: canonical
Owner: {{DOC_OWNER}}
Last Updated: {{LAST_UPDATED_ISO_DATE}}
Source of Truth: This directory.

Generated artifacts are rebuildable outputs derived from canonical docs, policy checks, or measured runs. They are navigationally important, but they are not the primary hand-maintained source of truth.

## Core Generated Artifacts

- `docs/generated/AGENT-RUNTIME-CONTEXT.md`: compact runtime policy snapshot compiled for orchestrated role sessions.
- `docs/generated/article-conformance.json`: conformance summary derived from the repo's article/check rules.
- `docs/generated/evals-report.json`: agent-hardening evaluation summary.
- `docs/generated/continuity-evals-report.json`: continuity-specific hardening evaluation summary.
- `docs/generated/resilience-evals-report.json`: resilience-specific hardening evaluation summary.

## Optional Repo-Local Generated Artifacts

- Schema reference snapshots or provider/export reports when the repository adds extra generation commands beyond the harness baseline.

## Rules

- Regenerate artifacts from canonical policy, schema, or telemetry sources instead of hand-editing generated outputs.
- If a generated artifact becomes a routine entrypoint, surface it from `docs/MANIFEST.md` or `docs/README.md`.
- Remove generated artifacts that are no longer produced by any documented contract or script.
