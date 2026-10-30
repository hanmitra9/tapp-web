-- TAPP · 0070 · Bonus views on subscription plans (default +20%).
-- The brand still pays the plan price; the guaranteed views grow by bonus_pct. The creator rate stays Rp984 / 1.000 views,
-- so the bonus comes out of TAPP's margin (34.4% → about 21% at +20%). Implemented by raising the creator share of the
-- post-fee budget to 80% × (1 + bonus) and lowering brand_cpm to match: same creator rate, a bigger creator-side budget.

set search_path = public, extensions;

alter table public.subscription_plans add column if not exists bonus_pct numeric(5,2) not null default 20 check (bonus_pct between 0 and 25);
alter table public.brand_subscriptions add column if not exists bonus_pct numeric(5,2) not null default 0 check (bonus_pct between 0 and 25);
update public.subscription_plans set bonus_pct = 20;

create or replace function public.admin_upsert_plan(p_id uuid, p_name text, p_monthly_price bigint, p_price_per_1k bigint, p_active boolean, p_bonus_pct numeric default 20)
returns public.subscription_plans
language plpgsql security definer set search_path = public, extensions as $$
declare v_admin uuid := public.assert_admin(); r public.subscription_plans;
begin
  if nullif(btrim(p_name), '') is null then raise exception 'name_required'; end if;
  if coalesce(p_monthly_price, 0) < 10000 then raise exception 'amount_required'; end if;
  if coalesce(p_price_per_1k, 0) <= 0 then raise exception 'cpm_required'; end if;
  if coalesce(p_bonus_pct, 0) not between 0 and 25 then raise exception 'invalid_bonus'; end if;
  if p_id is null then
    insert into public.subscription_plans (name, monthly_price, price_per_1k, active, bonus_pct, sort)
    values (btrim(p_name), p_monthly_price, p_price_per_1k, coalesce(p_active, true), coalesce(p_bonus_pct, 0), (select coalesce(max(sort), 0) + 1 from public.subscription_plans))
    returning * into r;
  else
    update public.subscription_plans set name = btrim(p_name), monthly_price = p_monthly_price, price_per_1k = p_price_per_1k,
      active = coalesce(p_active, true), bonus_pct = coalesce(p_bonus_pct, 0)
    where id = p_id returning * into r;
    if not found then raise exception 'plan_not_found'; end if;
  end if;
  perform public.write_audit('subscription.plan', 'subscription_plan', r.id, null, to_jsonb(r));
  return r;
end $$;
drop function if exists public.admin_upsert_plan(uuid, text, bigint, bigint, boolean);

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
  -- Fixed terms: 18% service fee, creator keeps 80% of the post-fee budget; the bonus raises that share (max 100%).
  v_fee := 18;
  v_share := 80 * (1 + pl.bonus_pct / 100);
  -- Creator rate = brand_cpm × share = price × 0.82 × 0.8, whatever the bonus.
  update public.campaign_pricing set brand_cpm = greatest(round(pl.price_per_1k * (100 - v_fee) / 100 * 80 / v_share), 1)::bigint,
    brand_budget = pl.monthly_price, budget_fee_pct = v_fee, creator_share_pct = v_share
  where campaign_id = c.id;
  update public.campaigns set ends_at = null, submission_deadline = null, max_earning_per_submission = null where id = c.id;
  insert into public.brand_subscriptions (brand_id, campaign_id, plan_id, plan_name, monthly_price, price_per_1k, bonus_pct, created_by)
  values (c.brand_id, c.id, pl.id, pl.name, pl.monthly_price, pl.price_per_1k, pl.bonus_pct, v_admin) returning * into r;
  perform public.write_audit('subscription.create', 'campaign', c.id, null, to_jsonb(r));
  return r;
end $$;

-- Each paid period guarantees price-based views plus the subscription's bonus.
create or replace function private.subscription_period_target() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare s public.brand_subscriptions;
begin
  select * into s from public.brand_subscriptions where id = new.subscription_id;
  new.target_views := floor(new.amount::numeric * 1000 * (100 + s.bonus_pct) / (s.price_per_1k * 100))::bigint;
  return new;
end $$;
drop trigger if exists subscription_periods_target on public.subscription_periods;
create trigger subscription_periods_target before insert on public.subscription_periods for each row execute function private.subscription_period_target();

-- Overdue guaranteed views are refunded at what the brand paid per view (price ÷ (1 + bonus)).
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
  v_breach := least(v_unspent, floor((g->>'breach_views')::numeric * s.price_per_1k * 100 / (1000 * (100 + s.bonus_pct)))::bigint);
  v_rest := v_unspent - v_breach;
  v_base := floor(v_rest * (100 - coalesce(pr.budget_fee_pct, 0)) / 100)::bigint;
  v_pct := private.setting_num('refund_fee_pct', 11);
  v_fee := round(v_base * v_pct / 100);
  select count(*) into v_pending from public.submissions where campaign_id = c.id and status in ('pending_review', 'flagged');
  return g || jsonb_build_object('unspent_deposit', v_unspent, 'breach_refund', v_breach, 'rest_base', v_base, 'fee_pct', v_pct, 'fee', v_fee,
    'net', v_breach + v_base - v_fee, 'pending_reviews', v_pending, 'status', s.status);
end $$;

create or replace function public.brand_subscriptions_summary()
returns table (id uuid, brand_id uuid, campaign_id uuid, campaign_title text, plan_name text, monthly_price bigint, price_per_1k bigint,
               status text, next_bill_at date, progress jsonb)
language sql stable security definer set search_path = public, extensions as $$
  select s.id, s.brand_id, s.campaign_id, c.title, s.plan_name, s.monthly_price, s.price_per_1k, s.status, s.next_bill_at,
    private.subscription_progress(s.id) || jsonb_build_object('bonus_pct', s.bonus_pct)
  from public.brand_subscriptions s join public.campaigns c on c.id = s.campaign_id
  where s.status <> 'cancelled' and (public.is_admin() or public.is_brand_member(s.brand_id))
  order by s.created_at desc
$$;

revoke execute on function public.admin_upsert_plan(uuid, text, bigint, bigint, boolean, numeric) from public, anon;
grant execute on function public.admin_upsert_plan(uuid, text, bigint, bigint, boolean, numeric) to authenticated;

drop function if exists public.admin_subscriptions_list();
create function public.admin_subscriptions_list()
returns table (id uuid, brand_id uuid, brand_name text, campaign_id uuid, campaign_title text, campaign_status public.campaign_status,
               plan_name text, monthly_price bigint, price_per_1k bigint, bonus_pct numeric, status text, next_bill_at date, created_at timestamptz, progress jsonb)
language plpgsql stable security definer set search_path = public, extensions as $$
#variable_conflict use_column
declare v_admin uuid := public.assert_admin();
begin
  return query
  select s.id, s.brand_id, b.name, s.campaign_id, c.title, c.status, s.plan_name, s.monthly_price, s.price_per_1k, s.bonus_pct, s.status, s.next_bill_at, s.created_at,
    private.subscription_progress(s.id)
  from public.brand_subscriptions s join public.brands b on b.id = s.brand_id join public.campaigns c on c.id = s.campaign_id
  order by (s.status = 'cancelled'), s.created_at desc;
end $$;
revoke execute on function public.admin_subscriptions_list() from public, anon;
grant execute on function public.admin_subscriptions_list() to authenticated;
