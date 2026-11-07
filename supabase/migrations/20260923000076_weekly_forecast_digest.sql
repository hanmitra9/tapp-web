-- TAPP · 0076 · Streak page data + Friday reminder, brand weekly report + views forecast, admin daily digest.
--   1. my_streak_weeks: the last N weeks (Mon–Sun, WIB) with the number of accepted clips each, for the streak page.
--      Friday ~15:40 WIB a creator whose streak is alive but has no accepted clip this week gets a reminder (notif+push).
--   2. Views forecast per campaign (brand_campaign_forecast): last 7 days' pace projected to the end date or until the
--      budget runs out, whichever comes first.
--   3. Brand weekly report email, Monday ~07:40 WIB: last week's views and cost, top clips, each running campaign's
--      remaining budget and forecast. Each brand member can turn it off (Akun), like the daily one.
--   4. Admin daily digest email ~07:15 WIB: what needs attention (held / in-review / flagged clips, withdrawals
--      waiting, campaigns almost out of budget).

set search_path = public, extensions;

-- ─────────────────────────────── 1. streak page + reminder ───────────────────────────────
create or replace function public.my_streak_weeks(p_weeks integer default 26) returns table (week date, clips integer)
language plpgsql stable security definer set search_path = public, extensions as $$
declare v_uid uuid := auth.uid(); v_n int := least(greatest(coalesce(p_weeks, 26), 4), 104);
  v_now date := date_trunc('week', now() at time zone 'Asia/Jakarta')::date;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  return query
  select w.d, coalesce(a.n, 0)::int
  from generate_series(v_now - (v_n - 1) * 7, v_now, interval '7 days') w0(x)
  cross join lateral (select w0.x::date d) w
  left join (select date_trunc('week', s.created_at at time zone 'Asia/Jakarta')::date wk, count(*) n from public.submissions s
             where s.creator_id = v_uid and s.status in ('approved', 'tracking', 'completed') group by 1) a on a.wk = w.d
  order by w.d;
end $$;
revoke execute on function public.my_streak_weeks(integer) from public, anon;
grant execute on function public.my_streak_weeks(integer) to authenticated;

create or replace function private.streak_reminder() returns integer
language plpgsql security definer set search_path = public, extensions as $$
declare r record; v_n int := 0; v_wk date := date_trunc('week', now() at time zone 'Asia/Jakarta')::date; j jsonb;
begin
  for r in select cp.user_id from public.creator_profiles cp where cp.status = 'active'
    and exists (select 1 from public.submissions s where s.creator_id = cp.user_id and s.status in ('approved', 'tracking', 'completed')
                and s.created_at >= (v_wk - 7)::timestamp at time zone 'Asia/Jakarta' and s.created_at < v_wk::timestamp at time zone 'Asia/Jakarta')
  loop
    j := private.creator_streak(r.user_id);
    continue when (j->>'current')::int < 1 or (j->>'this_week')::boolean;
    continue when exists (select 1 from public.notifications n where n.user_id = r.user_id and n.type = 'streak_reminder'
                          and n.created_at >= v_wk::timestamp at time zone 'Asia/Jakarta');
    perform public.notify(r.user_id, 'streak_reminder', 'Streak kamu hampir putus 🔥',
      format('Streak %s minggu kamu putus kalau minggu ini belum ada klip. Kirim klip sebelum Minggu 23.59 WIB (dihitung kalau diterima).', j->>'current'),
      jsonb_build_object('path', '/streak', 'streak', (j->>'current')::int));
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;
revoke execute on function private.streak_reminder() from public, anon, authenticated;

-- ─────────────────────────────── 2. forecast ───────────────────────────────
create or replace function private.campaign_forecast(p_campaign_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare c public.campaigns; pr public.campaign_pricing; v_share numeric; v_views7 bigint; v_amt7 bigint; v_qual bigint;
  v_spent bigint; v_remaining bigint; v_day_views numeric; v_day_spend numeric; v_days_end numeric; v_days_budget numeric;
  v_horizon numeric; v_add numeric; v_runout timestamptz;
begin
  select * into c from public.campaigns where id = p_campaign_id;
  select * into pr from public.campaign_pricing where campaign_id = p_campaign_id;
  if c.id is null or pr.campaign_id is null then return null; end if;
  v_share := private.spend_share(pr.creator_share_pct, pr.budget_fee_pct);
  select coalesce(sum(qualified_views_delta), 0), coalesce(sum(amount), 0) into v_views7, v_amt7
  from public.earnings where campaign_id = c.id and status <> 'reversed' and created_at >= now() - interval '7 days';
  select coalesce(sum(qualified), 0) into v_qual from private.clip_views(c.id);
  v_spent := private.brand_amount(c.earned, v_share);
  v_remaining := greatest(pr.brand_budget - v_spent, 0);
  v_day_views := greatest(v_views7, 0) / 7.0;
  v_day_spend := greatest(private.brand_amount(v_amt7, v_share), 0) / 7.0;
  v_days_end := case when c.ends_at is not null then greatest(extract(epoch from (c.ends_at - now())) / 86400, 0) end;
  v_days_budget := case when v_day_spend > 0 then v_remaining / v_day_spend end;
  if c.status not in ('active', 'ending', 'paused') then v_horizon := 0;
  else v_horizon := coalesce(least(v_days_end, v_days_budget), v_days_end, v_days_budget, 30); end if;
  -- never project more views than the remaining budget can pay for
  v_add := least(v_day_views * v_horizon, v_remaining * 1000.0 / pr.brand_cpm);
  if v_days_budget is not null and (v_days_end is null or v_days_budget < v_days_end) and c.status in ('active', 'ending') then
    v_runout := now() + make_interval(secs => v_days_budget * 86400);
  end if;
  return jsonb_build_object(
    'qualified_views', v_qual, 'daily_views', round(v_day_views), 'daily_spend', round(v_day_spend),
    'projected_views', v_qual + round(v_add)::bigint, 'horizon_days', round(v_horizon),
    'ends_at', c.ends_at, 'budget_runout_at', v_runout, 'remaining', v_remaining,
    'enough_data', v_views7 > 0);
end $$;
revoke execute on function private.campaign_forecast(uuid) from public, anon, authenticated;

create or replace function public.brand_campaign_forecast(p_campaign_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if p_campaign_id not in (select private.my_brand_campaign_ids()) then raise exception 'forbidden'; end if;
  return private.campaign_forecast(p_campaign_id);
end $$;
revoke execute on function public.brand_campaign_forecast(uuid) from public, anon;
grant execute on function public.brand_campaign_forecast(uuid) to authenticated;

-- ─────────────────────────────── 3. brand weekly report ───────────────────────────────
alter table public.brand_members add column if not exists weekly_report boolean not null default true;

drop function if exists public.my_brands();
create function public.my_brands() returns table (id uuid, name text, logo_url text, role text, daily_report boolean, weekly_report boolean)
language sql stable security definer set search_path = public, extensions as $$
  select b.id, b.name, b.logo_url, bm.role, bm.daily_report, bm.weekly_report from public.brand_members bm join public.brands b on b.id = bm.brand_id
  where bm.user_id = auth.uid() order by b.name
$$;
revoke execute on function public.my_brands() from public, anon;
grant execute on function public.my_brands() to authenticated;

create or replace function public.set_brand_weekly_report(p_brand_id uuid, p_on boolean) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  update public.brand_members set weekly_report = coalesce(p_on, true) where brand_id = p_brand_id and user_id = auth.uid();
  if not found then raise exception 'forbidden'; end if;
end $$;
revoke execute on function public.set_brand_weekly_report(uuid, boolean) from public, anon;
grant execute on function public.set_brand_weekly_report(uuid, boolean) to authenticated;

create or replace function public.send_brand_weekly_reports() returns integer
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_end date := date_trunc('week', now() at time zone 'Asia/Jakarta')::date;   -- this Monday
  v_start date := v_end - 7;
  v_from timestamptz := v_start::timestamp at time zone 'Asia/Jakarta';
  v_to timestamptz := v_end::timestamp at time zone 'Asia/Jakarta';
  v_fee numeric := public.platform_fee_pct();
  b record; m record; v_sent integer := 0; v_data jsonb;
begin
  for b in
    select br.id, br.name,
      (select coalesce(sum(e.qualified_views_delta), 0) from public.earnings e join public.campaigns c on c.id = e.campaign_id
        where c.brand_id = br.id and e.status <> 'reversed' and e.created_at >= v_from and e.created_at < v_to) as gain,
      (select coalesce(sum(private.brand_amount(e.amount, private.spend_share(pr.creator_share_pct, pr.budget_fee_pct))), 0) from public.earnings e
         join public.campaigns c on c.id = e.campaign_id join public.campaign_pricing pr on pr.campaign_id = c.id
        where c.brand_id = br.id and e.status <> 'reversed' and e.created_at >= v_from and e.created_at < v_to) as spend,
      (select jsonb_agg(t.j order by t.g desc) from (
         select jsonb_build_object('creator', p.username, 'platform', s.platform, 'url', s.post_url, 'campaign', c.title, 'views', sum(e.qualified_views_delta)) j,
                sum(e.qualified_views_delta) g
         from public.earnings e join public.submissions s on s.id = e.submission_id join public.campaigns c on c.id = e.campaign_id
         left join public.profiles p on p.id = s.creator_id
         where c.brand_id = br.id and e.status <> 'reversed' and e.created_at >= v_from and e.created_at < v_to
         group by p.username, s.platform, s.post_url, c.title having sum(e.qualified_views_delta) > 0
         order by g desc limit 3) t) as top,
      (select jsonb_agg(jsonb_build_object('title', c.title, 'remaining', f->'remaining', 'qualified', f->'qualified_views',
                 'projected', f->'projected_views', 'runout', f->'budget_runout_at', 'ends_at', c.ends_at) order by c.created_at desc)
         from public.campaigns c cross join lateral (select private.campaign_forecast(c.id) f) x
        where c.brand_id = br.id and c.status in ('active', 'ending', 'paused')) as campaigns
    from public.brands br where br.status = 'active'
  loop
    continue when b.campaigns is null and b.gain = 0;
    v_data := jsonb_build_object('brand', b.name, 'from', v_start, 'to', v_end - 1, 'qualified_gain', b.gain, 'spend', b.spend,
      'fee', round(b.spend * v_fee / 100), 'fee_pct', v_fee, 'top', coalesce(b.top, '[]'::jsonb), 'campaigns', coalesce(b.campaigns, '[]'::jsonb));
    for m in
      select u.email from public.brand_members bm join auth.users u on u.id = bm.user_id
      where bm.brand_id = b.id and bm.weekly_report and u.email_confirmed_at is not null
    loop
      perform public.send_app_email('brand_weekly_report', m.email, v_data, 'brand_weekly:' || b.id || ':' || v_start || ':' || m.email);
      v_sent := v_sent + 1;
    end loop;
  end loop;
  return v_sent;
end $$;
revoke execute on function public.send_brand_weekly_reports() from public, anon, authenticated;

-- ─────────────────────────────── 4. admin daily digest ───────────────────────────────
create or replace function private.admin_digest_data() returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select jsonb_build_object(
    'held', (select count(*) from public.submissions where status = 'tracking' and auto_hold_reason is not null),
    'held_value', (select coalesce(sum(greatest(coalesce(lm.views, 0) - s.qualified_views, 0) * c.cpm / 1000), 0)
                   from public.submissions s join public.campaigns c on c.id = s.campaign_id
                   left join lateral (select views from public.content_metrics x where x.submission_id = s.id order by captured_at desc limit 1) lm on true
                   where s.status = 'tracking' and s.auto_hold_reason is not null),
    'pending_review', (select count(*) from public.submissions where status = 'pending_review'),
    'flagged', (select count(*) from public.submissions where status = 'flagged'),
    'payouts', (select count(*) from public.payout_requests where status in ('requested', 'reviewing', 'approved', 'processing')),
    'payouts_total', (select coalesce(sum(amount), 0) from public.payout_requests where status in ('requested', 'reviewing', 'approved', 'processing')),
    'low_budget', (select coalesce(jsonb_agg(jsonb_build_object('title', c.title, 'left_pct', round(100 - c.earned * 100.0 / nullif(c.budget, 0)))
                   order by c.earned::numeric / nullif(c.budget, 0) desc), '[]'::jsonb)
                   from public.campaigns c where c.status = 'active' and not c.budget_override and c.budget > 0 and c.earned >= c.budget * 0.85),
    'creators_to_review', (select count(*) from public.creator_profiles where status = 'verified'))
$$;
revoke execute on function private.admin_digest_data() from public, anon, authenticated;

create or replace function private.admin_daily_digest() returns integer
language plpgsql security definer set search_path = public, extensions as $$
declare d jsonb := private.admin_digest_data(); v_admin text; n int := 0; v_day text := to_char(now() at time zone 'Asia/Jakarta', 'YYYY-MM-DD');
begin
  if (d->>'held')::int + (d->>'pending_review')::int + (d->>'flagged')::int + (d->>'payouts')::int
     + jsonb_array_length(d->'low_budget') + (d->>'creators_to_review')::int = 0 then return 0; end if;
  for v_admin in select x from public.app_settings s, jsonb_array_elements_text(s.value) x where s.key = 'admin_emails' loop
    perform public.send_app_email('admin_daily_digest', v_admin, d || jsonb_build_object('day', v_day), 'admin_digest:' || v_day || ':' || v_admin);
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function private.admin_daily_digest() from public, anon, authenticated;

do $$
begin
  if to_regclass('cron.job') is null then return; end if;
  execute $cmd$ select cron.unschedule(jobid) from cron.job where jobname in ('streak-reminder', 'brand-weekly-report', 'admin-daily-digest') $cmd$;
  execute $cmd$ select cron.schedule('streak-reminder', '41 8 * * 5', 'select private.streak_reminder()') $cmd$;            -- Fri 15:41 WIB
  execute $cmd$ select cron.schedule('brand-weekly-report', '43 0 * * 1', 'select public.send_brand_weekly_reports()') $cmd$; -- Mon 07:43 WIB
  execute $cmd$ select cron.schedule('admin-daily-digest', '17 0 * * *', 'select private.admin_daily_digest()') $cmd$;       -- 07:17 WIB
end $$;
