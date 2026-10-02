-- TAPP · 0038 · No fee on payments; levels need more views.
--
-- The level bonus (0037) is the level benefit now, so the per-level fee (0034) goes to 0 for every level.
-- Level thresholds double: Rising 100K, Verified 500K, Proven 2M, Elite 10M lifetime qualified views.

set search_path = public, extensions;

update public.app_settings set value = '{"new": 0, "rising": 0, "verified": 0, "proven": 0, "elite": 0}'::jsonb, updated_at = now()
where key = 'withdrawal_fee_pct';

update public.app_settings set value = '{"new": 0, "rising": 100000, "verified": 500000, "proven": 2000000, "elite": 10000000}'::jsonb, updated_at = now()
where key = 'tier_thresholds';

-- Re-level everyone against the new thresholds.
do $$ declare r record; begin
  for r in select user_id from public.creator_profiles loop perform public.recompute_tier(r.user_id); end loop;
end $$;
