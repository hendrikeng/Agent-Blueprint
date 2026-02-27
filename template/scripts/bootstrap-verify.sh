#!/usr/bin/env bash
set -euo pipefail

./scripts/check-template-placeholders.sh
npm run docs:verify
npm run conformance:verify
npm run architecture:verify
npm run agent:verify

echo "[bootstrap-verify] passed"
