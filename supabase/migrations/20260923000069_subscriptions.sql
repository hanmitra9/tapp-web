-- TAPP · 0069 · Monthly subscriptions: a brand pays a fixed amount every 30 days for guaranteed qualified views.
--
-- Price: Rp1.500 per 1.000 views, all in. Each payment is a ledger deposit (0068) with the usual 18% service fee; the creator
-- keeps 80% of the rest, so the creator rate is Rp984 / 1.000 views and TAPP keeps 34.4%. Clipping campaigns only.
-- One campaign per subscription: every payment adds its amount to the campaign budget and its views to the target.
--
-- Guarantee: views not delivered roll over (the campaign keeps running). Views still missing 60 days after the period
-- started are refunded without any fee when the subscription ends; the rest of the unspent budget follows the normal
-- refund rule (11%).
-- Pacing: new clips are accepted while spending is within the day's share of the period, so views arrive through the month.
-- Billing: email the brand 3 days before the due date; 3 days after it, an unpaid subscription pauses its campaign.

set search_path = public, extensions;

-- ─────────────────────────────── tables ───────────────────────────────
create table if not exists public.subscription_plans (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique check (btrim(name) <> ''),
  monthly_price bigint not null check (monthly_price >= 10000),
  price_per_1k  bigint not null default 1500 check (price_per_1k > 0),
  active        boolean not null default true,
  sort          integer not null default 0,
  created_at    timestamptz not null default now()
);
insert into public.subscription_plans (name, monthly_price, price_per_1k, sort) values
  ('Starter', 500000, 1500, 1), ('Growth', 2500000, 1500, 2), ('Scale', 7500000, 1500, 3)
on conflict (name) do nothing;

create table if not exists public.brand_subscriptions (
  id            uuid primary key default gen_random_uuid(),
  brand_id      uuid not null references public.brands(id) on delete restrict,
  campaign_id   uuid not null unique references public.campaigns(id) on delete restrict,
  plan_id       uuid references public.subscription_plans(id) on delete set null,
  plan_name     text not null,
  monthly_price bigint not null check (monthly_price > 0),
  price_per_1k  bigint not null check (price_per_1k > 0),
  status        text not null default 'pending' check (status in ('pending', 'active', 'past_due', 'cancelled')),
  next_bill_at  date,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  cancelled_at  timestamptz
);
create index if not exists brand_subscriptions_brand_idx on public.brand_subscriptions (brand_id);
create index if not exists brand_subscriptions_plan_idx on public.brand_subscriptions (plan_id);
create index if not exists brand_subscriptions_created_by_idx on public.brand_subscriptions (created_by);

create table if not exists public.subscription_periods (
  id              uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.brand_subscriptions(id) on delete cascade,
  seq             integer not null,
  period_start    date not null,
  period_end      date not null,
  amount          bigint not null check (amount > 0),
  target_views    bigint not null check (target_views > 0),
  earned_start    bigint not null default 0,      -- campaign spend when the period started (pacing baseline)
  ledger_id       uuid references public.brand_ledger(id) on delete set null,
  created_at      timestamptz not null default now(),
  unique (subscription_id, seq)
);
create index if not exists subscription_periods_ledger_idx on public.subscription_periods (ledger_id);

alter table public.subscription_plans enable row level security;
alter table public.brand_subscriptions enable row level security;
alter table public.subscription_periods enable row level security;
revoke all on public.subscription_plans, public.brand_subscriptions, public.subscription_periods from public, anon, authenticated;
grant select on public.subscription_plans, public.brand_subscriptions, public.subscription_periods to authenticated;
drop policy if exists subscription_plans_read on public.subscription_plans;
create policy subscription_plans_read on public.subscription_plans for select to authenticated using (true);
drop policy if exists brand_subscriptions_read on public.brand_subscriptions;
create policy brand_subscriptions_read on public.brand_subscriptions for select to authenticated
  using (public.is_admin() or public.is_brand_member(brand_id));
drop policy if exists subscription_periods_read on public.subscription_periods;
create policy subscription_periods_read on public.subscription_periods for select to authenticated
  using (exists (select 1 from public.brand_subscriptions s where s.id = subscription_id and (public.is_admin() or public.is_brand_member(s.brand_id))));

-- ─────────────────────────────── progress ───────────────────────────────
-- Views delivered = qualified views already paid for. Overdelivery in one period counts toward the next.
create or replace function private.subscription_progress(p_sub_id uuid) returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  with s as (select * from public.brand_subscriptions where id = p_sub_id),
  t as (select (now() at time zone 'Asia/Jakarta')::date as td),
  d as (select coalesce(sum(e.qualified_views_delta), 0)::bigint as delivered
        from public.earnings e, s where e.campaign_id = s.campaign_id and e.status <> 'reversed'),
  p as (select * from public.subscription_periods where subscription_id = p_sub_id),
  cur as (select p.* from p, t order by (p.period_start <= t.td) desc, p.seq desc limit 1)   -- the running period (a prepaid one waits)
  select jsonb_build_object(
    'delivered', d.delivered,
    'target_total', coalesce((select sum(target_views) from p), 0),
    'periods', (select count(*) from p),
    'period_start', cur.period_start, 'period_end', cur.period_end, 'period_target', cur.target_views,
    'period_delivered', greatest(0, least(cur.target_views, d.delivered - coalesce((select sum(target_views) from p where p.seq < cur.seq), 0))),
    'breach_views', greatest(0, coalesce((select sum(p.target_views) from p, t where p.period_start + 60 <= t.td), 0) - d.delivered),
    'expected_now', coalesce((select sum(target_views) from p where p.seq < cur.seq), 0)
       + round(coalesce(cur.target_views, 0) * least(1, greatest(0, (select td from t) - cur.period_start)::numeric / 30))
  )
  from d left join cur on true
$$;
revoke execute on function private.subscription_progress(uuid) from public, anon, authenticated;

create or replace function public.admin_subscriptions_list()
returns table (id uuid, brand_id uuid, brand_name text, campaign_id uuid, campaign_title text, campaign_status public.campaign_status,
               plan_name text, monthly_price bigint, price_per_1k bigint, status text, next_bill_at date, created_at timestamptz, progress jsonb)
language plpgsql stable security definer set search_path = public, extensions as $$
#variable_conflict use_column
declare v_admin uuid := public.assert_admin();
begin
  return query
  select s.id, s.brand_id, b.name, s.campaign_id, c.title, c.status, s.plan_name, s.monthly_price, s.price_per_1k, s.status, s.next_bill_at, s.created_at,
    private.subscription_progress(s.id)
  from public.brand_subscriptions s join public.brands b on b.id = s.brand_id join public.campaigns c on c.id = s.campaign_id
  order by (s.status = 'cancelled'), s.created_at desc;
end $$;

-- Brand dashboard: the brand's own subscriptions with this period's progress.
create or replace function public.brand_subscriptions_summary()
returns table (id uuid, brand_id uuid, campaign_id uuid, campaign_title text, plan_name text, monthly_price bigint, price_per_1k bigint,
               status text, next_bill_at date, progress jsonb)
language sql stable security definer set search_path = public, extensions as $$
  select s.id, s.brand_id, s.campaign_id, c.title, s.plan_name, s.monthly_price, s.price_per_1k, s.status, s.next_bill_at, private.subscription_progress(s.id)
  from public.brand_subscriptions s join public.campaigns c on c.id = s.campaign_id
  where s.status <> 'cancelled' and (public.is_admin() or public.is_brand_member(s.brand_id))
  order by s.created_at desc
$$;

-- ─────────────────────────────── admin actions ───────────────────────────────
create or replace function public.admin_upsert_plan(p_id uuid, p_name text, p_monthly_price bigint, p_price_per_1k bigint, p_active boolean)
returns public.subscription_plans
language plpgsql security definer set search_path = public, extensions as $$
declare v_admin uuid := public.assert_admin(); r public.subscription_plans;
begin
  if nullif(btrim(p_name), '') is null then raise exception 'name_required'; end if;
  if coalesce(p_monthly_price, 0) < 10000 then raise exception 'amount_required'; end if;
  if coalesce(p_price_per_1k, 0) <= 0 then raise exception 'cpm_required'; end if;
  if p_id is null then
    insert into public.subscription_plans (name, monthly_price, price_per_1k, active, sort)
    values (btrim(p_name), p_monthly_price, p_price_per_1k, coalesce(p_active, true), (select coalesce(max(sort), 0) + 1 from public.subscription_plans))
    returning * into r;
  else
    update public.subscription_plans set name = btrim(p_name), monthly_price = p_monthly_price, price_per_1k = p_price_per_1k, active = coalesce(p_active, true)
    where id = p_id returning * into r;
    if not found then raise exception 'plan_not_found'; end if;
  end if;
  perform public.write_audit('subscription.plan', 'subscription_plan', r.id, null, to_jsonb(r));
  return r;
end $$;

-- Turns a draft clipping campaign into a subscription campaign: subscription pricing, no end date, first month's budget.
create or replace function public.admin_create_subscription(p_campaign_id uuid, p_plan_id uuid) returns public.brand_subscriptions
language plpgsql security definer set search_path = public, extensions as $$
declare v_admin uuid := public.assert_admin(); c public.campaigns; pl public.subscription_plans; v_fee numeric; v_share numeric; r public.brand_subscriptions;
begin
  select * into c from public.campaigns where id = p_campaign_id for update;
  if not found then raise exception 'campaign_not_found'; end if;
  if c.status <> 'draft' then raise exception 'subscription_needs_draft'; end if;
  if c.content_type <> 'clipping' then raise exception 'subscription_clipping_only'; end if;
  if exists (select 1 from public.brand_subscriptions where campaign_id = c.id) then raise exception 'already_subscribed'; end if;
  select * into pl from public.subscription_plans where id = p_plan_id and active;
  if not found then raise exception 'plan_not_found'; end if;
  -- Subscription terms are fixed: 18% service fee, creator keeps 80% (TAPP margin 34.4%).
  v_fee := 18;
  v_share := 80;
  -- brand_cpm is per 1.000 views of the budget after the service fee, so the all-in price stays price_per_1k.
  update public.campaign_pricing set brand_cpm = greatest(round(pl.price_per_1k * (100 - v_fee) / 100), 1)::bigint,
    brand_budget = pl.monthly_price, budget_fee_pct = v_fee, creator_share_pct = v_share
  where campaign_id = c.id;
  update public.campaigns set ends_at = null, submission_deadline = null, max_earning_per_submission = null where id = c.id;
  insert into public.brand_subscriptions (brand_id, campaign_id, plan_id, plan_name, monthly_price, price_per_1k, created_by)
  values (c.brand_id, c.id, pl.id, pl.name, pl.monthly_price, pl.price_per_1k, v_admin) returning * into r;
  perform public.write_audit('subscription.create', 'campaign', c.id, null, to_jsonb(r));
  return r;
end $$;

-- A month paid: ledger deposit + invoice number, a new 30-day period, budget and target topped up, campaign resumed.
create or replace function public.admin_subscription_payment(p_sub_id uuid, p_reference text, p_note text) returns public.brand_ledger
language plpgsql security definer set search_path = public, extensions as $$
declare v_admin uuid := public.assert_admin(); s public.brand_subscriptions; c public.campaigns; last public.subscription_periods;
  l public.brand_ledger; v_start date; v_today date := (now() at time zone 'Asia/Jakarta')::date; v_seq int;
begin
  select * into s from public.brand_subscriptions where id = p_sub_id for update;
  if not found then raise exception 'subscription_not_found'; end if;
  if s.status = 'cancelled' then raise exception 'subscription_cancelled'; end if;
  select * into c from public.campaigns where id = s.campaign_id for update;
  select * into last from public.subscription_periods where subscription_id = s.id order by seq desc limit 1;
  v_seq := coalesce(last.seq, 0) + 1;
  v_start := greatest(coalesce(last.period_end, v_today), v_today);
  l := public.admin_record_deposit(s.brand_id, s.campaign_id, s.monthly_price, p_reference, coalesce(nullif(btrim(p_note), ''), s.plan_name || ' · bulan ' || v_seq));
  if v_seq > 1 then
    update public.campaign_pricing set brand_budget = brand_budget + s.monthly_price where campaign_id = s.campaign_id;
  end if;
  insert into public.subscription_periods (subscription_id, seq, period_start, period_end, amount, target_views, earned_start, ledger_id)
  values (s.id, v_seq, v_start, v_start + 30, s.monthly_price, s.monthly_price * 1000 / s.price_per_1k, c.earned, l.id);
  update public.brand_subscriptions set status = 'active', next_bill_at = v_start + 30 where id = s.id;
  if (c.status = 'paused' and c.status_reason = 'subscription_unpaid') or (c.status = 'ending' and c.status_reason = 'budget_exhausted') then
    update public.campaigns set status = 'active', status_reason = null where id = c.id;
  end if;
  perform public.write_audit('subscription.payment', 'campaign', c.id, null, jsonb_build_object('seq', v_seq, 'ledger', l.invoice_no));
  return l;
end $$;

-- What ending the subscription would refund: views overdue past 60 days without a fee; the rest of the unspent budget at 11%.
create or replace function public.admin_subscription_cancel_preview(p_sub_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare v_admin uuid := public.assert_admin(); s public.brand_subscriptions; c public.campaigns; pr public.campaign_pricing; g jsonb;
  v_spent bigint; v_unspent bigint; v_breach bigint; v_rest bigint; v_base bigint; v_pct numeric; v_fee bigint; v_pending int;
begin
  select * into s from public.brand_subscriptions where id = p_sub_id;
  if not found then raise exception 'subscription_not_found'; end if;
  select * into c from public.campaigns where id = s.campaign_id;
  select * into pr from public.campaign_pricing where campaign_id = c.id;
  g := private.subscription_progress(s.id);
  v_spent := private.brand_amount(c.earned, private.spend_share(pr.creator_share_pct, pr.budget_fee_pct));
  v_unspent := greatest(pr.brand_budget - v_spent, 0);
  v_breach := least(v_unspent, (g->>'breach_views')::bigint * s.price_per_1k / 1000);
  v_rest := v_unspent - v_breach;
  v_base := floor(v_rest * (100 - coalesce(pr.budget_fee_pct, 0)) / 100)::bigint;
  v_pct := private.setting_num('refund_fee_pct', 11);
  v_fee := round(v_base * v_pct / 100);
  select count(*) into v_pending from public.submissions where campaign_id = c.id and status in ('pending_review', 'flagged');
  return g || jsonb_build_object('unspent_deposit', v_unspent, 'breach_refund', v_breach, 'rest_base', v_base, 'fee_pct', v_pct, 'fee', v_fee,
    'net', v_breach + v_base - v_fee, 'pending_reviews', v_pending, 'status', s.status);
end $$;

create or replace function public.admin_cancel_subscription(p_sub_id uuid, p_reference text, p_note text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare v_admin uuid := public.assert_admin(); s public.brand_subscriptions; c public.campaigns; pr public.campaign_pricing; v jsonb;
  v_amount bigint; v_fee bigint; l public.brand_ledger;
begin
  select * into s from public.brand_subscriptions where id = p_sub_id for update;
  if not found then raise exception 'subscription_not_found'; end if;
  if s.status = 'cancelled' then raise exception 'subscription_cancelled'; end if;
  select * into c from public.campaigns where id = s.campaign_id for update;
  select * into pr from public.campaign_pricing where campaign_id = c.id for update;
  v := public.admin_subscription_cancel_preview(s.id);
  if (v->>'pending_reviews')::int > 0 then raise exception 'refund_has_pending_reviews'; end if;
  v_amount := (v->>'breach_refund')::bigint + (v->>'rest_base')::bigint;
  v_fee := (v->>'fee')::bigint;
  if v_amount > 0 then
    insert into public.brand_ledger (brand_id, campaign_id, kind, amount, fee_pct, fee, net, invoice_no, reference, note, created_by)
    values (s.brand_id, c.id, 'refund', v_amount, round(v_fee * 100.0 / v_amount, 2), v_fee, v_amount - v_fee, private.next_invoice_no('RF'),
            nullif(btrim(p_reference), ''),
            coalesce(nullif(btrim(p_note), ''), 'Berhenti langganan ' || s.plan_name)
              || case when (v->>'breach_refund')::bigint > 0 then ' · jaminan views: ' || (v->>'breach_refund') || ' tanpa potongan' else '' end,
            v_admin)
    returning * into l;
    update public.campaign_pricing set brand_budget = greatest(ceil(c.earned * 100.0 / private.spend_share(pr.creator_share_pct, pr.budget_fee_pct))::bigint, 2)
    where campaign_id = c.id;
  end if;
  update public.brand_subscriptions set status = 'cancelled', cancelled_at = now(), next_bill_at = null where id = s.id;
  if c.status in ('draft', 'pending_approval') then
    update public.campaigns set status = 'cancelled', status_reason = 'subscription_cancelled' where id = c.id;
  elsif c.status in ('active', 'paused', 'ending') then
    update public.campaigns set status = 'completed', status_reason = 'subscription_cancelled', budget_override = false where id = c.id;
  end if;
  perform public.write_audit('subscription.cancel', 'campaign', c.id, to_jsonb(s), v);
  return v || jsonb_build_object('ledger', to_jsonb(l));
end $$;

revoke execute on function public.admin_upsert_plan(uuid, text, bigint, bigint, boolean), public.admin_create_subscription(uuid, uuid),
  public.admin_subscription_payment(uuid, text, text), public.admin_subscription_cancel_preview(uuid), public.admin_cancel_subscription(uuid, text, text),
  public.brand_subscriptions_summary(), public.admin_subscriptions_list() from public, anon;
grant execute on function public.admin_upsert_plan(uuid, text, bigint, bigint, boolean), public.admin_create_subscription(uuid, uuid),
  public.admin_subscription_payment(uuid, text, text), public.admin_subscription_cancel_preview(uuid), public.admin_cancel_subscription(uuid, text, text),
  public.brand_subscriptions_summary(), public.admin_subscriptions_list() to authenticated;

-- ─────────────────────────────── pacing ───────────────────────────────
-- New clips are accepted while spend stays within the period's daily share (+3 days of slack). Clips already in keep earning.
create or replace function private.enforce_subscription_pace() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare c public.campaigns; p public.subscription_periods; v_days numeric; v_allow numeric;
begin
  select p2.* into p from public.subscription_periods p2 join public.brand_subscriptions s on s.id = p2.subscription_id
  where s.campaign_id = new.campaign_id and s.status = 'active' and p2.period_start <= (now() at time zone 'Asia/Jakarta')::date
  order by p2.seq desc limit 1;
  if not found then return new; end if;
  select * into c from public.campaigns where id = new.campaign_id;
  v_days := greatest(0, (now() at time zone 'Asia/Jakarta')::date - p.period_start);
  v_allow := p.earned_start + (c.budget - p.earned_start) * least(1, (v_days + 3) / 30.0);
  if c.earned >= v_allow and c.earned < c.budget then raise exception 'campaign_paced'; end if;
  return new;
end $$;
drop trigger if exists submissions_subscription_pace on public.submissions;
create trigger submissions_subscription_pace before insert on public.submissions for each row execute function private.enforce_subscription_pace();

-- ─────────────────────────────── daily sweep ───────────────────────────────
create or replace function private.subscription_sweep() returns integer
language plpgsql security definer set search_path = public, extensions as $$
declare s record; g jsonb; v_today date := (now() at time zone 'Asia/Jakarta')::date; v_email text; v_n int := 0; v_elapsed int;
begin
  for s in select bs.*, b.name as brand_name, c.title as campaign_title, c.status as campaign_status
           from public.brand_subscriptions bs join public.brands b on b.id = bs.brand_id join public.campaigns c on c.id = bs.campaign_id
           where bs.status in ('active', 'past_due') loop
    -- Bill reminder, 3 days before the due date.
    if s.status = 'active' and s.next_bill_at = v_today + 3 then
      for v_email in select u.email from public.brand_members bm join auth.users u on u.id = bm.user_id
                     where bm.brand_id = s.brand_id and bm.role = 'owner' and u.email_confirmed_at is not null loop
        perform public.send_app_email('subscription_bill_due', v_email,
          jsonb_build_object('brand', s.brand_name, 'plan', s.plan_name, 'amount', s.monthly_price, 'due', s.next_bill_at,
                             'views', s.monthly_price * 1000 / s.price_per_1k), 'sub_bill:' || s.id || ':' || s.next_bill_at || ':' || v_email);
      end loop;
      v_n := v_n + 1;
    end if;
    -- 3 days past due and still unpaid: pause the campaign.
    if s.next_bill_at is not null and v_today > s.next_bill_at + 3 then
      update public.brand_subscriptions set status = 'past_due' where id = s.id and status = 'active';
      if s.campaign_status = 'active' then
        update public.campaigns set status = 'paused', status_reason = 'subscription_unpaid' where id = s.campaign_id;
        for v_email in select u.email from public.brand_members bm join auth.users u on u.id = bm.user_id
                       where bm.brand_id = s.brand_id and bm.role = 'owner' and u.email_confirmed_at is not null loop
          perform public.send_app_email('subscription_paused', v_email,
            jsonb_build_object('brand', s.brand_name, 'plan', s.plan_name, 'amount', s.monthly_price, 'due', s.next_bill_at), 'sub_paused:' || s.id || ':' || s.next_bill_at || ':' || v_email);
        end loop;
        v_n := v_n + 1;
      end if;
    end if;
    -- Weekly check against the guarantee: behind pace, or views overdue past 60 days.
    g := private.subscription_progress(s.id);
    v_elapsed := v_today - (g->>'period_start')::date;
    if s.status = 'active' and ((v_elapsed > 0 and v_elapsed % 7 = 0 and (g->>'delivered')::bigint < 0.7 * (g->>'expected_now')::numeric)
                                or (g->>'breach_views')::bigint > 0 and v_elapsed % 7 = 0) then
      for v_email in select x from public.app_settings st, jsonb_array_elements_text(st.value) x where st.key = 'admin_emails' loop
        perform public.send_app_email('subscription_behind', v_email,
          g || jsonb_build_object('brand', s.brand_name, 'campaign', s.campaign_title, 'plan', s.plan_name),
          'sub_behind:' || s.id || ':' || v_today || ':' || v_email);
      end loop;
      v_n := v_n + 1;
    end if;
  end loop;
  return v_n;
end $$;
revoke execute on function private.subscription_sweep() from public, anon, authenticated;

do $$
begin
  if to_regclass('cron.job') is null then return; end if;
  execute $cmd$ select cron.unschedule(jobid) from cron.job where jobname = 'subscription-sweep' $cmd$;
  execute $cmd$ select cron.schedule('subscription-sweep', '13 1 * * *', 'select private.subscription_sweep()') $cmd$;   -- 08:13 WIB
end $$;
