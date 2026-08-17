#!/usr/bin/env bash
# Applies every migration in supabase/migrations, in filename order, to the
# database identified by $DATABASE_URL. Used both locally and by CI's
# migration-check gate (.github/workflows/ci.yml).
set -euo pipefail

: "${DATABASE_URL:?Set DATABASE_URL, e.g. postgres://postgres:postgres@localhost:5432/ngc_erp}"

MIGRATIONS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/supabase/migrations"

for f in "$MIGRATIONS_DIR"/*.sql; do
  echo "==> Applying $(basename "$f")"
  psql -v ON_ERROR_STOP=1 -q "$DATABASE_URL" -f "$f"
done

echo "All migrations applied successfully."
