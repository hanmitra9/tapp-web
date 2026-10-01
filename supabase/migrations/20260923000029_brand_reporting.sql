-- TAPP · 0029 · Brand reporting: where every raw view went, the real cost, freshness, and a daily email.
--
-- Views, per clip:
--   raw        latest snapshot from the platform (API or admin entry)            content_metrics
--   qualified  views the admin verified and TAPP pays for                        submissions.qualified_views
--   pending    raw views recorded after the last verification (or never verified) → will be decided
--   excluded   the rest: below the campaign's minimum, above the per-clip cap, bots/unusual spikes, rejected clips
--   raw = qualified + pending + excluded (excluded is clamped at 0 when a post later loses views)
-- Cost:
--   spent (rewards to creators) + platform fee (app_settings.platform_fee_pct, 15%) = total cost
--   effective CPM = rewards per 1,000 RAW views — what each 1,000 views the campaign produced actually cost,
--   to compare with the campaign's CPM (rewards per 1,000 QUALIFIED views).

set search_path = public, extensions;

insert into public.app_settings (key, value) values ('platform_fee_pct', '15'::jsonb) on conflict (key) do nothing;

create or replace function public.platform_fee_pct() returns numeric
language sql stable security definer set search_path = public, extensions as $$
  select coalesce((select (value #>> '{}')::numeric from public.app_settings where key = 'platform_fee_pct'), 15)
$$;
revoke execute on function public.platform_fee_pct() from public, anon;
grant execute on function public.platform_fee_pct() to authenticated;

-- Per-clip view accounting, shared by the report functions (definer: callers are already scoped by campaign).
create or replace function private.clip_views(p_campaign_id uuid)
returns table (submission_id uuid, status public.submission_status, raw bigint, qualified bigint, pending bigint,
               last_metrics_at timestamptz, last_qualified_at timestamptz)
language sql stable security definer set search_path = public, extensions as $$
  select s.id, s.status, coalesce(lm.views, 0)::bigint, s.qualified_views,
    case when s.status in ('pending_review', 'approved', 'tracking', 'flagged')
         then greatest(coalesce(lm.views, 0) - coalesce(ls.raw_views, 0), 0) else 0 end::bigint,
    lm.captured_at, ls.created_at
  from public.submissions s
  left join lateral (select m.views, m.captured_at from public.content_metrics m where m.submission_id = s.id order by m.captured_at desc limit 1) lm on true
  left join lateral (select p.raw_views, p.created_at from public.performance_snapshots p where p.submission_id = s.id order by p.created_at desc limit 1) ls on true
  where s.campaign_id = p_campaign_id
$$;
revoke execute on function private.clip_views(uuid) from public, anon, authenticated;

drop function public.brand_campaigns();
create function public.brand_campaigns()
returns table (
  id uuid, brand_id uuid, brand_name text, title text, category text, status public.campaign_status,
  cpm bigint, budget bigint, spent bigint, remaining bigint, starts_at timestamptz, ends_at timestamptz,
  submission_deadline timestamptz, platforms text[], creators_joined bigint, submissions bigint, approved bigint,
  qualified_views bigint, raw_views bigint,
  pending_views bigint, excluded_views bigint, fee_pct numeric, platform_fee bigint, total_cost bigint, effective_cpm bigint,
  last_metrics_at timestamptz, last_qualified_at timestamptz
)
language sql stable security definer set search_path = public, extensions as $$
  select c.id, c.brand_id, b.name, c.title, c.category, c.status, c.cpm, c.budget, c.earned, greatest(c.budget - c.earned, 0),
    c.starts_at, c.ends_at, c.submission_deadline,
    array(select k.platform::text from public.campaign_platforms k where k.campaign_id = c.id order by 1),
    (select count(*) from public.campaign_creators m where m.campaign_id = c.id and m.status = 'joined'),
    (select count(*) from public.submissions s where s.campaign_id = c.id),
    (select count(*) from public.submissions s where s.campaign_id = c.id and s.status in ('approved','tracking','completed')),
    v.qualified, v.raw, v.pending, greatest(v.raw - v.qualified - v.pending, 0),
    public.platform_fee_pct(), round(c.earned * public.platform_fee_pct() / 100)::bigint,
    (c.earned + round(c.earned * public.platform_fee_pct() / 100))::bigint,
    case when v.raw > 0 then round(c.earned * 1000.0 / v.raw)::bigint end,
    v.last_metrics_at, v.last_qualified_at
  from public.campaigns c join public.brands b on b.id = c.brand_id
  cross join lateral (
    select coalesce(sum(cv.qualified), 0)::bigint as qualified, coalesce(sum(cv.raw), 0)::bigint as raw, coalesce(sum(cv.pending), 0)::bigint as pending,
           max(cv.last_metrics_at) as last_metrics_at, max(cv.last_qualified_at) as last_qualified_at
    from private.clip_views(c.id) cv
  ) v
  where c.id in (select private.my_brand_campaign_ids()) and c.status <> 'draft'
  order by case c.status when 'active' then 0 when 'ending' then 1 when 'paused' then 2 else 3 end, c.created_at desc
$$;

drop function public.brand_top_clips(uuid, integer);
create function public.brand_top_clips(p_campaign_id uuid, p_limit integer default 20)
returns table (submission_id uuid, creator_username text, platform public.platform, post_url text, status public.submission_status,
               published_at timestamptz, raw_views bigint, qualified_views bigint, spend bigint, pending_views bigint, last_metrics_at timestamptz)
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if p_campaign_id not in (select private.my_brand_campaign_ids()) then raise exception 'forbidden'; end if;
  return query
  select s.id, p.username::text, s.platform, s.post_url, s.status, s.published_at, cv.raw, s.qualified_views, s.earned, cv.pending, cv.last_metrics_at
  from public.submissions s
  join private.clip_views(p_campaign_id) cv on cv.submission_id = s.id
  left join public.profiles p on p.id = s.creator_id
  where s.status in ('approved','tracking','completed')
  order by s.qualified_views desc, s.created_at desc
  limit least(greatest(coalesce(p_limit, 20), 1), 100);
end $$;

-- ── Daily email report ──
alter table public.brand_members add column if not exists daily_report boolean not null default true;

drop function public.my_brands();
create function public.my_brands() returns table (id uuid, name text, logo_url text, role text, daily_report boolean)
language sql stable security definer set search_path = public, extensions as $$
  select b.id, b.name, b.logo_url, bm.role, bm.daily_report from public.brand_members bm join public.brands b on b.id = bm.brand_id
  where bm.user_id = auth.uid() order by b.name
$$;

create or replace function public.set_brand_daily_report(p_brand_id uuid, p_on boolean) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  update public.brand_members set daily_report = coalesce(p_on, true) where brand_id = p_brand_id and user_id = auth.uid();
  if not found then raise exception 'forbidden'; end if;
end $$;

-- Yesterday (Jakarta) per brand: new qualified views and rewards, plus campaign totals. One email per opted-in
-- member per day (idempotency key), only for brands with a running campaign or activity yesterday.
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
      (select coalesce(sum(e.amount), 0) from public.earnings e join public.campaigns c on c.id = e.campaign_id
        where c.brand_id = br.id and e.created_at >= v_from and e.created_at < v_to) as spend,
      (select jsonb_agg(jsonb_build_object('title', c.title, 'status', c.status, 'qualified', v.qualified, 'raw', v.raw, 'pending', v.pending,
                 'spent', c.earned, 'remaining', greatest(c.budget - c.earned, 0)) order by c.created_at desc)
         from public.campaigns c
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

do $$
begin
  if to_regclass('cron.job') is null then return; end if;
  execute $cmd$ select cron.unschedule(jobid) from cron.job where jobname = 'brand-daily-report' $cmd$;
  execute $cmd$ select cron.schedule('brand-daily-report', '5 1 * * *', 'select public.send_brand_daily_reports()') $cmd$;   -- 08:05 WIB
end $$;

revoke execute on function public.brand_campaigns(), public.brand_top_clips(uuid, integer), public.my_brands(),
  public.set_brand_daily_report(uuid, boolean) from public, anon;
grant execute on function public.brand_campaigns(), public.brand_top_clips(uuid, integer), public.my_brands(),
  public.set_brand_daily_report(uuid, boolean) to authenticated;
