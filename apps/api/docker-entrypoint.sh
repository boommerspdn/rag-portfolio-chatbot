#!/bin/sh
set -e

echo "Running Prisma migrations..."
./node_modules/.bin/prisma migrate deploy || {
  echo ""
  echo "Migration failed. P3009 means Postgres still has a FAILED row in _prisma_migrations from an earlier run."
  echo "Changing migration files does not clear that — Prisma will not re-apply until you resolve it."
  echo "  Dev (recommended): docker compose down -v && docker compose up -d --build"
  echo "  Or: https://pris.ly/d/migrate-resolve"
  exit 1
}

exec node dist/src/main
