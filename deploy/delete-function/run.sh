#!/usr/bin/env bash
set -euo pipefail
REF=njffqsbddzztfxxbavpp
: "${SUPABASE_ACCESS_TOKEN:?}" "${FUNCTION_SLUG:?}"
code=$(curl -sS -o /tmp/out -w '%{http_code}' -X DELETE "https://api.supabase.com/v1/projects/$REF/functions/$FUNCTION_SLUG" -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN")
echo "DELETE $FUNCTION_SLUG: HTTP $code"; cat /tmp/out; echo
[ "$code" -lt 300 ] || [ "$code" = 404 ]
echo "DELETE FUNCTION DONE"
# Turn on leaked-password protection (HaveIBeenPwned check) for Supabase Auth.
code=$(curl -sS -o /tmp/out -w '%{http_code}' -X PATCH "https://api.supabase.com/v1/projects/$REF/config/auth" -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H 'Content-Type: application/json' -d '{"password_hibp_enabled":true}')
echo "HIBP: HTTP $code"; head -c 300 /tmp/out; echo
curl -sS "https://api.supabase.com/v1/projects/$REF/config/auth" -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" | grep -o '"password_hibp_enabled":[a-z]*' || true
sleep 30
