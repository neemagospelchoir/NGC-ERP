#!/usr/bin/env bash
# Applies every migration plus reference seed data to $DATABASE_URL, then
# runs supabase/tests/smoke.sql — a repeatable database-integration smoke
# test suite (Phase 14.2) covering security-critical RLS/trigger behavior
# with no other automated coverage (see that file's own header comment for
# full scope and rationale). Mirrors db-migrate.sh/db-seed.sh's own
# conventions (ON_ERROR_STOP=1, so any failed assertion fails this script).
#
# Intended for a SCRATCH database only (CI's ephemeral postgres service, or
# a local throwaway database) — smoke.sql inserts fixture rows and does not
# clean up after itself.
set -euo pipefail

: "${DATABASE_URL:?Set DATABASE_URL, e.g. postgres://postgres:postgres@localhost:5432/ngc_erp}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "==> Applying migrations"
bash "$ROOT_DIR/scripts/db-migrate.sh"

echo "==> Applying reference seed data"
bash "$ROOT_DIR/scripts/db-seed.sh" reference

echo "==> Running database smoke-test assertions (supabase/tests/smoke.sql)"
psql -v ON_ERROR_STOP=1 -q "$DATABASE_URL" -f "$ROOT_DIR/supabase/tests/smoke.sql"

echo "Database smoke tests passed."
