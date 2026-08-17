#!/usr/bin/env bash
# Applies seed data to $DATABASE_URL.
#   scripts/db-seed.sh reference   -> only 001_reference_data.sql (safe for production)
#   scripts/db-seed.sh demo        -> also applies 002_demo_data.sql (DEV/STAGING ONLY, never production)
set -euo pipefail

: "${DATABASE_URL:?Set DATABASE_URL, e.g. postgres://postgres:postgres@localhost:5432/ngc_erp}"

MODE="${1:-reference}"
SEED_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/supabase/seed"

echo "==> Applying 001_reference_data.sql"
psql -v ON_ERROR_STOP=1 -q "$DATABASE_URL" -f "$SEED_DIR/001_reference_data.sql"

if [ "$MODE" = "demo" ]; then
  echo "!! Applying 002_demo_data.sql — DEMO DATA, never run this against production !!"
  psql -v ON_ERROR_STOP=1 -q "$DATABASE_URL" -f "$SEED_DIR/002_demo_data.sql"
fi

echo "Seed complete (mode=$MODE)."
