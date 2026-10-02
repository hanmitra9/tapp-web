-- TAPP · 0034 · Withdrawal fee by creator level: the higher the level, the smaller the fee.
--
-- The fee is a percentage of the payout, set per tier in app_settings.withdrawal_fee_pct (default New 5%,
-- Rising 4%, Verified 3%, Proven 2%, Elite 0%). It is fixed when the creator requests the payout (their tier at
-- that moment) and stored on the request: amount = earnings withdrawn, fee = TAPP's cut, net_amount = what is
-- transferred. Earnings rows are untouched — the whole amount still leaves the creator's balance.

set search_path = public, extensions;

insert into public.app_settings (key, value)
values ('withdrawal_fee_pct', '{"new": 5, "rising": 4, "verified": 3, "proven": 2, "elite": 0}'::jsonb)
on conflict (key) do nothing;

-- Creators read the fee table (shown on the payout screen and the level arc).
drop policy if exists app_settings_read on public.app_settings;
create policy app_settings_read on public.app_settings for select to authenticated
  using (key in ('earnings_hold_days','min_payout_idr','max_submissions_per_day','publish_grace_minutes','view_milestones',
                 'platform_oauth_config','withdrawal_fee_pct'));

alter table public.payout_requests
  add column if not exists fee        bigint not null default 0,
  add column if not exists fee_pct    numeric(5,2) not null default 0,
  add column if not exists fee_tier   public.creator_tier;
alter table public.payout_requests add column if not exists net_amount bigint generated always as (amount - fee) stored;
alter table public.payout_requests drop constraint if exists payout_fee_range;
alter table public.payout_requests add constraint payout_fee_range check (fee >= 0 and fee < amount and fee_pct between 0 and 100);

create or replace function public.withdrawal_fee_pct(p_tier public.creator_tier) returns numeric
language sql stable security definer set search_path = public, extensions as $$
  select greatest(0, least(100, coalesce(
    (select (value ->> p_tier::text)::numeric from public.app_settings where key = 'withdrawal_fee_pct'), 0)))
$$;
grant execute on function public.withdrawal_fee_pct(public.creator_tier) to authenticated;

create or replace function public.request_payout(p_idempotency_key uuid) returns public.payout_requests
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_uid uuid := auth.uid(); v_status public.creator_status; v_tier public.creator_tier; r public.payout_requests;
  v_ids uuid[]; v_amount bigint; v_pct numeric; v_fee bigint; pm public.creator_payout_methods;
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

  v_pct := public.withdrawal_fee_pct(coalesce(v_tier, 'new'));
  v_fee := round(v_amount * v_pct / 100);

  insert into public.payout_requests (creator_id, amount, fee, fee_pct, fee_tier, idempotency_key, payout_method)
  values (v_uid, v_amount, v_fee, v_pct, coalesce(v_tier, 'new'), p_idempotency_key, jsonb_build_object(
    'kind', pm.kind, 'provider', pm.provider, 'account_name', pm.account_name, 'account_number', pm.account_number))
  returning * into r;
  update public.earnings set payout_request_id = r.id where id = any(v_ids);

  perform public.write_audit('payout.request', 'payout_request', r.id, null,
    jsonb_build_object('amount', v_amount, 'fee', v_fee, 'fee_pct', v_pct, 'tier', v_tier, 'net', v_amount - v_fee));
  return r;
end $$;

-- Admin list shows what to transfer (net) next to the gross amount and the fee.
create or replace view public.admin_payouts with (security_invoker = true) as
select p.id, p.creator_id, p.amount, p.status, p.payout_method, p.review_reason, p.reviewed_at, p.processed_reference,
  p.paid_at, p.created_at, p.updated_at,
  pr.full_name as creator_name, pr.username as creator_username, cp.status as creator_status,
  (select count(*) from public.earnings e where e.payout_request_id = p.id) as earning_rows,
  (select count(*) from public.submissions s where s.creator_id = p.creator_id and s.status = 'flagged') as creator_flagged,
  (select count(*) from public.disputes d where d.raised_by = p.creator_id and d.status in ('open','under_review')) as creator_open_disputes,
  (select coalesce(sum(x.amount), 0) from public.payout_requests x where x.creator_id = p.creator_id and x.status = 'paid') as creator_paid_total,
  (select coalesce(sum(e.amount), 0) from public.earnings e where e.payout_request_id = p.id) = p.amount as ledger_matches,
  exists (select 1 from public.audit_logs a where a.entity_type = 'creator_payout_methods' and a.action = 'creator_payout_methods.update'
          and a.actor_id = p.creator_id and a.created_at between p.created_at - interval '72 hours' and p.created_at) as method_changed_recently,
  p.fee, p.fee_pct, p.fee_tier, p.net_amount
from public.payout_requests p
left join public.profiles pr on pr.id = p.creator_id
left join public.creator_profiles cp on cp.user_id = p.creator_id;

-- Payout emails show what actually arrives.
create or replace function public.ev_payout_email() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare v_email text; v_method text;
begin
  if new.status is not distinct from old.status or new.status not in ('paid', 'rejected') then return null; end if;
  select email into v_email from auth.users where id = new.creator_id;
  v_method := concat_ws(' ', new.payout_method->>'provider', case when coalesce(new.payout_method->>'account_number', '') <> '' then '••••' || right(new.payout_method->>'account_number', 4) end);
  if new.status = 'paid' then
    perform public.send_app_email('payout_paid', v_email, jsonb_build_object('amount', new.net_amount, 'gross', new.amount, 'fee', new.fee,
      'method', nullif(v_method, ''), 'reference', new.processed_reference), 'payout:' || new.id || ':paid');
  else
    perform public.send_app_email('payout_rejected', v_email, jsonb_build_object('amount', new.amount, 'reason', new.review_reason), 'payout:' || new.id || ':rejected');
  end if;
  return null;
end $$;
