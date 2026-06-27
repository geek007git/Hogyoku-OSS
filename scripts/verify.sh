#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "==> Type checking"
npm run typecheck

echo "==> Running tests"
npm test

echo "==> Building release artifacts"
npm run build

echo "==> Auditing production dependencies"
npm audit --omit=dev

echo "==> Checking Docker Compose configuration"
docker compose config --quiet

echo "Verification complete."
