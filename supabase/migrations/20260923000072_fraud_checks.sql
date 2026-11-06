-- TAPP · 0072 · Fraud checks.
--   1. Held earnings of a clip that is flagged, rejected, sent back, or no longer live stay held; the hold release skips them
--      until the clip is cleared (before, a clip deleted during the 7-day hold still paid out).
--   2. A withdrawal whose account holder name doesn't match the profile name is marked for the admin (name_mismatch).
--   3. submission-check now reads the real post time; a post made before the creator joined is marked (posted_before_join),
--      shown to the admin and held by the automatic filter.
--   4. The automatic view filter (0030) is switched on.
--   5. A referral bonus needs the invited creator to have at least 3 accepted clips (besides a paid first withdrawal).

set search_path = public, extensions;

-- ─────────────────────────────── 1. hold release ───────────────────────────────
create or replace function public.release_matured_earnings(p_creator uuid default null) returns integer
language plpgsql security definer set search_path = public, extensions as $$
declare n integer;
begin
  update public.earnings e set status = 'available'
  from public.submissions s
  where e.submission_id = s.id and e.status = 'pending' and e.available_at <= now() and (p_creator is null or e.creator_id = p_creator)
    and s.status in ('approved', 'tracking', 'completed') and s.content_state in ('live', 'unknown');
  get diagnostics n = row_count;
  return n;
end $$;

-- ─────────────────────────────── 2. account holder name ───────────────────────────────
-- Same person if, ignoring case, punctuation and titles, one name's words all appear in the other ("Rani P" ~ "Rani Putri").
create or replace function private.names_match(a text, b text) returns boolean
language plpgsql immutable as $$
declare x text[]; y text[]; drop_words text[] := array['bpk','bp','ibu','bu','sdr','sdri','tn','ny','nn','h','hj','dr','ir','st','se','mm','ssi','skom','spd','amd','mt'];
  w text; hits int := 0;
begin
  if a is null or b is null then return true; end if;   -- nothing to compare: don't raise a false alarm
  x := array(select t from unnest(regexp_split_to_array(lower(regexp_replace(a, '[^A-Za-z ]', ' ', 'g')), '\s+')) t where t <> '' and t <> all(drop_words));
  y := array(select t from unnest(regexp_split_to_array(lower(regexp_replace(b, '[^A-Za-z ]', ' ', 'g')), '\s+')) t where t <> '' and t <> all(drop_words));
  if cardinality(x) = 0 or cardinality(y) = 0 then return true; end if;
  if cardinality(x) > cardinality(y) then select y, x into x, y; end if;   -- x = the shorter name
  foreach w in array x loop
    if exists (select 1 from unnest(y) v where v = w or (length(w) = 1 and left(v, 1) = w)) then hits := hits + 1; end if;
  end loop;
  return hits = cardinality(x);
end $$;

drop view if exists public.admin_payouts;
create view public.admin_payouts with (security_invoker = true) as
select p.id, p.creator_id, p.amount, p.status, p.payout_method, p.review_reason, p.reviewed_at, p.processed_reference,
  p.paid_at, p.created_at, p.updated_at,
  pr.full_name as creator_name, pr.username as creator_username, cp.status as creator_status,
  (select count(*) from public.earnings e where e.payout_request_id = p.id) as earning_rows,
  (select count(*) from public.submissions s where s.creator_id = p.creator_id and s.status = 'flagged') as creator_flagged,
  (select count(*) from public.disputes d where d.raised_by = p.creator_id and d.status in ('open','under_review')) as creator_open_disputes,
  (select coalesce(sum(x.amount), 0) from public.payout_requests x where x.creator_id = p.creator_id and x.status = 'paid') as creator_paid_total,
  (select coalesce(sum(e.amount), 0) from public.earnings e where e.payout_request_id = p.id) = p.amount as ledger_matches,
  exists (select 1 from public.audit_logs a where a.entity_type = 'creator_payout_methods' and a.action = 'creator_payout_methods.update'
          and a.actor_id = p.creator_id and a.created_at between p.created_at - interval '72 hours' and p.created_at) as method_changed_recently,
  p.fee, p.fee_pct, p.fee_tier, p.net_amount, p.bonus, p.bonus_pct,
  not private.names_match(p.payout_method ->> 'account_name', pr.full_name) as name_mismatch
from public.payout_requests p
left join public.profiles pr on pr.id = p.creator_id
left join public.creator_profiles cp on cp.user_id = p.creator_id;
grant select on public.admin_payouts to authenticated;

-- ─────────────────────────────── 3. real post time ───────────────────────────────
alter table public.submission_checks add column if not exists posted_at timestamptz;
alter table public.submission_checks add column if not exists posted_before_join boolean not null default false;

create or replace function private.check_posted_before_join() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare v_joined timestamptz;
begin
  if new.posted_at is null then new.posted_before_join := false; return new; end if;
  select m.joined_at into v_joined from public.submissions s join public.campaign_creators m on m.id = s.membership_id where s.id = new.submission_id;
  new.posted_before_join := v_joined is not null
    and new.posted_at < v_joined - make_interval(mins => public.setting_int('publish_grace_minutes')::int);
  return new;
end $$;
drop trigger if exists submission_checks_posted on public.submission_checks;
create trigger submission_checks_posted before insert or update of posted_at on public.submission_checks
  for each row execute function private.check_posted_before_join();

-- The automatic filter also holds clips posted before joining.
create or replace function private.auto_qualify_hold(s public.submissions, m public.content_metrics) returns text
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  cfg jsonb := coalesce((select value from public.app_settings where key = 'auto_qualify'), '{}'::jsonb);
  prev public.content_metrics; v_followers bigint; v_verified timestamptz; v_status public.creator_status;
  v_eng numeric; v_hours numeric; out text[] := '{}';
begin
  select status into v_status from public.creator_profiles where user_id = s.creator_id;
  if v_status is distinct from 'active' then out := array_append(out, 'akun creator tidak aktif'); end if;
  if s.content_state <> 'live' then out := array_append(out, 'postingan tidak tayang'); end if;
  select x.followers, x.verified_at into v_followers, v_verified from public.creator_platforms x
   where x.creator_id = s.creator_id and x.platform = s.platform order by x.verified_at desc nulls last, x.created_at limit 1;
  if coalesce((cfg->>'require_verified_account')::boolean, true) and v_verified is null then out := array_append(out, 'akun sosial belum diverifikasi'); end if;
  if m.views < s.qualified_views then out := array_append(out, 'views lebih kecil dari qualified sebelumnya'); end if;

  select * into prev from public.content_metrics where submission_id = s.id and captured_at < m.captured_at order by captured_at desc limit 1;
  if prev.id is not null then
    if m.views < prev.views then out := array_append(out, 'views turun dibanding data sebelumnya'); end if;
    v_hours := extract(epoch from (m.captured_at - prev.captured_at)) / 3600;
    if prev.views > 0 and m.views::numeric / prev.views >= coalesce((cfg->>'max_jump')::numeric, 10)
       and v_hours <= coalesce((cfg->>'jump_hours')::numeric, 24) then
      out := array_append(out, format('views naik %s× dalam %s jam', round(m.views::numeric / prev.views), greatest(1, round(v_hours))));
    end if;
  end if;
  if m.views >= coalesce((cfg->>'engagement_min_views')::bigint, 5000) then
    v_eng := (m.likes + m.comments + m.shares)::numeric / nullif(m.views, 0);
    if v_eng < coalesce((cfg->>'min_engagement')::numeric, 0.005) then out := array_append(out, format('engagement rendah (%s%%)', round(v_eng * 100, 2))); end if;
  end if;
  if v_followers > 0 and m.views::numeric / v_followers > coalesce((cfg->>'max_views_per_follower')::numeric, 50) then
    out := array_append(out, format('views %s× jumlah followers', round(m.views::numeric / v_followers)));
  end if;
  if exists (select 1 from public.submission_checks k where k.submission_id = s.id and k.posted_before_join) then
    out := array_append(out, 'diposting sebelum bergabung ke campaign');
  end if;
  return nullif(array_to_string(out, '; '), '');
end $$;

-- ─────────────────────────────── 4. automatic filter on ───────────────────────────────
update public.app_settings set value = jsonb_set(value, '{enabled}', 'true'::jsonb), updated_at = now() where key = 'auto_qualify';

-- ─────────────────────────────── 5. referral needs 3 accepted clips ───────────────────────────────
-- Reward once both hold: the invited creator's first withdrawal is paid and they have 3+ accepted clips.
create or replace function private.maybe_reward_referral(p_referee uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare v_ref uuid; v_amount bigint;
begin
  select referrer_id into v_ref from public.referrals where referee_id = p_referee;
  if v_ref is null or exists (select 1 from public.referral_rewards where referee_id = p_referee) then return; end if;
  if not exists (select 1 from public.payout_requests where creator_id = p_referee and status = 'paid') then return; end if;
  if (select count(*) from public.submissions where creator_id = p_referee and status in ('approved', 'tracking', 'completed')) < 3 then return; end if;
  v_amount := private.setting_num('referral_bonus_idr', 20000)::bigint;
  if v_amount <= 0 then return; end if;
  insert into public.referral_rewards (referrer_id, referee_id, amount) values (v_ref, p_referee, v_amount) on conflict (referee_id) do nothing;
  if found then
    perform public.notify(v_ref, 'referral', 'Bonus referral masuk',
      format('Teman yang kamu undang sudah aktif dan cair pertama kali. %s ikut ditambahkan di pencairanmu berikutnya.', public.format_idr(v_amount)),
      jsonb_build_object('amount', v_amount));
  end if;
end $$;
revoke execute on function private.maybe_reward_referral(uuid) from public, anon, authenticated;

create or replace function private.on_payout_referral() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  if new.status = 'paid' and old.status is distinct from 'paid' then
    perform private.maybe_reward_referral(new.creator_id);
  elsif new.status = 'rejected' and old.status is distinct from 'rejected' then
    update public.referral_rewards set status = 'available', payout_request_id = null where payout_request_id = new.id;
  end if;
  return new;
end $$;

-- A third accepted clip after the first paid withdrawal also completes the reward.
create or replace function private.on_submission_referral() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  if new.status in ('approved', 'tracking', 'completed') and old.status not in ('approved', 'tracking', 'completed') then
    perform private.maybe_reward_referral(new.creator_id);
  end if;
  return new;
end $$;
drop trigger if exists submissions_referral on public.submissions;
create trigger submissions_referral after update of status on public.submissions
  for each row execute function private.on_submission_referral();
