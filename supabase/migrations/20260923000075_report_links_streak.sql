-- TAPP · 0075 · Shareable campaign report and weekly streak badge.
--   1. A brand member can make a share link for a campaign report (tappcreators.com/laporan.html?t=…). Anyone with the
--      link sees the results — views, clips, creators, daily views, top clips — without logging in. No money is shown.
--      The link can be turned off (and a new one made) at any time.
--   2. Streak: consecutive weeks (Monday–Sunday, WIB) in which a creator had at least one accepted clip. A badge only,
--      no money. Shown on the creator dashboard and in the monthly recap.

set search_path = public, extensions;

-- ─────────────────────────────── 1. report links ───────────────────────────────
create table if not exists public.campaign_report_links (
  campaign_id uuid primary key references public.campaigns(id) on delete cascade,
  token       text not null unique,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
alter table public.campaign_report_links enable row level security;   -- reached only through the functions below
revoke all on public.campaign_report_links from anon, authenticated;

create or replace function public.brand_report_link(p_campaign_id uuid) returns text
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if p_campaign_id not in (select private.my_brand_campaign_ids()) then raise exception 'forbidden'; end if;
  return (select token from public.campaign_report_links where campaign_id = p_campaign_id);
end $$;

-- p_on = true: return the link (made if missing); p_on = false: turn the link off. p_renew makes a new one.
create or replace function public.brand_set_report_link(p_campaign_id uuid, p_on boolean, p_renew boolean default false) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare v_token text;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if p_campaign_id not in (select private.my_brand_campaign_ids()) then raise exception 'forbidden'; end if;
  if not p_on then
    delete from public.campaign_report_links where campaign_id = p_campaign_id;
    perform public.write_audit('campaign.report_link_off', 'campaign', p_campaign_id, null, null);
    return null;
  end if;
  if p_renew then delete from public.campaign_report_links where campaign_id = p_campaign_id; end if;
  insert into public.campaign_report_links (campaign_id, token, created_by)
  values (p_campaign_id, replace(gen_random_uuid()::text, '-', ''), auth.uid())
  on conflict (campaign_id) do nothing;
  select token into v_token from public.campaign_report_links where campaign_id = p_campaign_id;
  perform public.write_audit('campaign.report_link_on', 'campaign', p_campaign_id, null, jsonb_build_object('renew', p_renew));
  return v_token;
end $$;
revoke execute on function public.brand_report_link(uuid), public.brand_set_report_link(uuid, boolean, boolean) from public, anon;
grant execute on function public.brand_report_link(uuid), public.brand_set_report_link(uuid, boolean, boolean) to authenticated;

-- The public report. Unknown or turned-off links return null.
create or replace function public.public_campaign_report(p_token text) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare v_cid uuid; r jsonb; v_today date := (now() at time zone 'Asia/Jakarta')::date;
begin
  if p_token is null or length(p_token) < 20 then return null; end if;
  select campaign_id into v_cid from public.campaign_report_links where token = p_token;
  if v_cid is null then return null; end if;
  select jsonb_build_object(
    'title', c.title, 'brand', b.name, 'logo', b.logo_url, 'status', c.status,
    'starts_at', c.starts_at, 'ends_at', c.ends_at,
    'platforms', array(select k.platform::text from public.campaign_platforms k where k.campaign_id = c.id order by 1),
    'creators', (select count(*) from public.campaign_creators m where m.campaign_id = c.id and m.status = 'joined'),
    'clips', (select count(*) from public.submissions s where s.campaign_id = c.id and s.status in ('approved', 'tracking', 'completed')),
    'views', v.raw, 'qualified_views', v.qualified, 'updated_at', v.last_metrics_at,
    'engagement', (select case when sum(m.views) > 0 then round(sum(m.likes + m.comments + m.shares)::numeric / sum(m.views), 4) end
                   from public.submissions s
                   cross join lateral (select views, likes, comments, shares from public.content_metrics x where x.submission_id = s.id
                                       order by captured_at desc, created_at desc limit 1) m
                   where s.campaign_id = c.id and s.status in ('approved', 'tracking', 'completed')),
    'per_platform', (select coalesce(jsonb_agg(jsonb_build_object('platform', t.platform, 'clips', t.n, 'views', t.v) order by t.v desc), '[]'::jsonb) from (
        select s.platform::text, count(*) n, coalesce(sum(cv.raw), 0)::bigint v from public.submissions s
        join private.clip_views(c.id) cv on cv.submission_id = s.id
        where s.status in ('approved', 'tracking', 'completed') group by 1) t),
    'daily', (select coalesce(jsonb_agg(jsonb_build_object('day', d.d, 'views', coalesce(a.q, 0)) order by d.d), '[]'::jsonb) from (
        select generate_series(v_today - 29, v_today, interval '1 day')::date d) d
      left join (select (e.created_at at time zone 'Asia/Jakarta')::date dd, sum(e.qualified_views_delta)::bigint q from public.earnings e
                 where e.campaign_id = c.id and e.status <> 'reversed' and e.created_at >= now() - interval '31 days' group by 1) a on a.dd = d.d),
    'top', (select coalesce(jsonb_agg(t.j order by t.v desc), '[]'::jsonb) from (
        select jsonb_build_object('creator', p.username, 'platform', s.platform, 'url', s.post_url, 'views', cv.raw) j, cv.raw v
        from public.submissions s join private.clip_views(c.id) cv on cv.submission_id = s.id
        left join public.profiles p on p.id = s.creator_id
        where s.status in ('approved', 'tracking', 'completed') order by cv.raw desc nulls last limit 10) t)
  ) into r
  from public.campaigns c join public.brands b on b.id = c.brand_id
  cross join lateral (select coalesce(sum(x.raw), 0)::bigint raw, coalesce(sum(x.qualified), 0)::bigint qualified, max(x.last_metrics_at) last_metrics_at
                      from private.clip_views(c.id) x) v
  where c.id = v_cid;
  return r;
end $$;
revoke execute on function public.public_campaign_report(text) from public;
grant execute on function public.public_campaign_report(text) to anon, authenticated;

-- ─────────────────────────────── 2. streak ───────────────────────────────
create or replace function private.creator_streak(p_creator uuid) returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  with w as (
    select distinct date_trunc('week', created_at at time zone 'Asia/Jakarta')::date wk
    from public.submissions where creator_id = p_creator and status in ('approved', 'tracking', 'completed')
  ), g as (
    select wk, wk - (row_number() over (order by wk) * 7)::int grp from w
  ), runs as (
    select max(wk) last_wk, count(*)::int n from g group by grp
  ), now_wk as (select date_trunc('week', now() at time zone 'Asia/Jakarta')::date wk)
  select jsonb_build_object(
    'current', coalesce((select n from runs, now_wk where runs.last_wk >= now_wk.wk - 7), 0),
    'best', coalesce((select max(n) from runs), 0),
    'this_week', exists (select 1 from w, now_wk where w.wk = now_wk.wk))
$$;
revoke execute on function private.creator_streak(uuid) from public, anon, authenticated;

create or replace function public.my_streak() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  return private.creator_streak(auth.uid());
end $$;
revoke execute on function public.my_streak() from public, anon;
grant execute on function public.my_streak() to authenticated;

-- 0071's recap + the streak.
create or replace function public.my_monthly_recap(p_month date default null) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare v_uid uuid := auth.uid(); v_from timestamptz; v_to timestamptz; v_month date; v_views bigint; v_better int; v_total int; r jsonb;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  v_month := date_trunc('month', coalesce(p_month, ((now() at time zone 'Asia/Jakarta') - interval '1 month')::date))::date;
  v_from := v_month::timestamp at time zone 'Asia/Jakarta';
  v_to := (v_month + interval '1 month')::timestamp at time zone 'Asia/Jakarta';
  select coalesce(sum(qualified_views_delta), 0) into v_views from public.earnings
  where creator_id = v_uid and created_at >= v_from and created_at < v_to and status <> 'reversed';
  select count(*), count(*) filter (where g.v > v_views) into v_total, v_better from (
    select creator_id, sum(qualified_views_delta) v from public.earnings
    where created_at >= v_from and created_at < v_to and status <> 'reversed' group by creator_id having sum(qualified_views_delta) > 0) g;
  select jsonb_build_object(
    'month', v_month, 'views', v_views,
    'clips', (select count(*) from public.submissions where creator_id = v_uid and reviewed_at >= v_from and reviewed_at < v_to
              and status in ('approved', 'tracking', 'completed')),
    'campaigns', (select count(distinct campaign_id) from public.submissions where creator_id = v_uid and created_at >= v_from and created_at < v_to),
    'best_views', (select max(qualified_views) from public.submissions where creator_id = v_uid and created_at >= v_from and created_at < v_to),
    'tier', (select tier from public.creator_profiles where user_id = v_uid),
    'name', (select coalesce(username::text, full_name) from public.profiles where id = v_uid),
    'top_pct', case when v_views > 0 and v_total > 0 then greatest(1, ceil(100.0 * (v_better + 1) / v_total))::int end,
    'creators', v_total,
    'streak', private.creator_streak(v_uid))
  into r;
  return r;
end $$;
