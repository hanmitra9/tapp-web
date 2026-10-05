-- All-time creator leaderboard: total credited earnings (non-reversed), masked names, avatar and level.
create or replace function private.mask_name(p text)
returns text language sql immutable set search_path = '' as $$
  select string_agg(case when length(w) <= 2 then left(w, 1) || '*' else left(w, 1) || repeat('*', length(w) - 2) || right(w, 1) end, ' ' order by i)
  from unnest(regexp_split_to_array(btrim(coalesce(p, '')), '\s+')) with ordinality as t(w, i)
  where w <> ''
$$;

create or replace function public.alltime_leaderboard(p_limit integer default 20)
returns table (rank bigint, name text, avatar_url text, tier text, payout bigint, is_me boolean)
language plpgsql stable security definer set search_path = public, extensions as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  return query
  with g as (
    select e.creator_id, sum(e.amount)::bigint as a
    from public.earnings e
    where e.status <> 'reversed'
    group by e.creator_id having sum(e.amount) > 0
  ), ranked as (select g.creator_id, g.a, row_number() over (order by g.a desc, g.creator_id) as rk from g)
  select ranked.rk,
    coalesce(private.mask_name(coalesce(nullif(btrim(p.full_name), ''), p.username::text)), 'c*****r'),
    p.avatar_url, cp.tier::text, ranked.a, ranked.creator_id = v_uid
  from ranked
  join public.profiles p on p.id = ranked.creator_id
  left join public.creator_profiles cp on cp.user_id = ranked.creator_id
  where ranked.rk <= least(greatest(coalesce(p_limit, 20), 3), 100) or ranked.creator_id = v_uid
  order by ranked.rk;
end $$;
revoke execute on function public.alltime_leaderboard(integer) from public, anon;
grant execute on function public.alltime_leaderboard(integer) to authenticated;
