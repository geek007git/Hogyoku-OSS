#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
HEALTH_URL="${HEALTH_URL:-http://localhost:4173/api/health}"

required_variables=(
  DATABASE_URL
  REDIS_URL
  S3_ENDPOINT
  S3_BUCKET
  S3_ACCESS_KEY
  S3_SECRET_KEY
  SESSION_SECRET
)

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

for variable in "${required_variables[@]}"; do
  if [[ -z "${!variable:-}" ]]; then
    echo "Missing required environment variable: $variable" >&2
    exit 1
  fi
done

if [[ "${SESSION_SECRET}" == replace-* ]]; then
  echo "SESSION_SECRET still contains a placeholder." >&2
  exit 1
fi

docker compose -f "$COMPOSE_FILE" config --quiet
docker compose -f "$COMPOSE_FILE" up -d --build --remove-orphans

echo "Waiting for the API health check..."
for attempt in {1..40}; do
  if curl --fail --silent --show-error "$HEALTH_URL" >/dev/null; then
    echo "Deployment healthy at $HEALTH_URL"
    docker compose -f "$COMPOSE_FILE" ps
    exit 0
  fi
  sleep 3
done

echo "Deployment failed its health check." >&2
docker compose -f "$COMPOSE_FILE" logs --tail=120 api worker >&2
exit 1
