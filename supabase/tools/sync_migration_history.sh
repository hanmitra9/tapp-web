#!/usr/bin/env bash
# One-time fix, run from the repo root before the first `supabase db push`.
#
# Migrations 001–023 were applied to the live project through the dashboard/MCP, which recorded them under
# timestamp versions (20260923121600_schema …). The repo names the same 23 migrations 20260923000001–023.
# Same SQL, same order — only the version numbers differ. Two more live-only versions are marked reverted below. Without this, `supabase db push` would think
# nothing is applied and try to run 001 again. This rewrites the history table only; no schema changes.
set -euo pipefail
REF=njffqsbddzztfxxbavpp

REMOTE=(20260923121600 20260923121738 20260923121829 20260923121846 20260923121913 20260923121940 20260923121955
        20260923122033 20260923122149 20260923224535 20260923225420 20260923225454 20260923230001 20260923230723
        20260923233520 20260924052220 20260924115758 20260929230259 20260929235149 20260930000234 20261001020801
        20261001115722 20261001120306
        20261001170321 20261001170628)   # applied from another session (an earlier take on 024–027); the repo's
                                         # 024–031 supersede them — verified to apply cleanly on top
LOCAL=(); for i in $(seq -w 1 23); do LOCAL+=("202609230000$i"); done

supabase link --project-ref "$REF"
supabase migration repair --status reverted "${REMOTE[@]}"
supabase migration repair --status applied "${LOCAL[@]}"
supabase migration list            # 001–023 should now show on both sides; 024+ local only
echo "History synced. Next: supabase db push   (applies 024 onwards)"
