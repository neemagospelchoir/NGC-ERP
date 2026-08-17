#!/usr/bin/env bash
# Drops and recreates the target database, then reapplies migrations and
# reference seed data. Intended for local development only — never point
# this at a production DATABASE_URL.
set -euo pipefail

: "${DATABASE_URL:?Set DATABASE_URL}"
: "${DATABASE_ADMIN_URL:?Set DATABASE_ADMIN_URL (a connection allowed to DROP/CREATE DATABASE)}"
: "${DATABASE_NAME:?Set DATABASE_NAME, e.g. ngc_erp}"

psql -v ON_ERROR_STOP=1 -q "$DATABASE_ADMIN_URL" -c "DROP DATABASE IF EXISTS ${DATABASE_NAME};"
psql -v ON_ERROR_STOP=1 -q "$DATABASE_ADMIN_URL" -c "CREATE DATABASE ${DATABASE_NAME};"

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bash "$DIR/db-migrate.sh"
bash "$DIR/db-seed.sh" reference
