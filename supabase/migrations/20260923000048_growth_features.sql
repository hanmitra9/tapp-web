-- TAPP · 0048 · Growth features: creator referral, weekly campaign leaderboard, deadline reminders,
-- "saldo masuk" notifications and browser (Web Push) delivery of every in-app notification.
--
-- Referral: each creator has a referral code (profiles.referral_code). A new account claims a code within 14 days of
-- signing up (claim_referral). When the invited creator's FIRST withdrawal is paid, the inviter gets
-- app_settings.referral_bonus_idr (Rp20.000), added to the inviter's next withdrawal as part of the bonus
-- (payout_requests.referral_bonus is the share of bonus that came from referrals). A rejected withdrawal releases it.
--
-- Web Push: the app stores the browser's push subscription (push_subscriptions). Every new notification pings the
-- web-push Edge Function (x-dispatch-secret = Vault "web_push_secret"), which sends it with the VAPID key pair.
-- The VAPID public key is in app_settings.vapid_public_key; the private key is only in Vault ("vapid_private_key"),
-- readable through private_vapid_keys() by the service role.

set search_path = public, extensions;

insert into public.app_settings (key, value) values ('referral_bonus_idr', '20000'::jsonb) on conflict (key) do nothing;
insert into public.app_settings (key, value) values ('vapid_public_key', 'null'::jsonb) on conflict (key) do nothing;
insert into public.app_settings (key, value)
values ('web_push_url', to_jsonb('https://njffqsbddzztfxxbavpp.supabase.co/functions/v1/web-push'::text))
on conflict (key) do nothing;

drop policy if exists app_settings_read on public.app_settings;
create policy app_settings_read on public.app_settings for select to authenticated
  using (key in ('earnings_hold_days','min_payout_idr','max_submissions_per_day','publish_grace_minutes','view_milestones',
                 'platform_oauth_config','withdrawal_fee_pct','tier_bonus_pct','withdrawal_fee_idr','creator_fee_pct',
                 'tier_thresholds','referral_bonus_idr','vapid_public_key'));

-- ─────────────────────────────── Referral ───────────────────────────────
alter table public.profiles add column if not exists referral_code text unique
  check (referral_code ~ '^[A-Z0-9]{6,12}$');

create or replace function private.new_referral_code() returns text
language plpgsql volatile set search_path = public, extensions as $$
declare v text; abc constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
begin
  loop
    v := '';
    for i in 1..7 loop v := v || substr(abc, 1 + floor(random() * length(abc))::int, 1); end loop;
    exit when not exists (select 1 from public.profiles where referral_code = v);
  end loop;
  return v;
end $$;
revoke execute on function private.new_referral_code() from public, anon, authenticated;

create table if not exists public.referrals (
  referee_id      uuid primary key references public.profiles(id) on delete cascade,
  referrer_id     uuid not null references public.profiles(id) on delete cascade,
  created_at      timestamptz not null default now(),
  constraint referrals_not_self check (referee_id <> referrer_id)
);
create index if not exists referrals_referrer_idx on public.referrals(referrer_id, created_at desc);
alter table public.referrals enable row level security;
drop policy if exists referrals_read on public.referrals;
create policy referrals_read on public.referrals for select to authenticated
  using (referrer_id = auth.uid() or referee_id = auth.uid() or public.is_admin());
revoke all on public.referrals from anon, authenticated;
grant select on public.referrals to authenticated;

-- One reward per referee, earned when the referee's first withdrawal is paid; spent in the referrer's next withdrawal.
create table if not exists public.referral_rewards (
  id                 uuid primary key default gen_random_uuid(),
  referrer_id        uuid not null references public.profiles(id) on delete cascade,
  referee_id         uuid not null unique references public.profiles(id) on delete cascade,
  amount             bigint not null check (amount > 0),
  status             text not null default 'available' check (status in ('available', 'used')),
  payout_request_id  uuid references public.payout_requests(id) on delete set null,
  created_at         timestamptz not null default now()
);
create index if not exists referral_rewards_open_idx on public.referral_rewards(referrer_id) where status = 'available';
alter table public.referral_rewards enable row level security;
drop policy if exists referral_rewards_read on public.referral_rewards;
create policy referral_rewards_read on public.referral_rewards for select to authenticated
  using (referrer_id = auth.uid() or public.is_admin());
revoke all on public.referral_rewards from anon, authenticated;
grant select on public.referral_rewards to authenticated;

alter table public.payout_requests add column if not exists referral_bonus bigint not null default 0 check (referral_bonus >= 0);

-- The creator's own code (created on first use), invite stats and pending/available rewards.
create or replace function public.my_referral() returns jsonb
language plpgsql volatile security definer set search_path = public, extensions as $$
declare v_uid uuid := auth.uid(); v_code text;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select referral_code into v_code from public.profiles where id = v_uid for update;
  if v_code is null then
    v_code := private.new_referral_code();
    update public.profiles set referral_code = v_code where id = v_uid;
  end if;
  return jsonb_build_object(
    'code', v_code,
    'bonus', private.setting_num('referral_bonus_idr', 20000)::bigint,
    'invited', (select count(*) from public.referrals where referrer_id = v_uid),
    'rewarded', (select count(*) from public.referral_rewards where referrer_id = v_uid),
    'available', (select coalesce(sum(amount), 0) from public.referral_rewards where referrer_id = v_uid and status = 'available'),
    'earned', (select coalesce(sum(amount), 0) from public.referral_rewards where referrer_id = v_uid),
    'friends', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', coalesce(p.full_name, p.username, 'Creator'),
        'joined_at', r.created_at,
        'rewarded', exists (select 1 from public.referral_rewards w where w.referee_id = r.referee_id)) order by r.created_at desc)
      from public.referrals r join public.profiles p on p.id = r.referee_id
      where r.referrer_id = v_uid), '[]'::jsonb)
  );
end $$;
revoke execute on function public.my_referral() from public, anon;
grant execute on function public.my_referral() to authenticated;

-- Called by the app right after signup/onboarding with the code from the invite link. Quietly ignores codes that
-- can't apply (returns false) so a stale link never blocks signup.
create or replace function public.claim_referral(p_code text) returns boolean
language plpgsql security definer set search_path = public, extensions as $$
declare v_uid uuid := auth.uid(); v_ref uuid; v_created timestamptz;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if p_code is null or btrim(p_code) = '' then return false; end if;
  select id into v_ref from public.profiles where referral_code = upper(btrim(p_code));
  if v_ref is null or v_ref = v_uid then return false; end if;
  select created_at into v_created from public.profiles where id = v_uid;
  if v_created < now() - interval '14 days' then return false; end if;
  if exists (select 1 from public.payout_requests where creator_id = v_uid) then return false; end if;
  insert into public.referrals (referee_id, referrer_id) values (v_uid, v_ref) on conflict (referee_id) do nothing;
  if not found then return false; end if;
  perform public.notify(v_ref, 'referral', 'Teman kamu bergabung',
    'Seseorang daftar lewat link undanganmu. Bonus masuk setelah pencairan pertamanya dibayar.', jsonb_build_object('referee', v_uid));
  return true;
end $$;
revoke execute on function public.claim_referral(text) from public, anon;
grant execute on function public.claim_referral(text) to authenticated;

-- First paid withdrawal of a referee → reward for the referrer. A rejected withdrawal releases the rewards it carried.
create or replace function private.on_payout_referral() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare v_ref uuid; v_amount bigint;
begin
  if new.status = 'paid' and old.status is distinct from 'paid' then
    select referrer_id into v_ref from public.referrals where referee_id = new.creator_id;
    if v_ref is not null and not exists (select 1 from public.payout_requests
        where creator_id = new.creator_id and status = 'paid' and id <> new.id) then
      v_amount := private.setting_num('referral_bonus_idr', 20000)::bigint;
      if v_amount > 0 then
        insert into public.referral_rewards (referrer_id, referee_id, amount) values (v_ref, new.creator_id, v_amount)
        on conflict (referee_id) do nothing;
        if found then
          perform public.notify(v_ref, 'referral', 'Bonus referral masuk',
            format('Teman yang kamu undang sudah cair pertama kali. %s ikut ditambahkan di pencairanmu berikutnya.', public.format_idr(v_amount)),
            jsonb_build_object('amount', v_amount));
        end if;
      end if;
    end if;
  elsif new.status = 'rejected' and old.status is distinct from 'rejected' then
    update public.referral_rewards set status = 'available', payout_request_id = null where payout_request_id = new.id;
  end if;
  return new;
end $$;
drop trigger if exists payout_referral on public.payout_requests;
create trigger payout_referral after update of status on public.payout_requests
  for each row execute function private.on_payout_referral();

-- request_payout (0046) + available referral rewards ride along as bonus.
create or replace function public.request_payout(p_idempotency_key uuid) returns public.payout_requests
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_uid uuid := auth.uid(); v_status public.creator_status; v_tier public.creator_tier; r public.payout_requests;
  v_ids uuid[]; v_amount bigint; v_pct numeric; v_fee bigint; v_bpct numeric; v_bonus bigint; v_ref bigint; v_ref_ids uuid[];
  pm public.creator_payout_methods;
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

  select array_agg(id), coalesce(sum(amount), 0) into v_ref_ids, v_ref
  from (select id, amount from public.referral_rewards where referrer_id = v_uid and status = 'available' for update) w;

  v_bpct := public.tier_bonus_pct(coalesce(v_tier, 'new'));
  v_bonus := round(v_amount * v_bpct / 100) + v_ref;
  v_pct := greatest(0, least(100, private.setting_num('creator_fee_pct', 18)));
  v_fee := least(round(v_amount * v_pct / 100)::bigint + private.setting_num('withdrawal_fee_idr', 10000)::bigint, v_amount - 1);

  insert into public.payout_requests (creator_id, amount, fee, fee_pct, fee_tier, bonus, bonus_pct, referral_bonus, idempotency_key, payout_method)
  values (v_uid, v_amount, v_fee, v_pct, coalesce(v_tier, 'new'), v_bonus, v_bpct, v_ref, p_idempotency_key, jsonb_build_object(
    'kind', pm.kind, 'provider', pm.provider, 'account_name', pm.account_name, 'account_number', pm.account_number))
  returning * into r;
  update public.earnings set payout_request_id = r.id where id = any(v_ids);
  if v_ref > 0 then
    update public.referral_rewards set status = 'used', payout_request_id = r.id where id = any(v_ref_ids);
  end if;

  perform public.write_audit('payout.request', 'payout_request', r.id, null,
    jsonb_build_object('amount', v_amount, 'fee', v_fee, 'fee_pct', v_pct, 'bonus', v_bonus, 'referral_bonus', v_ref,
                       'tier', v_tier, 'net', v_amount + v_bonus - v_fee));
  return r;
end $$;
revoke execute on function public.request_payout(uuid) from public, anon;
grant execute on function public.request_payout(uuid) to authenticated;

-- ─────────────────────────────── Leaderboard ───────────────────────────────
-- Top creators of one campaign by qualified views credited in the last 7 days. Visible to members of the campaign
-- and admins. Names are masked ("ra•••") except the caller's own row.
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
    select e.creator_id, sum(e.qualified_views_delta)::bigint as v
    from public.earnings e
    where e.campaign_id = p_campaign and e.created_at >= now() - interval '7 days' and e.status <> 'reversed'
    group by e.creator_id having sum(e.qualified_views_delta) > 0
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
revoke execute on function public.campaign_leaderboard(uuid, integer) from public, anon;
grant execute on function public.campaign_leaderboard(uuid, integer) to authenticated;

-- ─────────────────────────────── Deadline reminders ───────────────────────────────
-- Daily: creators in an active campaign get a reminder 3 days and 1 day before the submission deadline.
create or replace function public.send_deadline_reminders() returns integer
language plpgsql security definer set search_path = public, extensions as $$
declare n integer := 0; r record;
begin
  for r in
    select c.id, c.title, coalesce(c.submission_deadline, c.ends_at) as dl, cc.creator_id,
           case when coalesce(c.submission_deadline, c.ends_at) <= now() + interval '1 day 6 hours' then '1d' else '3d' end as win,
           (select count(*) from public.submissions s where s.campaign_id = c.id and s.creator_id = cc.creator_id) as posts
    from public.campaigns c
    join public.campaign_creators cc on cc.campaign_id = c.id and cc.status = 'joined'
    where c.status = 'active'
      and coalesce(c.submission_deadline, c.ends_at) > now()
      and coalesce(c.submission_deadline, c.ends_at) <= now() + interval '3 days 6 hours'
  loop
    if exists (select 1 from public.notifications n2 where n2.user_id = r.creator_id and n2.type = 'campaign_deadline'
               and n2.data->>'campaign_id' = r.id::text and n2.data->>'window' = r.win) then
      continue;
    end if;
    perform public.notify(r.creator_id, 'campaign_deadline',
      case when r.win = '1d' then format('%s tutup besok', r.title) else format('%s tutup 3 hari lagi', r.title) end,
      case when r.posts = 0 then 'Kamu belum submit klip di campaign ini. Kirim sebelum ditutup supaya views-mu dihitung.'
           else format('Kamu sudah submit %s klip. Masih ada waktu untuk menambah klip sebelum ditutup.', r.posts) end,
      jsonb_build_object('campaign_id', r.id, 'window', r.win, 'deadline', r.dl));
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function public.send_deadline_reminders() from public, anon, authenticated;

do $$
begin
  if to_regclass('cron.job') is null then return; end if;
  perform cron.unschedule(jobid) from cron.job where jobname = 'deadline-reminders';
  execute $cmd$ select cron.schedule('deadline-reminders', '7 2 * * *', 'select public.send_deadline_reminders()') $cmd$;   -- 09:07 WIB
end $$;

-- ─────────────────────────────── "Saldo masuk" ───────────────────────────────
-- admin_credit_submission (0045) + a notification with the amount that just reached the balance.
create or replace function public.admin_credit_submission(p_submission_id uuid, p_views bigint, p_note text default null)
returns public.submissions
language plpgsql security definer set search_path = public, extensions as $$
declare v_admin uuid := public.assert_admin(); s public.submissions; m public.content_metrics; v_before bigint; v_amount bigint;
        r public.submissions; v_title text;
begin
  if p_views is null or p_views < 0 then raise exception 'invalid_views'; end if;
  select * into s from public.submissions where id = p_submission_id for update;
  if not found then raise exception 'submission_not_found'; end if;
  if s.status not in ('approved', 'tracking', 'completed') then raise exception 'submission_not_payable:%', s.status; end if;
  if p_views < s.qualified_views then raise exception 'views_below_paid:%', s.qualified_views; end if;
  select coalesce(sum(amount), 0) into v_before from public.earnings where submission_id = s.id;

  if s.status = 'completed' then update public.submissions set status = 'tracking' where id = s.id; end if;
  m := public.admin_record_metrics(s.id, p_views);
  perform private.qualify_views(s.id, m.id, p_views, coalesce(nullif(btrim(p_note), ''), 'Masuk saldo'), false, v_admin);

  -- The admin's decision is final: the new earnings are withdrawable right away (no hold).
  update public.earnings set status = 'available', available_at = least(available_at, now())
  where submission_id = s.id and status = 'pending' and payout_request_id is null;
  select coalesce(sum(amount), 0) into v_amount from public.earnings where submission_id = s.id;

  update public.submissions set status = 'completed' where id = s.id returning * into r;
  if v_amount > v_before then
    select title into v_title from public.campaigns where id = s.campaign_id;
    perform public.notify(s.creator_id, 'earnings_update', format('Saldo masuk +%s', public.format_idr(v_amount - v_before)),
      format('Klipmu di %s diterima. Saldo bisa ditarik dari menu Saldo.', coalesce(v_title, 'campaign')),
      jsonb_build_object('submission_id', s.id, 'campaign_id', s.campaign_id, 'amount', v_amount - v_before));
  end if;
  perform public.write_audit('submission.credited', 'submission', s.id, null,
    jsonb_build_object('views', p_views, 'earned_total', v_amount));
  return r;
end $$;
revoke execute on function public.admin_credit_submission(uuid, bigint, text) from public, anon;
grant execute on function public.admin_credit_submission(uuid, bigint, text) to authenticated;

-- ─────────────────────────────── Web Push ───────────────────────────────
create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  endpoint    text not null unique check (endpoint ~ '^https://'),
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions(user_id);
alter table public.push_subscriptions enable row level security;
drop policy if exists push_subscriptions_own on public.push_subscriptions;
create policy push_subscriptions_own on public.push_subscriptions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke all on public.push_subscriptions from anon, authenticated;
grant select, delete on public.push_subscriptions to authenticated;

-- Upsert by endpoint: the same browser re-subscribing (or a new user on a shared browser) takes the row over.
create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_ua text default null)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth, left(p_ua, 300))
  on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth,
    user_agent = excluded.user_agent, created_at = now();
end $$;
revoke execute on function public.save_push_subscription(text, text, text, text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text, text) to authenticated;

do $$
begin
  if to_regclass('vault.secrets') is null then return; end if;
  if not exists (select 1 from vault.secrets where name = 'web_push_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'web_push_secret', 'Shared secret for the web-push Edge Function');
  end if;
end $$;

create or replace function public.verify_web_push_secret(p_secret text) returns boolean
language plpgsql stable security definer set search_path = public, extensions as $$
declare v text;
begin
  if to_regclass('vault.decrypted_secrets') is null or p_secret is null then return false; end if;
  execute 'select decrypted_secret from vault.decrypted_secrets where name = $1' into v using 'web_push_secret';
  return v is not null and v = p_secret;
end $$;
revoke execute on function public.verify_web_push_secret(text) from public, anon, authenticated;
grant execute on function public.verify_web_push_secret(text) to service_role;

create or replace function public.private_vapid_keys() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare v_priv text;
begin
  if to_regclass('vault.decrypted_secrets') is null then return null; end if;
  execute 'select decrypted_secret from vault.decrypted_secrets where name = $1' into v_priv using 'vapid_private_key';
  return jsonb_build_object('public', (select value #>> '{}' from public.app_settings where key = 'vapid_public_key'), 'private', v_priv);
end $$;
revoke execute on function public.private_vapid_keys() from public, anon, authenticated;
grant execute on function public.private_vapid_keys() to service_role;

-- Fast path: each notification pings the function (only for users with a subscription). Best effort, never blocks.
create or replace function private.ping_web_push() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare v_url text; v_secret text;
begin
  if not exists (select 1 from public.push_subscriptions where user_id = new.user_id) then return new; end if;
  if to_regproc('net.http_post') is null or to_regclass('vault.decrypted_secrets') is null then return new; end if;
  select value #>> '{}' into v_url from public.app_settings where key = 'web_push_url';
  execute 'select decrypted_secret from vault.decrypted_secrets where name = $1' into v_secret using 'web_push_secret';
  if v_url is null or v_secret is null then return new; end if;
  begin
    execute 'select net.http_post(url := $1, body := $2, headers := $3)'
      using v_url, jsonb_build_object('notification_id', new.id),
            jsonb_build_object('Content-Type', 'application/json', 'x-dispatch-secret', v_secret);
  exception when others then null;
  end;
  return new;
end $$;
drop trigger if exists notifications_web_push on public.notifications;
create trigger notifications_web_push after insert on public.notifications
  for each row execute function private.ping_web_push();
