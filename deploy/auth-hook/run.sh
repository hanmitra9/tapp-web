#!/usr/bin/env bash
set -euo pipefail
REF=njffqsbddzztfxxbavpp
: "${SUPABASE_ACCESS_TOKEN:?}" "${HOOK_SECRET:?}" "${MAILER_HOOK_URL:?}"
API="https://api.supabase.com/v1/projects/$REF/config/auth"
body=$(jq -n --arg uri "$MAILER_HOOK_URL" --arg s "$HOOK_SECRET" \
  '{hook_send_email_enabled: true, hook_send_email_uri: $uri, hook_send_email_secrets: $s}')
code=$(curl -sS -o /tmp/out -w '%{http_code}' -X PATCH "$API" -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H 'Content-Type: application/json' -d "$body")
echo "PATCH auth config: HTTP $code"
[ "$code" -lt 300 ] || { cat /tmp/out; exit 1; }
curl -sS "$API" -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" | jq '{hook_send_email_enabled, hook_send_email_uri, site_url, uri_allow_list}'
echo "AUTH HOOK DONE"
sleep 30
