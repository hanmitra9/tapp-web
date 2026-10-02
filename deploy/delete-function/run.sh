#!/usr/bin/env bash
set -euo pipefail
REF=njffqsbddzztfxxbavpp
: "${SUPABASE_ACCESS_TOKEN:?}" "${FUNCTION_SLUG:?}"
code=$(curl -sS -o /tmp/out -w '%{http_code}' -X DELETE "https://api.supabase.com/v1/projects/$REF/functions/$FUNCTION_SLUG" -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN")
echo "DELETE $FUNCTION_SLUG: HTTP $code"; cat /tmp/out; echo
[ "$code" -lt 300 ] || [ "$code" = 404 ]
echo "DELETE FUNCTION DONE"
sleep 30
