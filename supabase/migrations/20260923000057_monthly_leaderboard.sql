-- Monthly leaderboard with prizes: ranks creators by earnings credited this calendar month (WIB), resets on the 1st.
-- Prizes per place live in app_settings.leaderboard_prizes (paid out manually by admin).
insert into public.app_settings (key, value) values ('leaderboard_prizes', '[150000, 100000, 60000]'::jsonb)
on conflict (key) do nothing;

create or replace function public.monthly_leaderboard(p_limit integer default 20)
returns table (rank bigint, name text, avatar_url text, tier text, payout bigint, campaigns bigint, prize bigint, is_me boolean, resets_at timestamptz)
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_uid uuid := auth.uid();
  v_start timestamptz := date_trunc('month', now() at time zone 'Asia/Jakarta') at time zone 'Asia/Jakarta';
  v_end timestamptz := (date_trunc('month', now() at time zone 'Asia/Jakarta') + interval '1 month') at time zone 'Asia/Jakarta';
  v_prizes jsonb := coalesce((select s.value from public.app_settings s where s.key = 'leaderboard_prizes'), '[]'::jsonb);
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  return query
  with g as (
    select e.creator_id, sum(e.amount)::bigint as a, count(distinct e.campaign_id)::bigint as c
    from public.earnings e
    where e.status <> 'reversed' and e.created_at >= v_start and e.created_at < v_end
    group by e.creator_id having sum(e.amount) > 0
  ), ranked as (select g.creator_id, g.a, g.c, row_number() over (order by g.a desc, g.creator_id) as rk from g)
  select ranked.rk,
    coalesce(private.mask_name(coalesce(nullif(btrim(p.full_name), ''), p.username::text)), 'c*****r'),
    p.avatar_url, cp.tier::text, ranked.a, ranked.c,
    coalesce((v_prizes ->> (ranked.rk - 1)::int)::bigint, 0),
    ranked.creator_id = v_uid, v_end
  from ranked
  join public.profiles p on p.id = ranked.creator_id
  left join public.creator_profiles cp on cp.user_id = ranked.creator_id
  where ranked.rk <= least(greatest(coalesce(p_limit, 20), 3), 100) or ranked.creator_id = v_uid
  order by ranked.rk;
end $$;
revoke execute on function public.monthly_leaderboard(integer) from public, anon;
grant execute on function public.monthly_leaderboard(integer) to authenticated;

-- Prizes for the podium even when nobody has earned yet this month.
create or replace function public.leaderboard_meta()
returns table (prizes jsonb, resets_at timestamptz)
language sql stable security definer set search_path = public as $$
  select coalesce((select s.value from public.app_settings s where s.key = 'leaderboard_prizes'), '[]'::jsonb),
         (date_trunc('month', now() at time zone 'Asia/Jakarta') + interval '1 month') at time zone 'Asia/Jakarta'
$$;
revoke execute on function public.leaderboard_meta() from public, anon;
grant execute on function public.leaderboard_meta() to authenticated;
