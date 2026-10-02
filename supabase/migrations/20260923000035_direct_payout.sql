-- TAPP · 0035 · Simple flow: creator submits → TAPP admin accepts → TAPP admin pays that clip directly.
--
-- No wallet any more: creators don't hold a balance or request withdrawals. When the admin pays a clip they enter
-- its views; the server computes the amount with the usual rules (CPM, minimum views, cap per clip, budget), applies
-- the level fee (0034), records a paid payout to the creator's default payout method and closes the clip
-- (status 'completed'). Paying a completed clip again only pays the difference if its views grew.
-- The ledger stays the same (metrics → snapshot → earnings → payout), so brand reports and budgets keep working.

set search_path = public, extensions;

-- Payments are decided by a person now, never automatically.
update public.app_settings set value = jsonb_set(value, '{enabled}', 'false'::jsonb), updated_at = now() where key = 'auto_qualify';

alter table public.payout_requests add column if not exists submission_id uuid references public.submissions(id) on delete restrict;
create index if not exists payout_requests_submission_idx on public.payout_requests(submission_id) where submission_id is not null;

create or replace function public.admin_pay_submission(
  p_submission_id uuid, p_views bigint, p_reference text, p_note text default null
) returns public.payout_requests
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_admin uuid := public.assert_admin(); s public.submissions; m public.content_metrics; pm public.creator_payout_methods;
  v_tier public.creator_tier; v_ids uuid[]; v_amount bigint; v_pct numeric; v_fee bigint; r public.payout_requests;
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

  insert into public.payout_requests (creator_id, submission_id, amount, fee, fee_pct, fee_tier, status, idempotency_key, payout_method, reviewed_by, reviewed_at)
  values (s.creator_id, s.id, v_amount, v_fee, v_pct, coalesce(v_tier, 'new'), 'processing', gen_random_uuid(), jsonb_build_object(
    'kind', pm.kind, 'provider', pm.provider, 'account_name', pm.account_name, 'account_number', pm.account_number), v_admin, now())
  returning * into r;
  update public.earnings set status = 'available', available_at = least(available_at, now()), payout_request_id = r.id where id = any(v_ids);

  -- processing → paid: marks earnings paid, adds to campaign.paid, notifies and emails the creator.
  r := public.admin_update_payout(r.id, 'paid', null, p_reference);
  update public.submissions set status = 'completed' where id = s.id;

  perform public.write_audit('submission.paid', 'submission', s.id, null,
    jsonb_build_object('payout_id', r.id, 'views', p_views, 'amount', v_amount, 'fee', v_fee, 'net', v_amount - v_fee, 'reference', p_reference));
  return r;
end $$;
revoke execute on function public.admin_pay_submission(uuid, bigint, text, text) from public, anon;
grant execute on function public.admin_pay_submission(uuid, bigint, text, text) to authenticated;

-- Creators no longer request withdrawals themselves.
create or replace function public.request_payout(p_idempotency_key uuid) returns public.payout_requests
language plpgsql security definer set search_path = public, extensions as $$
begin
  raise exception 'payout_by_admin';
end $$;

-- Creator's own payments, one row per paid clip (newest first).
create or replace view public.my_payments with (security_invoker = true) as
select p.id, p.submission_id, p.amount, p.fee, p.net_amount, p.status, p.processed_reference, p.paid_at, p.created_at,
  p.payout_method->>'provider' as provider, right(coalesce(p.payout_method->>'account_number', ''), 4) as account_last4,
  s.post_url, s.platform, s.qualified_views, c.id as campaign_id, c.title as campaign_title
from public.payout_requests p
left join public.submissions s on s.id = p.submission_id
left join public.campaigns c on c.id = s.campaign_id
where p.creator_id = auth.uid() and p.status = 'paid';
grant select on public.my_payments to authenticated;
