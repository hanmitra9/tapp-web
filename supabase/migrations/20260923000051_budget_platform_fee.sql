-- TAPP · 0051 · The 18% platform fee comes out of the campaign budget, not out of the creator's withdrawal.
--
-- The brand still enters its budget and all-in price as usual (campaign_pricing.brand_budget / brand_cpm). Of that budget:
--   · budget_fee_pct (18%, per campaign) is TAPP's platform fee, and
--   · the creator rate is creator_share_pct (70%) of the brand price (the 30% CPM spread).
-- So the creator pool is  campaigns.budget = brand_budget × (1 − 18%) × 70%,  and brand spend = creator pay ÷ (70% × 82%),
-- which reaches the full brand budget exactly when the creator pool runs out.
-- Withdrawals no longer take a percentage (creator_fee_pct = 0); the flat transfer fee (Rp10.000) stays.
-- Existing campaigns keep their current budget (fee 0); new campaigns get app_settings.budget_fee_pct.

set search_path = public, extensions;

insert into public.app_settings (key, value) values ('budget_fee_pct', '18'::jsonb) on conflict (key) do nothing;
update public.app_settings set value = '0'::jsonb, updated_at = now() where key = 'creator_fee_pct';

alter table public.campaign_pricing add column if not exists budget_fee_pct numeric(5,2) not null default 0
  check (budget_fee_pct >= 0 and budget_fee_pct < 90);
alter table public.campaign_pricing alter column budget_fee_pct set default private.setting_num('budget_fee_pct', 18);

-- Brand-money share of one creator rupiah: share × (1 − fee).
create or replace function private.spend_share(p_share numeric, p_fee numeric) returns numeric
language sql immutable as $$ select coalesce(p_share, 100) * (100 - coalesce(p_fee, 0)) / 100 $$;
grant execute on function private.spend_share(numeric, numeric) to authenticated;

create or replace function private.apply_campaign_pricing() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  new.updated_at := now();
  update public.campaigns set
    cpm = greatest(floor(new.brand_cpm * new.creator_share_pct / 100), 1)::bigint,
    budget = greatest(floor(new.brand_budget * private.spend_share(new.creator_share_pct, new.budget_fee_pct) / 100), 1)::bigint
  where id = new.campaign_id;
  return new;
end $$;

-- New campaigns (any path) take the current platform fee.
create or replace function private.default_campaign_pricing() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  insert into public.campaign_pricing (campaign_id, brand_cpm, brand_budget, creator_share_pct, budget_fee_pct)
  values (new.id, new.cpm, new.budget, private.setting_num('creator_share_pct', 70), private.setting_num('budget_fee_pct', 18))
  on conflict (campaign_id) do nothing;
  return null;
end $$;

create or replace function public.admin_adjust_campaign_budget(
  p_campaign_id uuid, p_budget bigint, p_override boolean, p_reason text
) returns public.campaigns
language plpgsql security definer set search_path = public, extensions as $$
declare v_admin uuid := public.assert_admin(); c public.campaigns; r public.campaigns; pr public.campaign_pricing;
begin
  if nullif(btrim(p_reason), '') is null then raise exception 'reason_required'; end if;
  if coalesce(p_budget, 0) <= 0 then raise exception 'budget_required'; end if;
  select * into c from public.campaigns where id = p_campaign_id for update;
  if not found then raise exception 'campaign_not_found'; end if;
  select * into pr from public.campaign_pricing where campaign_id = c.id for update;
  if floor(p_budget * private.spend_share(pr.creator_share_pct, pr.budget_fee_pct) / 100) < c.earned and not p_override then raise exception 'budget_below_earned'; end if;
  update public.campaign_pricing set brand_budget = p_budget where campaign_id = c.id;
  update public.campaigns set budget_override = p_override where id = c.id returning * into r;
  perform public.write_audit('campaign.budget', 'campaign', c.id,
    jsonb_build_object('brand_budget', pr.brand_budget, 'override', c.budget_override),
    jsonb_build_object('brand_budget', p_budget, 'override', p_override), jsonb_build_object('reason', p_reason));
  return r;
end $$;

-- Admin list: brand terms next to the creator rate.
create or replace view public.admin_campaigns with (security_invoker = true) as
select c.id, c.brand_id, b.name as brand_name, c.title, c.category, c.content_type, c.status, c.status_reason,
  c.cpm, c.budget, c.earned, c.paid, c.budget_override, greatest(c.budget - c.earned, 0) as remaining,
  c.min_views_to_qualify, c.max_earning_per_submission, c.starts_at, c.ends_at, c.submission_deadline, c.created_at, c.approved_at,
  array(select k.platform::text from public.campaign_platforms k where k.campaign_id = c.id order by 1) as platforms,
  (select count(*) from public.campaign_creators m where m.campaign_id = c.id and m.status = 'joined') as creators_joined,
  (select count(*) from public.submissions s where s.campaign_id = c.id) as submissions,
  (select count(*) from public.submissions s where s.campaign_id = c.id and s.status in ('approved','tracking','completed')) as approved,
  (select count(*) from public.submissions s where s.campaign_id = c.id and s.status = 'pending_review') as pending_review,
  (select coalesce(sum(s.qualified_views), 0) from public.submissions s where s.campaign_id = c.id) as qualified_views,
  (select count(*) from public.campaign_assets a where a.campaign_id = c.id) as assets,
  pr.brand_cpm, pr.brand_budget, pr.creator_share_pct, private.brand_amount(c.earned, private.spend_share(pr.creator_share_pct, pr.budget_fee_pct)) as brand_spent,
  pr.budget_fee_pct
from public.campaigns c left join public.brands b on b.id = c.brand_id
left join public.campaign_pricing pr on pr.campaign_id = c.id;
grant select on public.admin_campaigns to authenticated;
grant execute on function private.brand_amount(bigint, numeric) to authenticated;

-- ─────────────────────────────── Brand reports (brand money) ─────────
create or replace function public.brand_campaigns()
returns table (
  id uuid, brand_id uuid, brand_name text, title text, category text, status public.campaign_status,
  cpm bigint, budget bigint, spent bigint, remaining bigint, starts_at timestamptz, ends_at timestamptz,
  submission_deadline timestamptz, platforms text[], creators_joined bigint, submissions bigint, approved bigint,
  qualified_views bigint, raw_views bigint,
  pending_views bigint, excluded_views bigint, fee_pct numeric, platform_fee bigint, total_cost bigint, effective_cpm bigint,
  last_metrics_at timestamptz, last_qualified_at timestamptz
)
language sql stable security definer set search_path = public, extensions as $$
  select c.id, c.brand_id, b.name, c.title, c.category, c.status, pr.brand_cpm, pr.brand_budget, x.spent,
    greatest(pr.brand_budget - x.spent, 0), c.starts_at, c.ends_at, c.submission_deadline,
    array(select k.platform::text from public.campaign_platforms k where k.campaign_id = c.id order by 1),
    (select count(*) from public.campaign_creators m where m.campaign_id = c.id and m.status = 'joined'),
    (select count(*) from public.submissions s where s.campaign_id = c.id),
    (select count(*) from public.submissions s where s.campaign_id = c.id and s.status in ('approved','tracking','completed')),
    v.qualified, v.raw, v.pending, greatest(v.raw - v.qualified - v.pending, 0),
    public.platform_fee_pct(), round(x.spent * public.platform_fee_pct() / 100)::bigint,
    (x.spent + round(x.spent * public.platform_fee_pct() / 100))::bigint,
    case when v.raw > 0 then round(x.spent * 1000.0 / v.raw)::bigint end,
    v.last_metrics_at, v.last_qualified_at
  from public.campaigns c join public.brands b on b.id = c.brand_id
  join public.campaign_pricing pr on pr.campaign_id = c.id
  cross join lateral (select private.brand_amount(c.earned, private.spend_share(pr.creator_share_pct, pr.budget_fee_pct)) as spent) x
  cross join lateral (
    select coalesce(sum(cv.qualified), 0)::bigint as qualified, coalesce(sum(cv.raw), 0)::bigint as raw, coalesce(sum(cv.pending), 0)::bigint as pending,
           max(cv.last_metrics_at) as last_metrics_at, max(cv.last_qualified_at) as last_qualified_at
    from private.clip_views(c.id) cv
  ) v
  where c.id in (select private.my_brand_campaign_ids()) and c.status <> 'draft'
  order by case c.status when 'active' then 0 when 'ending' then 1 when 'paused' then 2 else 3 end, c.created_at desc
$$;

create or replace function public.brand_top_clips(p_campaign_id uuid, p_limit integer default 20)
returns table (submission_id uuid, creator_username text, platform public.platform, post_url text, status public.submission_status,
               published_at timestamptz, raw_views bigint, qualified_views bigint, spend bigint, pending_views bigint, last_metrics_at timestamptz)
language plpgsql stable security definer set search_path = public, extensions as $$
declare v_share numeric;
begin
  if p_campaign_id not in (select private.my_brand_campaign_ids()) then raise exception 'forbidden'; end if;
  select private.spend_share(creator_share_pct, budget_fee_pct) into v_share from public.campaign_pricing where campaign_id = p_campaign_id;
  return query
  select s.id, p.username::text, s.platform, s.post_url, s.status, s.published_at, cv.raw, s.qualified_views,
    private.brand_amount(s.earned, v_share), cv.pending, cv.last_metrics_at
  from public.submissions s
  join private.clip_views(p_campaign_id) cv on cv.submission_id = s.id
  left join public.profiles p on p.id = s.creator_id
  where s.status in ('approved','tracking','completed')
  order by s.qualified_views desc, s.created_at desc
  limit least(greatest(coalesce(p_limit, 20), 1), 100);
end $$;

create or replace function public.brand_daily(p_campaign_id uuid default null, p_days integer default 30, p_tz text default 'Asia/Jakarta')
returns table (day date, qualified_gain bigint, spend bigint)
language plpgsql stable security definer set search_path = public, extensions as $$
declare v_tz text := case when exists (select 1 from pg_timezone_names where name = p_tz) then p_tz else 'Asia/Jakarta' end;
        v_days integer := least(greatest(coalesce(p_days, 30), 7), 180);
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if p_campaign_id is not null and p_campaign_id not in (select private.my_brand_campaign_ids()) then raise exception 'forbidden'; end if;
  return query
  with days as (
    select generate_series((now() at time zone v_tz)::date - (v_days - 1), (now() at time zone v_tz)::date, interval '1 day')::date as d
  ), agg as (
    select (e.created_at at time zone v_tz)::date as d, sum(e.qualified_views_delta)::bigint as q,
           sum(private.brand_amount(e.amount, private.spend_share(pr.creator_share_pct, pr.budget_fee_pct)))::bigint as a
    from public.earnings e join public.campaign_pricing pr on pr.campaign_id = e.campaign_id
    where e.campaign_id in (select private.my_brand_campaign_ids())
      and (p_campaign_id is null or e.campaign_id = p_campaign_id)
      and e.created_at >= now() - make_interval(days => v_days + 1)
    group by 1
  )
  select days.d, coalesce(agg.q, 0), coalesce(agg.a, 0) from days left join agg on agg.d = days.d order by days.d;
end $$;

create or replace function public.campaign_platform_breakdown(p_campaign_id uuid)
returns table (platform public.platform, submissions bigint, approved bigint, qualified_views bigint, earned bigint)
language sql stable security invoker set search_path = public, extensions as $$
  select s.platform, count(*), count(*) filter (where s.status in ('approved','tracking','completed')),
    coalesce(sum(s.qualified_views), 0)::bigint,
    private.brand_amount(coalesce(sum(s.earned), 0)::bigint, (select private.spend_share(pr.creator_share_pct, pr.budget_fee_pct) from public.campaign_pricing pr where pr.campaign_id = p_campaign_id))
  from public.submissions s where s.campaign_id = p_campaign_id group by s.platform order by 4 desc
$$;

create or replace function public.send_brand_daily_reports() returns integer
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_day date := (now() at time zone 'Asia/Jakarta')::date - 1;
  v_from timestamptz := (v_day::timestamp at time zone 'Asia/Jakarta');
  v_to timestamptz := ((v_day + 1)::timestamp at time zone 'Asia/Jakarta');
  v_fee numeric := public.platform_fee_pct();
  b record; m record; v_sent integer := 0; v_data jsonb;
begin
  for b in
    select br.id, br.name,
      (select coalesce(sum(e.qualified_views_delta), 0) from public.earnings e join public.campaigns c on c.id = e.campaign_id
        where c.brand_id = br.id and e.created_at >= v_from and e.created_at < v_to) as gain,
      (select coalesce(sum(private.brand_amount(e.amount, private.spend_share(pr.creator_share_pct, pr.budget_fee_pct))), 0) from public.earnings e
         join public.campaigns c on c.id = e.campaign_id join public.campaign_pricing pr on pr.campaign_id = c.id
        where c.brand_id = br.id and e.created_at >= v_from and e.created_at < v_to) as spend,
      (select jsonb_agg(jsonb_build_object('title', c.title, 'status', c.status, 'qualified', v.qualified, 'raw', v.raw, 'pending', v.pending,
                 'spent', private.brand_amount(c.earned, private.spend_share(pr.creator_share_pct, pr.budget_fee_pct)),
                 'remaining', greatest(pr.brand_budget - private.brand_amount(c.earned, private.spend_share(pr.creator_share_pct, pr.budget_fee_pct)), 0)) order by c.created_at desc)
         from public.campaigns c join public.campaign_pricing pr on pr.campaign_id = c.id
         cross join lateral (select coalesce(sum(cv.qualified), 0) as qualified, coalesce(sum(cv.raw), 0) as raw, coalesce(sum(cv.pending), 0) as pending
                             from private.clip_views(c.id) cv) v
        where c.brand_id = br.id and c.status in ('active', 'ending', 'paused')) as campaigns
    from public.brands br where br.status = 'active'
  loop
    continue when b.campaigns is null and b.gain = 0;
    v_data := jsonb_build_object('brand', b.name, 'day', v_day, 'qualified_gain', b.gain, 'spend', b.spend,
                                 'fee', round(b.spend * v_fee / 100), 'fee_pct', v_fee, 'campaigns', coalesce(b.campaigns, '[]'::jsonb));
    for m in
      select u.email from public.brand_members bm join auth.users u on u.id = bm.user_id
      where bm.brand_id = b.id and bm.daily_report and u.email_confirmed_at is not null
    loop
      perform public.send_app_email('brand_daily_report', m.email, v_data, 'brand_daily:' || b.id || ':' || v_day || ':' || m.email);
      v_sent := v_sent + 1;
    end loop;
  end loop;
  return v_sent;
end $$;
revoke execute on function public.send_brand_daily_reports() from public, anon, authenticated;
