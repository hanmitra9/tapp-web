-- TAPP · 0010 · Creator performance read models (Phase 6)
-- SECURITY INVOKER: RLS on submissions/earnings/content_metrics scopes everything to the signed-in creator.

-- Daily qualified-view gains and earnings, gap-filled, in the creator's timezone.
create or replace function public.my_daily_performance(p_days integer default 30, p_tz text default 'Asia/Jakarta')
returns table (day date, qualified_gain bigint, earned bigint)
language plpgsql stable security invoker set search_path = public, extensions as $$
declare v_tz text := case when exists (select 1 from pg_timezone_names where name = p_tz) then p_tz else 'Asia/Jakarta' end;
        v_days integer := least(greatest(coalesce(p_days, 30), 7), 180);
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  return query
  with days as (
    select generate_series((now() at time zone v_tz)::date - (v_days - 1), (now() at time zone v_tz)::date, interval '1 day')::date as d
  ), agg as (
    select (e.created_at at time zone v_tz)::date as d, sum(e.qualified_views_delta)::bigint as q, sum(e.amount)::bigint as a
    from public.earnings e
    where e.creator_id = auth.uid() and e.created_at >= now() - make_interval(days => v_days + 1)
    group by 1
  )
  select days.d, coalesce(agg.q, 0), coalesce(agg.a, 0) from days left join agg on agg.d = days.d order by days.d;
end $$;

-- Per-campaign rollup with a 7-day vs previous-7-day trend.
create or replace function public.my_campaign_performance()
returns table (
  campaign_id uuid, title text, brand_name text, campaign_status public.campaign_status, cpm bigint,
  posts bigint, approved_posts bigint, raw_views bigint, qualified_views bigint, earned bigint,
  engagements bigint, gain_7d bigint, gain_prev_7d bigint, last_metrics_at timestamptz
)
language sql stable security invoker set search_path = public, extensions as $$
  with subs as (
    select s.*, lm.views, lm.likes, lm.comments, lm.shares
    from public.submissions s
    left join lateral (select views, likes, comments, shares from public.content_metrics m
                       where m.submission_id = s.id order by captured_at desc limit 1) lm on true
    where s.creator_id = auth.uid()
  ), gains as (
    select e.campaign_id,
      coalesce(sum(e.qualified_views_delta) filter (where e.created_at >= now() - interval '7 days'), 0)::bigint as g7,
      coalesce(sum(e.qualified_views_delta) filter (where e.created_at <  now() - interval '7 days'
                                                     and e.created_at >= now() - interval '14 days'), 0)::bigint as gp7
    from public.earnings e where e.creator_id = auth.uid() group by e.campaign_id
  )
  select c.id, c.title, b.name, c.status, c.cpm,
    count(s.id), count(s.id) filter (where s.status in ('approved','tracking','completed')),
    coalesce(sum(s.views), 0)::bigint, coalesce(sum(s.qualified_views), 0)::bigint, coalesce(sum(s.earned), 0)::bigint,
    coalesce(sum(coalesce(s.likes,0) + coalesce(s.comments,0) + coalesce(s.shares,0)), 0)::bigint,
    coalesce(max(g.g7), 0), coalesce(max(g.gp7), 0), max(s.last_metrics_at)
  from subs s
  join public.campaigns c on c.id = s.campaign_id
  left join public.brands b on b.id = c.brand_id
  left join gains g on g.campaign_id = c.id
  group by c.id, c.title, b.name, c.status, c.cpm
  order by coalesce(sum(s.qualified_views), 0) desc, max(s.created_at) desc
$$;

revoke execute on function public.my_daily_performance(integer, text), public.my_campaign_performance() from public, anon;
grant execute on function public.my_daily_performance(integer, text), public.my_campaign_performance() to authenticated;
