# Codex Agent Blueprint

Status: canonical
Owner: Platform Engineering
Last Updated: 2026-02-27
Source of Truth: This directory.

Reusable blueprint for initializing agent-first repositories with standardized docs/governance architecture.

## Includes

- Canonical docs skeleton under `template/docs/`
- Base top-level docs: `template/AGENTS.md`, `template/README.md`, `template/ARCHITECTURE.md`
- Governance/conformance/architecture checker scripts under `template/scripts/`
- Governance config and architecture rule schema in `template/docs/governance/`
- Placeholder contract: `template/PLACEHOLDERS.md`

## Required Script Interface

- `docs:verify` -> `node ./scripts/docs/check-governance.mjs`
- `conformance:verify` -> `node ./scripts/check-article-conformance.mjs`
- `architecture:verify` -> `node ./scripts/architecture/check-dependencies.mjs`

## Template Policy

This blueprint is intentionally stack- and domain-agnostic.
Agents must replace all `{{...}}` placeholders before treating a repo as production-ready.

## Bootstrap Steps

1. Copy `template/` contents into a new repository root.
2. Replace placeholders listed in `PLACEHOLDERS.md`.
3. Verify no placeholders remain:
   - `./scripts/check-template-placeholders.sh`
4. Add script entries to repository `package.json`:
   - `docs:verify`
   - `conformance:verify`
   - `architecture:verify`
5. Update `docs/generated/article-conformance.json` evidence paths for the new repository.
6. Run `npm run docs:verify && npm run conformance:verify && npm run architecture:verify`.
