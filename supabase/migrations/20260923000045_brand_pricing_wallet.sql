-- TAPP · 0045 · Brand price vs creator rate, and the creator wallet.
--
-- 1. Brand price vs creator rate. A campaign's commercial terms are entered as what the BRAND pays: brand CPM and
--    brand budget (for views). Creators earn a share of that (app_settings.creator_share_pct, default 70%, per
--    campaign in campaign_pricing.creator_share_pct). The brand terms live in campaign_pricing, readable only by
--    admins and the brand's members; campaigns.cpm / campaigns.budget keep holding the CREATOR rate and the
--    creator-side budget, so every creator screen, the ledger and budget allocation work unchanged.
--      campaigns.cpm    = floor(brand_cpm    × share / 100)
--      campaigns.budget = floor(brand_budget × share / 100)
--    Brand reports convert creator money back to brand money (× 100 / share) and add the partnership fee
--    (app_settings.platform_fee_pct, now 18%). Level bonuses stay paid by TAPP out of its margin.
--    Existing campaigns keep their terms (share 100%).
-- 2. Creator wallet. Accepting a clip's views credits the creator's balance instead of transferring per clip.
--    The creator withdraws (request_payout) once the balance reaches app_settings.min_payout_idr (now Rp100.000);
--    every withdrawal costs a flat app_settings.withdrawal_fee_idr (Rp10.000) and gets the level bonus
--    (tier_bonus_pct, by the level at withdrawal) on top. The admin transfers it from the Payouts queue.

set search_path = public, extensions;

-- ─────────────────────────────── Settings ────────────────────────────
insert into public.app_settings (key, value) values ('creator_share_pct', '70'::jsonb), ('withdrawal_fee_idr', '10000'::jsonb)
on conflict (key) do nothing;
update public.app_settings set value = '18'::jsonb, updated_at = now() where key = 'platform_fee_pct';
update public.app_settings set value = '100000'::jsonb, updated_at = now() where key = 'min_payout_idr';

-- Creators read the withdrawal fee; the creator share stays private.
drop policy if exists app_settings_read on public.app_settings;
create policy app_settings_read on public.app_settings for select to authenticated
  using (key in ('earnings_hold_days','min_payout_idr','max_submissions_per_day','publish_grace_minutes','view_milestones',
                 'platform_oauth_config','withdrawal_fee_pct','tier_bonus_pct','withdrawal_fee_idr'));

create or replace function private.setting_num(p_key text, p_default numeric) returns numeric
language sql stable security definer set search_path = public, extensions as $$
  select coalesce((select (value #>> '{}')::numeric from public.app_settings where key = p_key), p_default)
$$;
revoke execute on function private.setting_num(text, numeric) from public, anon, authenticated;

-- ─────────────────────────────── Brand pricing ───────────────────────
create table if not exists public.campaign_pricing (
  campaign_id        uuid primary key references public.campaigns(id) on delete cascade,
  brand_cpm          bigint not null check (brand_cpm > 0),
  brand_budget       bigint not null check (brand_budget > 0),
  creator_share_pct  numeric(5,2) not null check (creator_share_pct > 0 and creator_share_pct <= 100),
  updated_at         timestamptz not null default now()
);
alter table public.campaign_pricing enable row level security;
revoke all on public.campaign_pricing from public, anon, authenticated;
grant select on public.campaign_pricing to authenticated;
drop policy if exists campaign_pricing_read on public.campaign_pricing;
create policy campaign_pricing_read on public.campaign_pricing for select to authenticated using (
  public.is_admin() or public.is_brand_member(private.campaign_brand_id(campaign_id)));

-- Existing campaigns: what they were sold at is what creators earn.
insert into public.campaign_pricing (campaign_id, brand_cpm, brand_budget, creator_share_pct)
select id, cpm, budget, 100 from public.campaigns on conflict (campaign_id) do nothing;

-- Brand money for an amount of creator money on a campaign.
create or replace function private.brand_amount(p_amount bigint, p_share numeric) returns bigint
language sql immutable as $$ select round(coalesce(p_amount, 0) * 100.0 / coalesce(nullif(p_share, 0), 100))::bigint $$;

-- Keep the creator rate and creator-side budget in step with the brand terms.
create or replace function private.apply_campaign_pricing() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  new.updated_at := now();
  update public.campaigns set
    cpm = greatest(floor(new.brand_cpm * new.creator_share_pct / 100), 1)::bigint,
    budget = greatest(floor(new.brand_budget * new.creator_share_pct / 100), 1)::bigint
  where id = new.campaign_id;
  return new;
end $$;
drop trigger if exists campaign_pricing_apply on public.campaign_pricing;
create trigger campaign_pricing_apply before insert or update on public.campaign_pricing
  for each row execute function private.apply_campaign_pricing();

-- Campaigns created any other way (direct insert) are priced from their cpm/budget as brand terms.
create or replace function private.default_campaign_pricing() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  insert into public.campaign_pricing (campaign_id, brand_cpm, brand_budget, creator_share_pct)
  values (new.id, new.cpm, new.budget, private.setting_num('creator_share_pct', 70))
  on conflict (campaign_id) do nothing;
  return null;
end $$;
drop trigger if exists campaigns_default_pricing on public.campaigns;
create trigger campaigns_default_pricing after insert on public.campaigns
  for each row execute function private.default_campaign_pricing();

-- Draft authoring: cpm and budget in the payload are the BRAND terms. Admins may set the creator share
-- (p.creator_share_pct); otherwise the default share applies.
create or replace function public.upsert_campaign_draft(p_id uuid, p jsonb) returns public.campaigns
language plpgsql security definer set search_path = public, extensions as $$
declare c public.campaigns; r public.campaigns; v_brand uuid := (p->>'brand_id')::uuid; v_plats public.platform[]; v_share numeric;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if p_id is not null then
    select * into c from public.campaigns where id = p_id for update;
    if not found then raise exception 'campaign_not_found'; end if;
    if c.status <> 'draft' then raise exception 'terms_locked_after_draft'; end if;
    v_brand := c.brand_id;
  end if;
  if v_brand is null or not exists (select 1 from public.brands where id = v_brand) then raise exception 'brand_required'; end if;
  if not (public.is_admin() or public.is_brand_member(v_brand)) then raise exception 'forbidden'; end if;

  v_plats := coalesce(array(select jsonb_array_elements_text(p->'platforms'))::public.platform[], '{}');
  if coalesce(nullif(btrim(p->>'title'), ''), '') = '' then raise exception 'title_required'; end if;
  if coalesce((p->>'cpm')::bigint, 0) <= 0 then raise exception 'cpm_required'; end if;
  if coalesce((p->>'budget')::bigint, 0) <= 0 then raise exception 'budget_required'; end if;

  v_share := coalesce((select creator_share_pct from public.campaign_pricing where campaign_id = p_id),
                      private.setting_num('creator_share_pct', 70));
  if public.is_admin() and nullif(p->>'creator_share_pct', '') is not null then v_share := (p->>'creator_share_pct')::numeric; end if;
  if v_share <= 0 or v_share > 100 then raise exception 'invalid_creator_share'; end if;

  if p_id is null then
    insert into public.campaigns (brand_id, title, category, cpm, budget, created_by)
    values (v_brand, btrim(p->>'title'), coalesce(nullif(p->>'category', ''), 'other'), (p->>'cpm')::bigint, (p->>'budget')::bigint, auth.uid())
    returning * into c;
  end if;

  update public.campaigns set
    title = btrim(p->>'title'), objective = nullif(btrim(p->>'objective'), ''), description = nullif(btrim(p->>'description'), ''),
    category = coalesce(nullif(p->>'category', ''), category), content_type = coalesce(nullif(p->>'content_type', ''), content_type),
    max_earning_per_submission = nullif(p->>'max_earning_per_submission', '')::bigint,
    min_views_to_qualify = coalesce(nullif(p->>'min_views_to_qualify', '')::int, 0),
    starts_at = nullif(p->>'starts_at', '')::timestamptz, ends_at = nullif(p->>'ends_at', '')::timestamptz,
    submission_deadline = nullif(p->>'submission_deadline', '')::timestamptz,
    guidelines_do = coalesce(array(select btrim(x) from jsonb_array_elements_text(p->'guidelines_do') x where btrim(x) <> ''), '{}'),
    guidelines_dont = coalesce(array(select btrim(x) from jsonb_array_elements_text(p->'guidelines_dont') x where btrim(x) <> ''), '{}'),
    terms = nullif(btrim(p->>'terms'), '')
  where id = c.id;

  insert into public.campaign_pricing (campaign_id, brand_cpm, brand_budget, creator_share_pct)
  values (c.id, (p->>'cpm')::bigint, (p->>'budget')::bigint, v_share)
  on conflict (campaign_id) do update set brand_cpm = excluded.brand_cpm, brand_budget = excluded.brand_budget,
    creator_share_pct = excluded.creator_share_pct;
  select * into r from public.campaigns where id = c.id;

  delete from public.campaign_platforms where campaign_id = c.id;
  insert into public.campaign_platforms (campaign_id, platform) select c.id, x from unnest(v_plats) x on conflict do nothing;

  if p ? 'rules' then
    delete from public.campaign_rules where campaign_id = c.id;
    insert into public.campaign_rules (campaign_id, kind, body, sort)
    select c.id, e->>'kind', btrim(e->>'body'), ord::int from jsonb_array_elements(p->'rules') with ordinality t(e, ord)
    where btrim(coalesce(e->>'body', '')) <> '';
  end if;

  perform public.write_audit(case when p_id is null then 'campaign.create' else 'campaign.edit' end, 'campaign', c.id,
    case when p_id is null then null else to_jsonb(c) end,
    to_jsonb(r) || jsonb_build_object('brand_cpm', (p->>'cpm')::bigint, 'brand_budget', (p->>'budget')::bigint, 'creator_share_pct', v_share));
  return r;
end $$;

-- Budget changes on live campaigns: p_budget is the BRAND budget.
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
  if floor(p_budget * pr.creator_share_pct / 100) < c.earned and not p_override then raise exception 'budget_below_earned'; end if;
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
  pr.brand_cpm, pr.brand_budget, pr.creator_share_pct, private.brand_amount(c.earned, pr.creator_share_pct) as brand_spent
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
  cross join lateral (select private.brand_amount(c.earned, pr.creator_share_pct) as spent) x
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
  select creator_share_pct into v_share from public.campaign_pricing where campaign_id = p_campaign_id;
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
           sum(private.brand_amount(e.amount, pr.creator_share_pct))::bigint as a
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
    private.brand_amount(coalesce(sum(s.earned), 0)::bigint, (select pr.creator_share_pct from public.campaign_pricing pr where pr.campaign_id = p_campaign_id))
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
      (select coalesce(sum(private.brand_amount(e.amount, pr.creator_share_pct)), 0) from public.earnings e
         join public.campaigns c on c.id = e.campaign_id join public.campaign_pricing pr on pr.campaign_id = c.id
        where c.brand_id = br.id and e.created_at >= v_from and e.created_at < v_to) as spend,
      (select jsonb_agg(jsonb_build_object('title', c.title, 'status', c.status, 'qualified', v.qualified, 'raw', v.raw, 'pending', v.pending,
                 'spent', private.brand_amount(c.earned, pr.creator_share_pct),
                 'remaining', greatest(pr.brand_budget - private.brand_amount(c.earned, pr.creator_share_pct), 0)) order by c.created_at desc)
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

-- ─────────────────────────────── Creator wallet ──────────────────────
-- Accept a clip's views into the creator's balance (no transfer). Re-crediting a clip later only adds the growth.
create or replace function public.admin_credit_submission(p_submission_id uuid, p_views bigint, p_note text default null)
returns public.submissions
language plpgsql security definer set search_path = public, extensions as $$
declare v_admin uuid := public.assert_admin(); s public.submissions; m public.content_metrics; v_amount bigint; r public.submissions;
begin
  if p_views is null or p_views < 0 then raise exception 'invalid_views'; end if;
  select * into s from public.submissions where id = p_submission_id for update;
  if not found then raise exception 'submission_not_found'; end if;
  if s.status not in ('approved', 'tracking', 'completed') then raise exception 'submission_not_payable:%', s.status; end if;
  if p_views < s.qualified_views then raise exception 'views_below_paid:%', s.qualified_views; end if;

  if s.status = 'completed' then update public.submissions set status = 'tracking' where id = s.id; end if;
  m := public.admin_record_metrics(s.id, p_views);
  perform private.qualify_views(s.id, m.id, p_views, coalesce(nullif(btrim(p_note), ''), 'Masuk saldo'), false, v_admin);

  -- The admin's decision is final: the new earnings are withdrawable right away (no hold).
  update public.earnings set status = 'available', available_at = least(available_at, now())
  where submission_id = s.id and status = 'pending' and payout_request_id is null;
  select coalesce(sum(amount), 0) into v_amount from public.earnings where submission_id = s.id;

  update public.submissions set status = 'completed' where id = s.id returning * into r;
  perform public.write_audit('submission.credited', 'submission', s.id, null,
    jsonb_build_object('views', p_views, 'earned_total', v_amount));
  return r;
end $$;
revoke execute on function public.admin_credit_submission(uuid, bigint, text) from public, anon;
grant execute on function public.admin_credit_submission(uuid, bigint, text) to authenticated;

-- Withdraw the whole available balance: flat fee, level bonus on top.
create or replace function public.request_payout(p_idempotency_key uuid) returns public.payout_requests
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_uid uuid := auth.uid(); v_status public.creator_status; v_tier public.creator_tier; r public.payout_requests;
  v_ids uuid[]; v_amount bigint; v_fee bigint; v_bpct numeric; v_bonus bigint; pm public.creator_payout_methods;
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
  v_fee := least(private.setting_num('withdrawal_fee_idr', 10000)::bigint, v_amount - 1);

  insert into public.payout_requests (creator_id, amount, fee, fee_pct, fee_tier, bonus, bonus_pct, idempotency_key, payout_method)
  values (v_uid, v_amount, v_fee, 0, coalesce(v_tier, 'new'), v_bonus, v_bpct, p_idempotency_key, jsonb_build_object(
    'kind', pm.kind, 'provider', pm.provider, 'account_name', pm.account_name, 'account_number', pm.account_number))
  returning * into r;
  update public.earnings set payout_request_id = r.id where id = any(v_ids);

  perform public.write_audit('payout.request', 'payout_request', r.id, null,
    jsonb_build_object('amount', v_amount, 'fee', v_fee, 'bonus', v_bonus, 'tier', v_tier, 'net', v_amount + v_bonus - v_fee));
  return r;
end $$;
revoke execute on function public.request_payout(uuid) from public, anon;
grant execute on function public.request_payout(uuid) to authenticated;

-- A withdrawal can go straight from the queue to paid once the admin has transferred it.
create or replace function public.admin_update_payout(
  p_payout_id uuid, p_status public.payout_status, p_reason text default null, p_reference text default null
) returns public.payout_requests
language plpgsql security definer set search_path = public, extensions as $$
declare v_admin uuid := public.assert_admin(); p public.payout_requests; r public.payout_requests;
begin
  select * into p from public.payout_requests where id = p_payout_id for update;
  if not found then raise exception 'payout_not_found'; end if;
  if not (
       (p.status in ('requested','reviewing','approved','processing') and p_status in ('paid','rejected'))
    or (p.status = 'requested'  and p_status = 'reviewing')
    or (p.status = 'reviewing'  and p_status = 'approved')
    or (p.status = 'approved'   and p_status = 'processing')
  ) then raise exception 'invalid_transition:%->%', p.status, p_status; end if;
  if p_status = 'rejected' and nullif(btrim(p_reason), '') is null then raise exception 'reason_required'; end if;
  if p_status = 'paid' and nullif(btrim(p_reference), '') is null then raise exception 'reference_required'; end if;

  update public.payout_requests set
    status = p_status, reviewed_by = v_admin, reviewed_at = now(),
    review_reason = coalesce(nullif(btrim(p_reason), ''), review_reason),
    processed_reference = coalesce(nullif(btrim(p_reference), ''), processed_reference),
    paid_at = case when p_status = 'paid' then now() else paid_at end
  where id = p.id returning * into r;

  if p_status = 'paid' then
    update public.earnings set status = 'paid' where payout_request_id = p.id;
    update public.campaigns c set paid = c.paid + x.total
    from (select campaign_id, sum(amount) total from public.earnings where payout_request_id = p.id group by campaign_id) x
    where c.id = x.campaign_id;
    perform public.notify(p.creator_id, 'payout_update', 'Pencairan terkirim',
      format('%s telah dikirim ke akun %s kamu.', public.format_idr(p.amount + p.bonus - p.fee), p.payout_method->>'provider'),
      jsonb_build_object('payout_id', p.id));
  elsif p_status = 'rejected' then
    update public.earnings set payout_request_id = null where payout_request_id = p.id;   -- funds return to available
    perform public.notify(p.creator_id, 'payout_update', 'Pencairan ditolak',
      format('Ditolak: %s. Saldo kamu tersedia kembali.', btrim(p_reason)), jsonb_build_object('payout_id', p.id));
  elsif p_status = 'approved' then
    perform public.notify(p.creator_id, 'payout_update', 'Pencairan disetujui',
      format('Pencairan %s disetujui dan akan segera dikirim.', public.format_idr(p.amount + p.bonus - p.fee)), jsonb_build_object('payout_id', p.id));
  end if;

  perform public.write_audit('payout.' || p_status, 'payout_request', p.id,
    jsonb_build_object('status', p.status), jsonb_build_object('status', p_status, 'reason', p_reason, 'reference', p_reference));
  return r;
end $$;

-- The old per-clip transfer is retired: clips are credited to the balance instead.
create or replace function public.admin_pay_submission(p_submission_id uuid, p_views bigint, p_reference text, p_note text default null)
returns public.payout_requests
language plpgsql security definer set search_path = public, extensions as $$
begin
  raise exception 'use_admin_credit_submission';
end $$;
