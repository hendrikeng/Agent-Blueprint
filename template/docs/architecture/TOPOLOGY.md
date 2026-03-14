# Architecture Topology

Status: canonical
Owner: {{DOC_OWNER}}
Last Updated: {{LAST_UPDATED_ISO_DATE}}
Source of Truth: This document and the repository app/package layout.

## Why This Exists

- Architecture docs must name the current runtime surfaces, shared packages, and transitional entrypoints.
- Repo-specific topology belongs here rather than being scattered across product docs or plan notes.
- Detailed app behavior docs may live elsewhere, but this file owns the structural map.

## What To Record

- Current deployable apps, APIs, workers, and internal surfaces.
- Shared packages or libraries that form canonical boundaries.
- Legacy or transitional surfaces still in use and the migration note for each.
- Links to deeper app-surface or product-contract docs when they exist.

## Verification

- Keep this file aligned with `ARCHITECTURE.md`, `docs/architecture/README.md`, and `docs/governance/architecture-rules.json`.
- Update it whenever runtime entrypoints, package boundaries, or transitional surfaces change.
