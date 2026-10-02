#!/usr/bin/env bash
# Same steps as supabase/tools/sync_migration_history.sh + supabase db push.
# Auth: SUPABASE_ACCESS_TOKEN (CLI links the project and logs in with a temporary role) or DB_PASSWORD (--db-url).
set -uo pipefail
REF=njffqsbddzztfxxbavpp
cd /src
[ -f supabase/config.toml ] || supabase init --force >/dev/null 2>&1 || true

TARGET=()
if [ -n "${DB_PASSWORD:-}" ]; then
  PW=$(node -e 'process.stdout.write(encodeURIComponent(process.env.DB_PASSWORD))')
  for host in aws-0-ap-southeast-2.pooler.supabase.com aws-1-ap-southeast-2.pooler.supabase.com; do
    u="postgresql://postgres.${REF}:${PW}@${host}:5432/postgres"
    if supabase migration list --db-url "$u" >/dev/null 2>&1; then TARGET=(--db-url "$u"); echo "connected via $host"; break; fi
  done
elif [ -n "${SUPABASE_ACCESS_TOKEN:-}" ]; then
  supabase link --project-ref "$REF" && TARGET=(--linked) && echo "linked with access token"
fi
[ ${#TARGET[@]} -gt 0 ] || { echo "ERROR: cannot connect (set SUPABASE_ACCESS_TOKEN or DB_PASSWORD)"; exit 1; }

REMOTE=(20260923121600 20260923121738 20260923121829 20260923121846 20260923121913 20260923121940 20260923121955
        20260923122033 20260923122149 20260923224535 20260923225420 20260923225454 20260923230001 20260923230723
        20260923233520 20260924052220 20260924115758 20260929230259 20260929235149 20260930000234 20261001020801
        20261001115722 20261001120306 20261001170321 20261001170628)
LOCAL=(); for i in $(seq -w 1 23); do LOCAL+=("202609230000$i"); done
set -e
supabase migration list "${TARGET[@]}"
supabase migration repair "${TARGET[@]}" --status reverted "${REMOTE[@]}"
supabase migration repair "${TARGET[@]}" --status applied "${LOCAL[@]}"
echo y | supabase db push "${TARGET[@]}"
supabase migration list "${TARGET[@]}"
echo "DB UPDATE DONE"
# Stay up briefly so the logs are kept with a finished deployment, then exit.
sleep 30
