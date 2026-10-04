-- TAPP · 0052 · Hardening after the pricing changes.
--  · campaign_pricing (brand price, creator share, platform fee) is admin-only: brands read their numbers through
--    brand_campaigns()/brand reports, never the margin split.
--  · Pin search_path on the pricing helpers (linter: function_search_path_mutable).
--  · Fee/bonus helpers are not for anonymous callers.

set search_path = public, extensions;

drop policy if exists campaign_pricing_read on public.campaign_pricing;
create policy campaign_pricing_read on public.campaign_pricing for select to authenticated using (public.is_admin());

alter function private.brand_amount(bigint, numeric) set search_path = pg_catalog;
alter function private.spend_share(numeric, numeric) set search_path = pg_catalog;

revoke execute on function public.tier_bonus_pct(public.creator_tier) from anon;
revoke execute on function public.withdrawal_fee_pct(public.creator_tier) from anon;
