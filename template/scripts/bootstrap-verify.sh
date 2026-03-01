#!/usr/bin/env bash
set -euo pipefail

./scripts/check-template-placeholders.sh
npm run context:compile
npm run verify:fast
npm run verify:full

echo "[bootstrap-verify] passed"
