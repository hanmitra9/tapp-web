-- TAPP · 0062 · Fee schedule.
--   · Brand: 18% platform fee out of the campaign budget (budget_fee_pct, unchanged).
--   · Creator: 20% platform fee taken when a clip's views are accepted — creators earn 80% of the brand rate
--     (creator_share_pct 80, was 70), so the rate and the balance a creator sees are already net.
--   · Withdrawal: flat Rp5.000 per payout (was Rp10.000), no percentage.
-- New campaigns take the new share; running campaigns keep the terms they launched with.
-- Monte Carlo (supabase/analysis/rank_monte_carlo.py, 10,000 runs): 0 losing runs, median margin 27.9%.

update public.app_settings set value = '80'::jsonb, updated_at = now() where key = 'creator_share_pct';
update public.app_settings set value = '5000'::jsonb, updated_at = now() where key = 'withdrawal_fee_idr';
update public.app_settings set value = '18'::jsonb, updated_at = now() where key = 'budget_fee_pct';
update public.app_settings set value = '0'::jsonb, updated_at = now() where key = 'creator_fee_pct';
