#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

command -v node >/dev/null 2>&1 || {
  echo "Node.js 22 or newer is required." >&2
  exit 1
}
command -v docker >/dev/null 2>&1 || {
  echo "Docker is required for the local infrastructure stack." >&2
  exit 1
}

NODE_MAJOR="$(node -p "Number(process.versions.node.split('.')[0])")"
if (( NODE_MAJOR < 22 )); then
  echo "Node.js 22 or newer is required; found $(node --version)." >&2
  exit 1
fi

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Created .env from .env.example."
fi

npm ci
docker compose up -d postgres redis minio minio-init

echo "Waiting for PostgreSQL..."
for attempt in {1..30}; do
  if docker compose exec -T postgres pg_isready -U hogyoku >/dev/null 2>&1; then
    npm run db:migrate
    echo "Hogyoku infrastructure is ready."
    echo "Run 'npm run dev' and 'npm run dev:worker' in separate terminals."
    exit 0
  fi
  sleep 2
done

echo "PostgreSQL did not become ready in time." >&2
exit 1
