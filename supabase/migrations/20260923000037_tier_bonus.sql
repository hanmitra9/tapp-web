-- TAPP · 0037 · Level bonus: higher level, higher rate.
--
-- Each payment gets a bonus on top of the clip's pay, by the creator's level when paid
-- (app_settings.tier_bonus_pct, default New 0%, Rising 2%, Verified 5%, Proven 10%, Elite 15%).
-- The bonus is paid by TAPP: the campaign budget and the brand report still carry only the clip's pay.
-- payout_requests.net_amount (what is transferred) becomes amount + bonus − fee.

set search_path = public, extensions;

insert into public.app_settings (key, value)
values ('tier_bonus_pct', '{"new": 0, "rising": 2, "verified": 5, "proven": 10, "elite": 15}'::jsonb)
on conflict (key) do nothing;

drop policy if exists app_settings_read on public.app_settings;
create policy app_settings_read on public.app_settings for select to authenticated
  using (key in ('earnings_hold_days','min_payout_idr','max_submissions_per_day','publish_grace_minutes','view_milestones',
                 'platform_oauth_config','withdrawal_fee_pct','tier_bonus_pct'));

create or replace function public.tier_bonus_pct(p_tier public.creator_tier) returns numeric
language sql stable security definer set search_path = public, extensions as $$
  select greatest(0, least(100, coalesce(
    (select (value ->> p_tier::text)::numeric from public.app_settings where key = 'tier_bonus_pct'), 0)))
$$;
grant execute on function public.tier_bonus_pct(public.creator_tier) to authenticated;

-- net_amount is a generated column: views that read it go first, then it is redefined.
drop view if exists public.my_payments;
drop view if exists public.admin_payouts;
alter table public.payout_requests
  add column if not exists bonus     bigint not null default 0,
  add column if not exists bonus_pct numeric(5,2) not null default 0;
alter table public.payout_requests drop constraint if exists payout_bonus_range;
alter table public.payout_requests add constraint payout_bonus_range check (bonus >= 0 and bonus_pct between 0 and 100);
alter table public.payout_requests drop column if exists net_amount;
alter table public.payout_requests add column net_amount bigint generated always as (amount + bonus - fee) stored;

create view public.admin_payouts with (security_invoker = true) as
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
  p.fee, p.fee_pct, p.fee_tier, p.net_amount, p.bonus, p.bonus_pct
from public.payout_requests p
left join public.profiles pr on pr.id = p.creator_id
left join public.creator_profiles cp on cp.user_id = p.creator_id;
grant select on public.admin_payouts to authenticated;

create view public.my_payments with (security_invoker = true) as
select p.id, p.submission_id, p.amount, p.fee, p.net_amount, p.status, p.processed_reference, p.paid_at, p.created_at,
  p.payout_method->>'provider' as provider, right(coalesce(p.payout_method->>'account_number', ''), 4) as account_last4,
  s.post_url, s.platform, s.qualified_views, c.id as campaign_id, c.title as campaign_title, p.bonus
from public.payout_requests p
left join public.submissions s on s.id = p.submission_id
left join public.campaigns c on c.id = s.campaign_id
where p.creator_id = auth.uid() and p.status = 'paid';
grant select on public.my_payments to authenticated;

create or replace function public.admin_pay_submission(
  p_submission_id uuid, p_views bigint, p_reference text, p_note text default null
) returns public.payout_requests
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_admin uuid := public.assert_admin(); s public.submissions; m public.content_metrics; pm public.creator_payout_methods;
  v_tier public.creator_tier; v_ids uuid[]; v_amount bigint; v_pct numeric; v_fee bigint; v_bpct numeric; v_bonus bigint; r public.payout_requests;
begin
  if nullif(btrim(p_reference), '') is null then raise exception 'reference_required'; end if;
  if p_views is null or p_views < 0 then raise exception 'invalid_views'; end if;
  select * into s from public.submissions where id = p_submission_id for update;
  if not found then raise exception 'submission_not_found'; end if;
  if s.status not in ('approved', 'tracking', 'completed') then raise exception 'submission_not_payable:%', s.status; end if;
  if p_views < s.qualified_views then raise exception 'views_below_paid:%', s.qualified_views; end if;
  select * into pm from public.creator_payout_methods where creator_id = s.creator_id and is_default;
  if not found then raise exception 'payout_method_missing'; end if;
  if exists (select 1 from public.payout_requests where creator_id = s.creator_id and status in ('requested','reviewing','approved','processing')) then
    raise exception 'payout_already_open';
  end if;

  if s.status = 'completed' then update public.submissions set status = 'tracking' where id = s.id; end if;
  m := public.admin_record_metrics(s.id, p_views);
  perform private.qualify_views(s.id, m.id, p_views, coalesce(nullif(btrim(p_note), ''), 'Dibayar admin'), false, v_admin);

  select array_agg(id), coalesce(sum(amount), 0) into v_ids, v_amount
  from (select id, amount from public.earnings where submission_id = s.id and payout_request_id is null and status in ('pending','available') for update) e;
  if v_amount <= 0 then raise exception 'nothing_to_pay'; end if;

  select tier into v_tier from public.creator_profiles where user_id = s.creator_id;
  v_pct := public.withdrawal_fee_pct(coalesce(v_tier, 'new'));
  v_fee := least(round(v_amount * v_pct / 100), v_amount - 1);
  v_bpct := public.tier_bonus_pct(coalesce(v_tier, 'new'));
  v_bonus := round(v_amount * v_bpct / 100);   -- paid by TAPP on top; the campaign budget only carries v_amount

  insert into public.payout_requests (creator_id, submission_id, amount, fee, fee_pct, fee_tier, bonus, bonus_pct, status, idempotency_key, payout_method, reviewed_by, reviewed_at)
  values (s.creator_id, s.id, v_amount, v_fee, v_pct, coalesce(v_tier, 'new'), v_bonus, v_bpct, 'processing', gen_random_uuid(), jsonb_build_object(
    'kind', pm.kind, 'provider', pm.provider, 'account_name', pm.account_name, 'account_number', pm.account_number), v_admin, now())
  returning * into r;
  update public.earnings set status = 'available', available_at = least(available_at, now()), payout_request_id = r.id where id = any(v_ids);

  -- processing → paid: marks earnings paid, adds to campaign.paid, notifies and emails the creator.
  r := public.admin_update_payout(r.id, 'paid', null, p_reference);
  update public.submissions set status = 'completed' where id = s.id;

  perform public.write_audit('submission.paid', 'submission', s.id, null,
    jsonb_build_object('payout_id', r.id, 'views', p_views, 'amount', v_amount, 'fee', v_fee, 'bonus', v_bonus, 'net', v_amount + v_bonus - v_fee, 'reference', p_reference));
  return r;
end $$;

-- Payout email: amount = what was transferred, with the bonus and fee shown.
create or replace function public.ev_payout_email() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare v_email text; v_method text;
begin
  if new.status is not distinct from old.status or new.status not in ('paid', 'rejected') then return null; end if;
  select email into v_email from auth.users where id = new.creator_id;
  v_method := concat_ws(' ', new.payout_method->>'provider', case when coalesce(new.payout_method->>'account_number', '') <> '' then '••••' || right(new.payout_method->>'account_number', 4) end);
  if new.status = 'paid' then
    perform public.send_app_email('payout_paid', v_email, jsonb_build_object('amount', new.net_amount, 'gross', new.amount, 'fee', new.fee, 'bonus', new.bonus,
      'method', nullif(v_method, ''), 'reference', new.processed_reference), 'payout:' || new.id || ':paid');
  else
    perform public.send_app_email('payout_rejected', v_email, jsonb_build_object('amount', new.amount, 'reason', new.review_reason), 'payout:' || new.id || ':rejected');
  end if;
  return null;
end $$;
