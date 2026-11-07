-- TAPP · 0078 · Streak removed.
-- The weekly streak (0075/0076) is gone from the app: no page, badge or reminder. This drops its Friday reminder,
-- the streak functions, and the streak field in the monthly recap (back to 0071's recap).

set search_path = public, extensions;

do $$
begin
  if to_regclass('cron.job') is null then return; end if;
  execute $cmd$ select cron.unschedule(jobid) from cron.job where jobname = 'streak-reminder' $cmd$;
end $$;

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
  -- how many creators gained views that month, and how many gained more than this creator
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
    'creators', v_total)
  into r;
  return r;
end $$;

drop function if exists private.streak_reminder();
drop function if exists public.my_streak_weeks(integer);
drop function if exists public.my_streak();
drop function if exists private.creator_streak(uuid);
