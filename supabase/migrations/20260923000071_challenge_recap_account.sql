-- TAPP · 0071 · Weekly challenges, monthly creator recap, payment account, no subscription pacing.
--   1. Subscriptions: the daily clip limit (pacing) is removed; views may arrive as fast as creators post.
--   2. payment_account (bank, number, name) is set by admins and printed on invoices and subscription bill emails.
--   3. Challenge: a TAPP-run campaign (content_type 'challenge') with a prize list instead of a per-view rate. Clips earn
--      nothing per view; when it ends, creators are ranked on total qualified views and the top ones get the prizes.
--   4. my_monthly_recap: a creator's month in numbers (no money) for the shareable recap card, announced on the 1st.

set search_path = public, extensions;

-- ─────────────────────────────── 1. pacing off ───────────────────────────────
drop trigger if exists submissions_subscription_pace on public.submissions;
drop function if exists private.enforce_subscription_pace();

-- ─────────────────────────────── 2. payment account ───────────────────────────────
create or replace function public.admin_payment_account() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare v_admin uuid := public.assert_admin();
begin
  return (select value from public.app_settings where key = 'payment_account');
end $$;

create or replace function public.admin_set_payment_account(p_bank text, p_number text, p_name text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare v_admin uuid := public.assert_admin(); v jsonb;
begin
  if nullif(btrim(p_bank), '') is null or nullif(btrim(p_number), '') is null or nullif(btrim(p_name), '') is null then
    raise exception 'payment_account_required';
  end if;
  v := jsonb_build_object('bank', btrim(p_bank), 'number', btrim(p_number), 'name', btrim(p_name));
  insert into public.app_settings (key, value) values ('payment_account', v)
  on conflict (key) do update set value = excluded.value, updated_at = now();
  perform public.write_audit('settings.payment_account', 'app_settings', null, null, v);
  return v;
end $$;

-- Subscription bill emails carry the payment account.
create or replace function private.subscription_sweep() returns integer
language plpgsql security definer set search_path = public, extensions as $$
declare s record; g jsonb; v_today date := (now() at time zone 'Asia/Jakarta')::date; v_email text; v_n int := 0; v_elapsed int;
begin
  for s in select bs.*, b.name as brand_name, c.title as campaign_title, c.status as campaign_status
           from public.brand_subscriptions bs join public.brands b on b.id = bs.brand_id join public.campaigns c on c.id = bs.campaign_id
           where bs.status in ('active', 'past_due') loop
    -- Bill reminder, 3 days before the due date.
    if s.status = 'active' and s.next_bill_at = v_today + 3 then
      for v_email in select u.email from public.brand_members bm join auth.users u on u.id = bm.user_id
                     where bm.brand_id = s.brand_id and bm.role = 'owner' and u.email_confirmed_at is not null loop
        perform public.send_app_email('subscription_bill_due', v_email,
          jsonb_build_object('brand', s.brand_name, 'plan', s.plan_name, 'amount', s.monthly_price, 'due', s.next_bill_at,
                             'views', s.monthly_price * 1000 * (100 + s.bonus_pct) / (s.price_per_1k * 100),
                             'account', (select value from public.app_settings where key = 'payment_account')), 'sub_bill:' || s.id || ':' || s.next_bill_at || ':' || v_email);
      end loop;
      v_n := v_n + 1;
    end if;
    -- 3 days past due and still unpaid: pause the campaign.
    if s.next_bill_at is not null and v_today > s.next_bill_at + 3 then
      update public.brand_subscriptions set status = 'past_due' where id = s.id and status = 'active';
      if s.campaign_status = 'active' then
        update public.campaigns set status = 'paused', status_reason = 'subscription_unpaid' where id = s.campaign_id;
        for v_email in select u.email from public.brand_members bm join auth.users u on u.id = bm.user_id
                       where bm.brand_id = s.brand_id and bm.role = 'owner' and u.email_confirmed_at is not null loop
          perform public.send_app_email('subscription_paused', v_email,
            jsonb_build_object('brand', s.brand_name, 'plan', s.plan_name, 'amount', s.monthly_price, 'due', s.next_bill_at,
                             'account', (select value from public.app_settings where key = 'payment_account')), 'sub_paused:' || s.id || ':' || s.next_bill_at || ':' || v_email);
        end loop;
        v_n := v_n + 1;
      end if;
    end if;
    -- Weekly check against the guarantee: behind pace, or views overdue past 60 days.
    g := private.subscription_progress(s.id);
    v_elapsed := v_today - (g->>'period_start')::date;
    if s.status = 'active' and ((v_elapsed > 0 and v_elapsed % 7 = 0 and (g->>'delivered')::bigint < 0.7 * (g->>'expected_now')::numeric)
                                or (g->>'breach_views')::bigint > 0 and v_elapsed % 7 = 0) then
      for v_email in select x from public.app_settings st, jsonb_array_elements_text(st.value) x where st.key = 'admin_emails' loop
        perform public.send_app_email('subscription_behind', v_email,
          g || jsonb_build_object('brand', s.brand_name, 'campaign', s.campaign_title, 'plan', s.plan_name),
          'sub_behind:' || s.id || ':' || v_today || ':' || v_email);
      end loop;
      v_n := v_n + 1;
    end if;
  end loop;
  return v_n;
end $$;


-- ─────────────────────────────── 3. challenges ───────────────────────────────
alter table public.campaigns drop constraint if exists campaigns_content_type_kind;
alter table public.campaigns add constraint campaigns_content_type_kind check (content_type in ('clipping', 'ugc', 'challenge'));
alter table public.campaigns add column if not exists challenge_prizes jsonb;          -- [first, second, ...] in rupiah
alter table public.campaigns add column if not exists challenge_settled_at timestamptz;

create or replace function private.is_challenge(p_campaign uuid) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select exists (select 1 from public.campaigns where id = p_campaign and content_type = 'challenge')
$$;

-- Default split for a pool: 30% / 20% / 12%, the other 38% shared by places 4–10; rounding leftovers go to first place.
create or replace function private.default_prizes(p_pool bigint) returns jsonb
language plpgsql immutable as $$
declare v bigint[] := array[floor(p_pool * 0.30), floor(p_pool * 0.20), floor(p_pool * 0.12)]::bigint[]; v_each bigint; i int;
begin
  v_each := floor(p_pool * 0.38 / 7);
  for i in 1..7 loop v := v || v_each; end loop;
  v[1] := v[1] + (p_pool - (select sum(x) from unnest(v) x));
  return to_jsonb(v);
end $$;

-- Draft only: turns a campaign into a challenge with a prize pool (TAPP pays it; no service fee, no creator share).
create or replace function public.admin_set_challenge(p_campaign_id uuid, p_pool bigint, p_prizes jsonb default null) returns public.campaigns
language plpgsql security definer set search_path = public, extensions as $$
declare v_admin uuid := public.assert_admin(); c public.campaigns; v_prizes jsonb; v_sum bigint; r public.campaigns;
begin
  select * into c from public.campaigns where id = p_campaign_id for update;
  if not found then raise exception 'campaign_not_found'; end if;
  if c.status <> 'draft' then raise exception 'terms_locked_after_draft'; end if;
  if exists (select 1 from public.brand_subscriptions where campaign_id = c.id) then raise exception 'already_subscribed'; end if;
  if coalesce(p_pool, 0) < 10000 then raise exception 'amount_required'; end if;
  v_prizes := coalesce(p_prizes, private.default_prizes(p_pool));
  if jsonb_typeof(v_prizes) <> 'array' or jsonb_array_length(v_prizes) not between 1 and 50
     or exists (select 1 from jsonb_array_elements_text(v_prizes) x where x !~ '^[0-9]+$' or x::bigint <= 0) then
    raise exception 'invalid_prizes';
  end if;
  select sum(x::bigint) into v_sum from jsonb_array_elements_text(v_prizes) x;
  if v_sum <> p_pool then raise exception 'prizes_must_equal_pool'; end if;
  -- budget = pool exactly; rate 1 is a placeholder (challenge clips earn nothing per view)
  update public.campaign_pricing set brand_cpm = 1, brand_budget = p_pool, budget_fee_pct = 0, creator_share_pct = 100 where campaign_id = c.id;
  update public.campaigns set content_type = 'challenge', challenge_prizes = v_prizes, max_earning_per_submission = null where id = c.id returning * into r;
  perform public.write_audit('campaign.challenge', 'campaign', c.id, null, jsonb_build_object('pool', p_pool, 'prizes', v_prizes));
  return r;
end $$;

-- Prize list and timing for challenge cards and detail pages (public: the site lists campaigns too).
create or replace function public.challenge_info(p_ids uuid[])
returns table (id uuid, prize_pool bigint, prizes jsonb, ends_at timestamptz, settled_at timestamptz)
language sql stable security definer set search_path = public, extensions as $$
  select c.id, (select coalesce(sum(x::bigint), 0) from jsonb_array_elements_text(coalesce(c.challenge_prizes, '[]'::jsonb)) x)::bigint,
    c.challenge_prizes, c.ends_at, c.challenge_settled_at
  from public.campaigns c
  where c.id = any(p_ids) and c.content_type = 'challenge' and c.status in ('active', 'ending', 'completed')
$$;

-- Ranking: creators (active accounts) by total qualified views of their accepted clips, ties to the earlier first clip.
create or replace function private.challenge_ranking(p_campaign uuid)
returns table (rank bigint, creator_id uuid, views bigint, best_submission uuid)
language sql stable security definer set search_path = public, extensions as $$
  with g as (
    select s.creator_id, sum(s.qualified_views)::bigint as views, min(s.created_at) as first_at,
      (array_agg(s.id order by s.qualified_views desc, s.created_at))[1] as best
    from public.submissions s join public.creator_profiles cp on cp.user_id = s.creator_id and cp.status = 'active'
    where s.campaign_id = p_campaign and s.status in ('approved', 'tracking', 'completed')
    group by s.creator_id
  )
  select row_number() over (order by g.views desc, g.first_at), g.creator_id, g.views, g.best
  from g join public.campaigns c on c.id = p_campaign
  where g.views > 0 and g.views >= coalesce(c.min_views_to_qualify, 0)
$$;

-- Pays the prizes once: an earning per winner (held like any earning), then the challenge is closed.
create or replace function private.settle_challenge(p_campaign uuid, p_actor uuid) returns integer
language plpgsql security definer set search_path = public, extensions as $$
declare c public.campaigns; w record; v_prize bigint; mt public.content_metrics; s public.submissions; snap public.performance_snapshots; v_n int := 0;
begin
  select * into c from public.campaigns where id = p_campaign for update;
  if not found then raise exception 'campaign_not_found'; end if;
  if c.content_type <> 'challenge' then raise exception 'not_a_challenge'; end if;
  if c.challenge_settled_at is not null then raise exception 'challenge_already_settled'; end if;
  for w in select * from private.challenge_ranking(c.id) where rank <= jsonb_array_length(c.challenge_prizes) order by rank loop
    v_prize := (c.challenge_prizes ->> (w.rank::int - 1))::bigint;
    select * into s from public.submissions where id = w.best_submission for update;
    select * into mt from public.content_metrics where submission_id = s.id order by captured_at desc limit 1;
    if not found then continue; end if;
    insert into public.performance_snapshots (submission_id, metric_id, raw_views, qualified_views, previous_qualified_views, note, computed_by)
    values (s.id, mt.id, greatest(mt.views, s.qualified_views), s.qualified_views, s.qualified_views, format('Hadiah challenge juara %s', w.rank), p_actor)
    returning * into snap;
    insert into public.earnings (creator_id, campaign_id, submission_id, snapshot_id, qualified_views_delta, cpm, amount, status, available_at)
    values (w.creator_id, c.id, s.id, snap.id, 0, 0, v_prize, 'pending', now() + make_interval(days => public.setting_int('earnings_hold_days')::int));
    update public.submissions set earned = earned + v_prize where id = s.id;
    update public.campaigns set earned = earned + v_prize where id = c.id;
    perform public.notify(w.creator_id, 'earnings_update', format('Juara %s: %s', w.rank, c.title),
      format('Selamat! Hadiah %s sudah masuk ke penghasilanmu.', public.format_idr(v_prize)),
      jsonb_build_object('campaign_id', c.id, 'rank', w.rank, 'amount', v_prize));
    v_n := v_n + 1;
  end loop;
  update public.campaigns set challenge_settled_at = now(),
    status = case when status in ('active', 'paused', 'ending') then 'completed'::public.campaign_status else status end,
    status_reason = case when status in ('active', 'paused', 'ending') then 'challenge_settled' else status_reason end
  where id = c.id;
  perform public.write_audit('campaign.challenge_settle', 'campaign', c.id, null, jsonb_build_object('winners', v_n, 'auto', p_actor is null));
  return v_n;
end $$;
revoke execute on function private.settle_challenge(uuid, uuid), private.challenge_ranking(uuid), private.default_prizes(bigint) from public, anon, authenticated;

create or replace function public.admin_settle_challenge(p_campaign_id uuid, p_force boolean default false) returns integer
language plpgsql security definer set search_path = public, extensions as $$
declare v_admin uuid := public.assert_admin(); c public.campaigns;
begin
  select * into c from public.campaigns where id = p_campaign_id;
  if not found then raise exception 'campaign_not_found'; end if;
  if (c.ends_at is null or c.ends_at > now()) and not coalesce(p_force, false) then raise exception 'challenge_not_ended'; end if;
  return private.settle_challenge(c.id, v_admin);
end $$;

-- Admin preview: the current top places with what each would win.
create or replace function public.admin_challenge_ranking(p_campaign_id uuid)
returns table (rank bigint, creator_id uuid, creator_name text, username text, views bigint, prize bigint)
language plpgsql stable security definer set search_path = public, extensions as $$
#variable_conflict use_column
declare v_admin uuid := public.assert_admin();
begin
  return query
  select r.rank, r.creator_id, p.full_name, p.username::text, r.views,
    (select (c.challenge_prizes ->> (r.rank::int - 1))::bigint from public.campaigns c where c.id = p_campaign_id)
  from private.challenge_ranking(p_campaign_id) r join public.profiles p on p.id = r.creator_id
  where r.rank <= 20 order by r.rank;
end $$;

-- Ended challenges settle on their own a day after the end (time for the last view checks and reviews).
create or replace function private.challenge_sweep() returns integer
language plpgsql security definer set search_path = public, extensions as $$
declare c record; v_n int := 0;
begin
  for c in select id from public.campaigns where content_type = 'challenge' and challenge_settled_at is null
             and ends_at is not null and ends_at < now() - interval '24 hours' and status in ('active', 'paused', 'ending', 'completed') loop
    perform private.settle_challenge(c.id, null);
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;
revoke execute on function private.challenge_sweep() from public, anon, authenticated;

-- Challenge clips earn nothing per view.
create or replace function private.qualify_views(
  p_submission_id uuid, p_metric_id uuid, p_qualified_views bigint,
  p_note text, p_allow_decrease boolean, p_actor uuid
) returns public.performance_snapshots
language plpgsql security definer set search_path = public, extensions as $$
declare
  s public.submissions; c public.campaigns; mt public.content_metrics; snap public.performance_snapshots;
  v_payable_views bigint; v_target bigint; v_delta bigint; v_capped boolean := false;
  v_milestone bigint;
begin
  select * into s from public.submissions where id = p_submission_id for update;
  if not found then raise exception 'submission_not_found'; end if;
  if s.status <> 'tracking' then raise exception 'submission_not_tracking:%', s.status; end if;
  select * into mt from public.content_metrics where id = p_metric_id and submission_id = s.id;
  if not found then raise exception 'metric_not_found'; end if;
  if p_qualified_views < 0 or p_qualified_views > mt.views then raise exception 'qualified_exceeds_raw'; end if;
  if p_qualified_views < s.qualified_views and not p_allow_decrease then raise exception 'decrease_requires_flag'; end if;
  if p_qualified_views < s.qualified_views and nullif(btrim(p_note), '') is null then raise exception 'reason_required'; end if;

  select * into c from public.campaigns where id = s.campaign_id for update;   -- serialises budget allocation

  v_payable_views := case when p_qualified_views >= c.min_views_to_qualify then p_qualified_views else 0 end;
  v_target := (v_payable_views * c.cpm) / 1000;                                 -- integer floor
  -- Challenges pay prizes at the end, not per view (0071): views are recorded, money stays where it is (prize included).
  if c.content_type = 'challenge' then v_target := s.earned; end if;
  if c.max_earning_per_submission is not null then v_target := least(v_target, c.max_earning_per_submission); end if;
  v_delta := v_target - s.earned;
  if v_delta > 0 and not c.budget_override and v_delta > c.budget - c.earned then
    v_delta := greatest(c.budget - c.earned, 0);
    v_capped := true;
  end if;

  insert into public.performance_snapshots
    (submission_id, metric_id, raw_views, qualified_views, previous_qualified_views, budget_capped, note, computed_by)
  values (s.id, mt.id, mt.views, p_qualified_views, s.qualified_views, v_capped, p_note, p_actor)
  returning * into snap;

  if v_delta <> 0 then
    insert into public.earnings (creator_id, campaign_id, submission_id, snapshot_id, qualified_views_delta, cpm, amount, status, available_at)
    values (s.creator_id, c.id, s.id, snap.id, p_qualified_views - s.qualified_views, c.cpm, v_delta,
            case when v_delta > 0 then 'pending'::public.earning_status else 'available' end,
            case when v_delta > 0 then now() + make_interval(days => public.setting_int('earnings_hold_days')::int) else now() end);
    update public.campaigns set earned = earned + v_delta,
      status = case when not budget_override and earned + v_delta >= budget and status = 'active' then 'ending' else status end,
      status_reason = case when not budget_override and earned + v_delta >= budget and status = 'active' then 'budget_exhausted' else status_reason end
    where id = c.id;
  end if;

  update public.submissions set qualified_views = p_qualified_views, earned = earned + v_delta, auto_hold_reason = null, auto_hold_metric_id = null where id = s.id;
  perform public.recompute_tier(s.creator_id);   -- ← new: keep tier in sync with lifetime qualified views

  if v_delta > 0 then
    perform public.notify(s.creator_id, 'earnings_update', 'Penghasilan bertambah',
      format('%s telah ditambahkan ke penghasilanmu.', public.format_idr(v_delta)),
      jsonb_build_object('submission_id', s.id, 'amount', v_delta));
  end if;
  select max(x) into v_milestone
  from jsonb_array_elements_text((select value from public.app_settings where key = 'view_milestones')) t(v), lateral (select v::bigint x) y
  where x > s.qualified_views and x <= p_qualified_views;
  if v_milestone is not null then
    perform public.notify(s.creator_id, 'performance_milestone', 'Milestone tercapai',
      format('Klip kamu mencapai %s qualified views.', case when v_milestone >= 1000000 then (v_milestone/1000000)::text || 'M'
                                                       else (v_milestone/1000)::text || 'K' end),
      jsonb_build_object('submission_id', s.id, 'milestone', v_milestone));
  end if;

  perform public.write_audit('performance.qualify', 'submission', s.id,
    jsonb_build_object('qualified_views', s.qualified_views, 'earned', s.earned),
    jsonb_build_object('qualified_views', p_qualified_views, 'earned', s.earned + v_delta),
    jsonb_build_object('snapshot_id', snap.id, 'budget_capped', v_capped, 'note', p_note, 'auto', p_actor is null));
  return snap;
end $$;

create or replace function public.campaign_leaderboard(p_campaign uuid, p_limit integer default 10)
returns table (rank bigint, name text, views bigint, is_me boolean)
language plpgsql stable security definer set search_path = public, extensions as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not public.is_admin() and not exists (
    select 1 from public.campaign_creators where campaign_id = p_campaign and creator_id = v_uid) then
    raise exception 'forbidden';
  end if;
  return query
  with g as (
    -- challenges rank on all qualified views in the campaign (no per-view earnings); others on the last 7 days of earnings
    select e.creator_id, sum(e.qualified_views_delta)::bigint as v
    from public.earnings e
    where e.campaign_id = p_campaign and e.created_at >= now() - interval '7 days' and e.status <> 'reversed'
      and not private.is_challenge(p_campaign)
    group by e.creator_id having sum(e.qualified_views_delta) > 0
    union all
    select s.creator_id, sum(s.qualified_views)::bigint
    from public.submissions s
    where s.campaign_id = p_campaign and s.status in ('approved', 'tracking', 'completed') and private.is_challenge(p_campaign)
    group by s.creator_id having sum(s.qualified_views) > 0
  ), ranked as (
    select g.creator_id, g.v, row_number() over (order by g.v desc, g.creator_id) as rk from g
  )
  select ranked.rk,
    case when ranked.creator_id = v_uid then 'Kamu'
         else left(coalesce(p.username::text, p.full_name, 'creator'), 2) || '•••' end,
    ranked.v, ranked.creator_id = v_uid
  from ranked join public.profiles p on p.id = ranked.creator_id
  where ranked.rk <= least(greatest(coalesce(p_limit, 10), 3), 50) or ranked.creator_id = v_uid
  order by ranked.rk;
end $$;

-- ─────────────────────────────── 4. monthly recap ───────────────────────────────
-- A creator's month: qualified views gained, accepted clips, campaigns, best clip, rank and how they compare. No money.
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

-- On the 1st (08:21 WIB): tell every creator who gained views last month that their recap is ready.
create or replace function private.recap_announce() returns integer
language plpgsql security definer set search_path = public, extensions as $$
declare v_month date := date_trunc('month', ((now() at time zone 'Asia/Jakarta') - interval '1 month')::date)::date;
  v_from timestamptz := v_month::timestamp at time zone 'Asia/Jakarta'; v_to timestamptz := (v_month + interval '1 month')::timestamp at time zone 'Asia/Jakarta';
  c record; v_n int := 0;
  v_name text := (array['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'])[extract(month from v_month)::int];
begin
  for c in select creator_id from public.earnings where created_at >= v_from and created_at < v_to and status <> 'reversed'
           group by creator_id having sum(qualified_views_delta) > 0 loop
    perform public.notify(c.creator_id, 'recap', format('Rekap %s kamu sudah siap', v_name),
      'Lihat views, klip, dan rank-mu bulan lalu, lalu bagikan ke Story.', jsonb_build_object('month', v_month, 'path', '/recap'));
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;
revoke execute on function private.recap_announce() from public, anon, authenticated;

revoke execute on function public.admin_payment_account(), public.admin_set_payment_account(text, text, text), public.admin_set_challenge(uuid, bigint, jsonb),
  public.admin_settle_challenge(uuid, boolean), public.admin_challenge_ranking(uuid), public.my_monthly_recap(date) from public, anon;
grant execute on function public.admin_payment_account(), public.admin_set_payment_account(text, text, text), public.admin_set_challenge(uuid, bigint, jsonb),
  public.admin_settle_challenge(uuid, boolean), public.admin_challenge_ranking(uuid), public.my_monthly_recap(date) to authenticated;
revoke execute on function public.challenge_info(uuid[]) from public;
grant execute on function public.challenge_info(uuid[]) to anon, authenticated;

do $$
begin
  if to_regclass('cron.job') is null then return; end if;
  execute $cmd$ select cron.unschedule(jobid) from cron.job where jobname in ('challenge-sweep', 'recap-announce') $cmd$;
  execute $cmd$ select cron.schedule('challenge-sweep', '29 * * * *', 'select private.challenge_sweep()') $cmd$;
  execute $cmd$ select cron.schedule('recap-announce', '21 1 1 * *', 'select private.recap_announce()') $cmd$;   -- 08:21 WIB on the 1st
end $$;
