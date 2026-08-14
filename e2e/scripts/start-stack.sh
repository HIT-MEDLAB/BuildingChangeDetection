#!/usr/bin/env bash
# Starts everything the E2E test needs *except* the three app servers
# themselves (Playwright's webServer config in playwright.config.js starts
# those). Run this once before `npm test`.
#
# Usage (from the e2e/ folder):
#   ./scripts/start-stack.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

echo "== 1/3  Starting Postgres (docker compose) =="
if [ ! -f .env ]; then
  echo "No .env at repo root - copying .env.example (edit it if you use custom DB credentials)."
  cp .env.example .env
fi
docker compose up -d postgres

echo "== 2/3  Waiting for Postgres to report healthy =="
for i in $(seq 1 30); do
  status="$(docker inspect --format='{{.State.Health.Status}}' bcd-postgres 2>/dev/null || echo starting)"
  if [ "$status" = "healthy" ]; then
    echo "Postgres is healthy."
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "Postgres did not become healthy in time - check 'docker compose logs postgres'." >&2
    exit 1
  fi
  sleep 1
done

echo "== 3/3  Seeding the E2E test user (idempotent) =="
if [ ! -f backend/.env ]; then
  echo "No backend/.env - copying backend/.env.example (edit it if you use custom DB credentials)."
  cp backend/.env.example backend/.env
fi
( cd backend && npm install --no-audit --no-fund > /dev/null && node seed.js )

echo
echo "Stack ready:"
echo "  - Postgres:   localhost:5432 (via docker compose)"
echo "  - Test user:  yair@medlab.hit.ac.il / password123"
echo
echo "Next: cd e2e && npm install && npx playwright install --with-deps chromium && npm test"
