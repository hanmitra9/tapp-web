#!/usr/bin/env bash
# Local verification: applies migrations to a throwaway DB and runs the workflow test.
set -euo pipefail; cd "$(dirname "$0")/.."
DB=${DB:-tapp_test}
dropdb --if-exists "$DB"; createdb "$DB"
for f in tests/_local_stubs.sql migrations/*.sql; do psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$f"; done
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f tests/workflow_smoke.sql
