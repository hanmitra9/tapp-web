-- TAPP · 0050 · Creators pick a city (not a country), and weekly leaderboards across TAPP: top creators and top cities.
-- Week = qualified views credited in the last 7 days (same source as the campaign leaderboard, 0048).
-- Names are masked except the caller's own row; cities are shown as-is.

set search_path = public, extensions;

alter table public.profiles add column if not exists city text check (city is null or char_length(btrim(city)) between 2 and 40);
grant update (city) on public.profiles to authenticated;

-- Top creators this week (all campaigns), with their city, plus the caller's own row.
create or replace function public.weekly_leaderboard(p_limit integer default 20)
returns table (rank bigint, name text, city text, views bigint, is_me boolean)
language plpgsql stable security definer set search_path = public, extensions as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  return query
  with g as (
    select e.creator_id, sum(e.qualified_views_delta)::bigint as v
    from public.earnings e
    where e.created_at >= now() - interval '7 days' and e.status <> 'reversed'
    group by e.creator_id having sum(e.qualified_views_delta) > 0
  ), ranked as (select g.creator_id, g.v, row_number() over (order by g.v desc, g.creator_id) as rk from g)
  select ranked.rk,
    case when ranked.creator_id = v_uid then 'Kamu' else left(coalesce(p.username::text, p.full_name, 'creator'), 2) || '•••' end,
    p.city, ranked.v, ranked.creator_id = v_uid
  from ranked join public.profiles p on p.id = ranked.creator_id
  where ranked.rk <= least(greatest(coalesce(p_limit, 20), 3), 100) or ranked.creator_id = v_uid
  order by ranked.rk;
end $$;
revoke execute on function public.weekly_leaderboard(integer) from public, anon;
grant execute on function public.weekly_leaderboard(integer) to authenticated;

-- Top cities this week: qualified views of all creators living there, and how many creators contributed.
create or replace function public.city_leaderboard(p_limit integer default 10)
returns table (rank bigint, city text, views bigint, creators bigint, is_mine boolean)
language plpgsql stable security definer set search_path = public, extensions as $$
declare v_uid uuid := auth.uid(); v_city text;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select lower(btrim(p.city)) into v_city from public.profiles p where p.id = v_uid;
  return query
  with g as (
    select initcap(lower(btrim(p.city))) as c, sum(e.qualified_views_delta)::bigint as v, count(distinct e.creator_id)::bigint as n
    from public.earnings e join public.profiles p on p.id = e.creator_id
    where e.created_at >= now() - interval '7 days' and e.status <> 'reversed' and nullif(btrim(p.city), '') is not null
    group by 1 having sum(e.qualified_views_delta) > 0
  ), ranked as (select g.*, row_number() over (order by g.v desc, g.c) as rk from g)
  select ranked.rk, ranked.c, ranked.v, ranked.n, lower(ranked.c) = v_city
  from ranked
  where ranked.rk <= least(greatest(coalesce(p_limit, 10), 3), 50) or lower(ranked.c) = v_city
  order by ranked.rk;
end $$;
revoke execute on function public.city_leaderboard(integer) from public, anon;
grant execute on function public.city_leaderboard(integer) to authenticated;
