-- TAPP · 0046 · All-in price for brands, platform fee on the creator side.
--
-- Brands pay one all-in price per 1,000 qualified views (campaign_pricing.brand_cpm, 0045): the gap to the creator
-- rate covers valid-views guarantees and fraud filtering, so there is no separate brand fee any more
-- (platform_fee_pct = 0; reports show total cost = views cost).
-- Creators pay a platform fee when they withdraw: app_settings.creator_fee_pct (18%) of the balance withdrawn,
-- plus the flat transfer fee (withdrawal_fee_idr, Rp10.000). The level bonus is still added on top.
--   net = amount + bonus − (round(amount × 18%) + 10.000)

set search_path = public, extensions;

update public.app_settings set value = '0'::jsonb, updated_at = now() where key = 'platform_fee_pct';
insert into public.app_settings (key, value) values ('creator_fee_pct', '18'::jsonb) on conflict (key) do nothing;

drop policy if exists app_settings_read on public.app_settings;
create policy app_settings_read on public.app_settings for select to authenticated
  using (key in ('earnings_hold_days','min_payout_idr','max_submissions_per_day','publish_grace_minutes','view_milestones',
                 'platform_oauth_config','withdrawal_fee_pct','tier_bonus_pct','withdrawal_fee_idr','creator_fee_pct'));

create or replace function public.request_payout(p_idempotency_key uuid) returns public.payout_requests
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_uid uuid := auth.uid(); v_status public.creator_status; v_tier public.creator_tier; r public.payout_requests;
  v_ids uuid[]; v_amount bigint; v_pct numeric; v_fee bigint; v_bpct numeric; v_bonus bigint; pm public.creator_payout_methods;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if p_idempotency_key is null then raise exception 'idempotency_key_required'; end if;
  perform pg_advisory_xact_lock(hashtextextended('payout:' || v_uid::text, 0));

  select * into r from public.payout_requests where creator_id = v_uid and idempotency_key = p_idempotency_key;
  if found then return r; end if;                                   -- retried request

  select status, tier into v_status, v_tier from public.creator_profiles where user_id = v_uid;
  if v_status is distinct from 'active' then raise exception 'creator_not_eligible:%', v_status; end if;
  if exists (select 1 from public.payout_requests where creator_id = v_uid
             and status in ('requested','reviewing','approved','processing')) then
    raise exception 'payout_already_open';
  end if;
  select * into pm from public.creator_payout_methods where creator_id = v_uid and is_default;
  if not found then raise exception 'payout_method_missing'; end if;

  perform public.release_matured_earnings(v_uid);
  select array_agg(id), coalesce(sum(amount), 0) into v_ids, v_amount
  from (select id, amount from public.earnings
        where creator_id = v_uid and status = 'available' and payout_request_id is null for update) e;
  if v_amount < public.setting_int('min_payout_idr') then raise exception 'payout_below_minimum'; end if;

  v_bpct := public.tier_bonus_pct(coalesce(v_tier, 'new'));
  v_bonus := round(v_amount * v_bpct / 100);
  v_pct := greatest(0, least(100, private.setting_num('creator_fee_pct', 18)));
  v_fee := least(round(v_amount * v_pct / 100)::bigint + private.setting_num('withdrawal_fee_idr', 10000)::bigint, v_amount - 1);

  insert into public.payout_requests (creator_id, amount, fee, fee_pct, fee_tier, bonus, bonus_pct, idempotency_key, payout_method)
  values (v_uid, v_amount, v_fee, v_pct, coalesce(v_tier, 'new'), v_bonus, v_bpct, p_idempotency_key, jsonb_build_object(
    'kind', pm.kind, 'provider', pm.provider, 'account_name', pm.account_name, 'account_number', pm.account_number))
  returning * into r;
  update public.earnings set payout_request_id = r.id where id = any(v_ids);

  perform public.write_audit('payout.request', 'payout_request', r.id, null,
    jsonb_build_object('amount', v_amount, 'fee', v_fee, 'fee_pct', v_pct, 'bonus', v_bonus, 'tier', v_tier, 'net', v_amount + v_bonus - v_fee));
  return r;
end $$;
revoke execute on function public.request_payout(uuid) from public, anon;
grant execute on function public.request_payout(uuid) to authenticated;
