-- Finance and ops for the admin:
--   1. brand_ledger: brand deposits (with the 18% service fee) and refunds (11% fee on unspent budget), each with an invoice number.
--   2. admin_refund_preview / admin_refund_campaign: refund the unspent budget and close the campaign.
--   3. admin_finance_monthly: per-month recap of deposits, fees, creator earnings, withdrawals and refunds.
--   4. Payout reminder: email the admins when a withdrawal has waited more than 24 hours.
--   5. Uptime check: probe the site and the mailer every 5 minutes, email the admins when one goes down or comes back.

set search_path = public, extensions;

insert into public.app_settings (key, value) values ('refund_fee_pct', '11'::jsonb) on conflict (key) do nothing;

-- ─────────────────────────────── 1. Ledger ───────────────────────────────
create sequence if not exists private.invoice_seq;

create table if not exists public.brand_ledger (
  id          uuid primary key default gen_random_uuid(),
  brand_id    uuid not null references public.brands(id) on delete restrict,
  campaign_id uuid references public.campaigns(id) on delete set null,
  kind        text not null check (kind in ('deposit', 'refund')),
  amount      bigint not null check (amount > 0),        -- deposit: money received; refund: unspent budget before the fee
  fee_pct     numeric(5,2) not null check (fee_pct >= 0 and fee_pct < 100),
  fee         bigint not null check (fee >= 0),
  net         bigint not null check (net >= 0),           -- deposit: campaign budget; refund: money sent back
  invoice_no  text not null unique,
  reference   text,
  note        text,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists brand_ledger_brand_idx on public.brand_ledger (brand_id, created_at desc);
create index if not exists brand_ledger_campaign_idx on public.brand_ledger (campaign_id);
create index if not exists brand_ledger_created_by_idx on public.brand_ledger (created_by);
alter table public.brand_ledger enable row level security;
revoke all on public.brand_ledger from public, anon, authenticated;
grant select on public.brand_ledger to authenticated;
drop policy if exists brand_ledger_admin on public.brand_ledger;
create policy brand_ledger_admin on public.brand_ledger for select to authenticated using (public.is_admin());

create or replace function private.next_invoice_no(p_prefix text) returns text
language sql volatile set search_path = pg_catalog as $$
  select p_prefix || '-TAPP-' || to_char(now() at time zone 'Asia/Jakarta', 'YYYYMM') || '-' || lpad(nextval('private.invoice_seq')::text, 4, '0')
$$;

create or replace view public.admin_brand_ledger with (security_invoker = true) as
select l.*, b.name as brand_name, c.title as campaign_title
from public.brand_ledger l join public.brands b on b.id = l.brand_id left join public.campaigns c on c.id = l.campaign_id;
grant select on public.admin_brand_ledger to authenticated;

-- A deposit is a record for invoices and the recap; the campaign budget itself is still set from the campaign's budget card.
create or replace function public.admin_record_deposit(p_brand_id uuid, p_campaign_id uuid, p_amount bigint, p_reference text, p_note text)
returns public.brand_ledger
language plpgsql security definer set search_path = public, extensions as $$
declare v_admin uuid := public.assert_admin(); v_pct numeric; v_fee bigint; r public.brand_ledger;
begin
  if coalesce(p_amount, 0) <= 0 then raise exception 'amount_required'; end if;
  if not exists (select 1 from public.brands where id = p_brand_id) then raise exception 'brand_not_found'; end if;
  if p_campaign_id is not null and not exists (select 1 from public.campaigns where id = p_campaign_id and brand_id = p_brand_id) then
    raise exception 'campaign_not_found';
  end if;
  select pr.budget_fee_pct into v_pct from public.campaign_pricing pr where pr.campaign_id = p_campaign_id;
  v_pct := coalesce(v_pct, (select (value #>> '{}')::numeric from public.app_settings where key = 'budget_fee_pct'), 0);
  v_fee := round(p_amount * v_pct / 100);
  insert into public.brand_ledger (brand_id, campaign_id, kind, amount, fee_pct, fee, net, invoice_no, reference, note, created_by)
  values (p_brand_id, p_campaign_id, 'deposit', p_amount, v_pct, v_fee, p_amount - v_fee, private.next_invoice_no('INV'),
          nullif(btrim(p_reference), ''), nullif(btrim(p_note), ''), v_admin)
  returning * into r;
  perform public.write_audit('ledger.deposit', 'brand', p_brand_id, null, to_jsonb(r));
  return r;
end $$;

-- ─────────────────────────────── 2. Refund ───────────────────────────────
-- Unspent budget = the campaign budget (deposit after the service fee) minus what approved clips used.
-- Normal refund: 11% fee on that. TAPP's fault: the whole unspent deposit, service fee included, with no fee.
create or replace function public.admin_refund_preview(p_campaign_id uuid, p_tapp_fault boolean default false)
returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare v_admin uuid := public.assert_admin(); c public.campaigns; pr public.campaign_pricing; v_spent bigint; v_left bigint; v_base bigint;
  v_pct numeric; v_fee bigint; v_pending int;
begin
  select * into c from public.campaigns where id = p_campaign_id;
  if not found then raise exception 'campaign_not_found'; end if;
  select * into pr from public.campaign_pricing where campaign_id = c.id;
  if not found then raise exception 'pricing_not_found'; end if;
  v_spent := private.brand_amount(c.earned, private.spend_share(pr.creator_share_pct, pr.budget_fee_pct));
  v_left := greatest(pr.brand_budget - v_spent, 0);                                -- unspent deposit
  v_base := case when p_tapp_fault then v_left else floor(v_left * (100 - coalesce(pr.budget_fee_pct, 0)) / 100)::bigint end;
  v_pct := case when p_tapp_fault then 0 else coalesce((select (value #>> '{}')::numeric from public.app_settings where key = 'refund_fee_pct'), 11) end;
  v_fee := round(v_base * v_pct / 100);
  select count(*) into v_pending from public.submissions where campaign_id = c.id and status in ('pending_review', 'flagged');
  return jsonb_build_object('deposit', pr.brand_budget, 'spent', v_spent, 'unspent_deposit', v_left, 'base', v_base,
    'fee_pct', v_pct, 'fee', v_fee, 'net', v_base - v_fee, 'pending_reviews', v_pending, 'status', c.status,
    'already_refunded', exists (select 1 from public.brand_ledger where campaign_id = c.id and kind = 'refund'));
end $$;

create or replace function public.admin_refund_campaign(p_campaign_id uuid, p_tapp_fault boolean, p_reference text, p_note text)
returns public.brand_ledger
language plpgsql security definer set search_path = public, extensions as $$
declare v_admin uuid := public.assert_admin(); c public.campaigns; pr public.campaign_pricing; v jsonb; v_ss numeric; r public.brand_ledger;
begin
  select * into c from public.campaigns where id = p_campaign_id for update;
  if not found then raise exception 'campaign_not_found'; end if;
  select * into pr from public.campaign_pricing where campaign_id = c.id for update;
  v := public.admin_refund_preview(c.id, coalesce(p_tapp_fault, false));
  if (v->>'already_refunded')::boolean then raise exception 'already_refunded'; end if;
  if (v->>'pending_reviews')::int > 0 then raise exception 'refund_has_pending_reviews'; end if;
  if (v->>'base')::bigint <= 0 then raise exception 'nothing_to_refund'; end if;
  insert into public.brand_ledger (brand_id, campaign_id, kind, amount, fee_pct, fee, net, invoice_no, reference, note, created_by)
  values (c.brand_id, c.id, 'refund', (v->>'base')::bigint, (v->>'fee_pct')::numeric, (v->>'fee')::bigint, (v->>'net')::bigint,
          private.next_invoice_no('RF'), nullif(btrim(p_reference), ''), nullif(btrim(p_note), ''), v_admin)
  returning * into r;
  -- Shrink the budget to what was used, so nothing more is paid and the brand sees no budget left.
  v_ss := private.spend_share(pr.creator_share_pct, pr.budget_fee_pct);
  update public.campaign_pricing set brand_budget = greatest(ceil(c.earned * 100.0 / v_ss)::bigint, 2) where campaign_id = c.id;
  update public.campaigns set budget_override = false, status = 'completed', status_reason = 'refunded' where id = c.id;
  perform public.write_audit('ledger.refund', 'campaign', c.id, jsonb_build_object('brand_budget', pr.brand_budget, 'status', c.status), to_jsonb(r));
  return r;
end $$;

-- ─────────────────────────────── 3. Monthly recap ───────────────────────────────
create or replace function public.admin_finance_monthly(p_months integer default 12)
returns table (month date, deposits bigint, service_fees bigint, creator_gross bigint, creator_fees bigint, creator_net bigint,
               withdrawals_paid bigint, withdrawal_fees bigint, bonuses bigint, refunds bigint, refund_fees bigint, refunds_paid bigint)
language plpgsql stable security definer set search_path = public, extensions as $$
#variable_conflict use_column
declare v_admin uuid := public.assert_admin();
begin
  return query
  with m as (
    select generate_series(date_trunc('month', (now() at time zone 'Asia/Jakarta')) - make_interval(months => greatest(least(p_months, 60), 1) - 1),
                           date_trunc('month', (now() at time zone 'Asia/Jakarta')), interval '1 month')::date as month
  ), l as (
    select date_trunc('month', created_at at time zone 'Asia/Jakarta')::date as month,
      sum(amount) filter (where kind = 'deposit') as dep, sum(fee) filter (where kind = 'deposit') as dep_fee,
      sum(amount) filter (where kind = 'refund') as ref, sum(fee) filter (where kind = 'refund') as ref_fee, sum(net) filter (where kind = 'refund') as ref_net
    from public.brand_ledger group by 1
  ), e as (
    select date_trunc('month', x.created_at at time zone 'Asia/Jakarta')::date as month, sum(x.amount) as net,
      sum(round(x.amount * 100.0 / coalesce(nullif(pr.creator_share_pct, 0), 100))) as gross
    from public.earnings x left join public.campaign_pricing pr on pr.campaign_id = x.campaign_id
    where x.status <> 'reversed' group by 1
  ), p as (
    select date_trunc('month', paid_at at time zone 'Asia/Jakarta')::date as month, sum(net_amount) as paid, sum(fee) as fee,
      sum(coalesce(bonus, 0) + coalesce(referral_bonus, 0)) as bonus
    from public.payout_requests where status = 'paid' and paid_at is not null group by 1
  )
  select m.month, coalesce(l.dep, 0)::bigint, coalesce(l.dep_fee, 0)::bigint, coalesce(e.gross, 0)::bigint,
    (coalesce(e.gross, 0) - coalesce(e.net, 0))::bigint, coalesce(e.net, 0)::bigint,
    coalesce(p.paid, 0)::bigint, coalesce(p.fee, 0)::bigint, coalesce(p.bonus, 0)::bigint,
    coalesce(l.ref, 0)::bigint, coalesce(l.ref_fee, 0)::bigint, coalesce(l.ref_net, 0)::bigint
  from m left join l using (month) left join e using (month) left join p using (month)
  order by m.month desc;
end $$;

revoke execute on function public.admin_record_deposit(uuid, uuid, bigint, text, text), public.admin_refund_preview(uuid, boolean),
  public.admin_refund_campaign(uuid, boolean, text, text), public.admin_finance_monthly(integer) from public, anon;
grant execute on function public.admin_record_deposit(uuid, uuid, bigint, text, text), public.admin_refund_preview(uuid, boolean),
  public.admin_refund_campaign(uuid, boolean, text, text), public.admin_finance_monthly(integer) to authenticated;

-- ─────────────────────────────── 4. Payout reminder ───────────────────────────────
alter table public.payout_requests add column if not exists overdue_alerted_at timestamptz;

create or replace function private.payout_overdue_sweep() returns integer
language plpgsql security definer set search_path = public, extensions as $$
declare v_n int; v_total bigint; v_oldest timestamptz; v_admin text;
begin
  select count(*), coalesce(sum(amount), 0), min(created_at) into v_n, v_total, v_oldest
  from public.payout_requests
  where status in ('requested', 'reviewing', 'approved', 'processing') and created_at < now() - interval '24 hours' and overdue_alerted_at is null;
  if v_n = 0 then return 0; end if;
  for v_admin in select x from public.app_settings s, jsonb_array_elements_text(s.value) x where s.key = 'admin_emails' loop
    perform public.send_app_email('payout_overdue', v_admin,
      jsonb_build_object('count', v_n, 'total', v_total, 'oldest', v_oldest),
      'payout_overdue:' || to_char(now(), 'YYYYMMDDHH24') || ':' || v_admin);
  end loop;
  update public.payout_requests set overdue_alerted_at = now()
  where status in ('requested', 'reviewing', 'approved', 'processing') and created_at < now() - interval '24 hours' and overdue_alerted_at is null;
  return v_n;
end $$;
revoke execute on function private.payout_overdue_sweep() from public, anon, authenticated;

-- ─────────────────────────────── 5. Uptime ───────────────────────────────
create table if not exists public.uptime_checks (
  id          bigint generated always as identity primary key,
  target      text not null check (target in ('site', 'mailer')),
  request_id  bigint,
  status_code integer,
  ok          boolean,
  created_at  timestamptz not null default now()
);
create index if not exists uptime_checks_target_idx on public.uptime_checks (target, created_at desc);
alter table public.uptime_checks enable row level security;
revoke all on public.uptime_checks from public, anon, authenticated;
grant select on public.uptime_checks to authenticated;
drop policy if exists uptime_checks_admin on public.uptime_checks;
create policy uptime_checks_admin on public.uptime_checks for select to authenticated using (public.is_admin());

create table if not exists private.uptime_state (
  target text primary key, down boolean not null default false, since timestamptz not null default now()
);

create or replace function private.uptime_sweep() returns void
language plpgsql security definer set search_path = public, extensions as $$
declare r record; v_code int; v_err text; v_found boolean; v_down boolean; v_was boolean; v_url text; v_id bigint; v_admin text;
begin
  if to_regproc('net.http_get') is null then return; end if;
  -- 1. Resolve earlier probes from pg_net's response table.
  for r in select * from public.uptime_checks where ok is null and request_id is not null loop
    execute 'select true, status_code, error_msg from net._http_response where id = $1' into v_found, v_code, v_err using r.request_id;
    if coalesce(v_found, false) then
      update public.uptime_checks set status_code = v_code, ok = (v_code between 200 and 399 and v_err is null) where id = r.id;
    elsif r.created_at < now() - interval '2 minutes' then
      update public.uptime_checks set ok = false where id = r.id;
    end if;
  end loop;
  -- 2. Down = the last two resolved probes failed; up = the last one passed. Email the admins on each change.
  for r in select t.target from (values ('site'), ('mailer')) t(target) loop
    select bool_and(not ok) and count(*) = 2 into v_down
    from (select ok from public.uptime_checks where target = r.target and ok is not null order by created_at desc limit 2) x;
    if v_down is null then continue; end if;
    if not v_down and exists (select 1 from (select ok from public.uptime_checks where target = r.target and ok is not null order by created_at desc limit 1) y where not y.ok) then
      continue;   -- a single failure: wait for the next probe
    end if;
    select down into v_was from private.uptime_state where target = r.target;
    if v_was is distinct from v_down then
      insert into private.uptime_state (target, down, since) values (r.target, v_down, now())
      on conflict (target) do update set down = excluded.down, since = excluded.since;
      if v_was is not null then
        for v_admin in select x from public.app_settings s, jsonb_array_elements_text(s.value) x where s.key = 'admin_emails' loop
          perform public.send_app_email(case when v_down then 'uptime_down' else 'uptime_up' end, v_admin,
            jsonb_build_object('target', r.target, 'at', now()),
            'uptime:' || r.target || ':' || v_down || ':' || to_char(now(), 'YYYYMMDDHH24MI') || ':' || v_admin);
        end loop;
        insert into public.notifications (user_id, type, title, body, data)
        select p.id, 'ops_uptime', case when v_down then 'Layanan down: ' else 'Layanan normal lagi: ' end || r.target,
          case when v_down then 'Dua pengecekan berturut-turut gagal.' else 'Pengecekan terakhir berhasil.' end, jsonb_build_object('target', r.target)
        from public.profiles p where p.role = 'admin';
      end if;
    end if;
  end loop;
  -- 3. New probes.
  for r in select t.target, t.key from (values ('site', 'app_url'), ('mailer', 'mailer_url')) t(target, key) loop
    select value #>> '{}' into v_url from public.app_settings where key = r.key;
    if v_url is null then continue; end if;
    begin
      execute 'select net.http_get(url := $1, timeout_milliseconds := 10000)' into v_id using rtrim(v_url, '/') || '/';
      insert into public.uptime_checks (target, request_id) values (r.target, v_id);
    exception when others then null;
    end;
  end loop;
  delete from public.uptime_checks where created_at < now() - interval '7 days';
end $$;
revoke execute on function private.uptime_sweep() from public, anon, authenticated;

do $$
begin
  if to_regclass('cron.job') is null then return; end if;
  execute $cmd$ select cron.unschedule(jobid) from cron.job where jobname in ('payout-overdue', 'uptime-check') $cmd$;
  execute $cmd$ select cron.schedule('payout-overdue', '23 * * * *', 'select private.payout_overdue_sweep()') $cmd$;
  execute $cmd$ select cron.schedule('uptime-check', '*/5 * * * *', 'select private.uptime_sweep()') $cmd$;
end $$;
