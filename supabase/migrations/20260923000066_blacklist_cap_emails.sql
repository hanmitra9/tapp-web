-- TAPP · 0066 · Blacklist, per-withdrawal cap, clip status emails.
--
-- 1. Blacklist (like konten.com): permanent list of identities — email, social handle, payout account number — of
--    creators caught cheating. Blocked identities can't sign up, link a social account, add a payout method, submit or
--    withdraw. Admin blacklists a creator in one step (all their identities + banned); entries can be removed on appeal.
-- 2. Per-withdrawal cap by rank (app_settings.max_payout_idr): a withdrawal takes the oldest available earnings up to
--    the cap; the rest stays for the next withdrawal.
-- 3. Emails when a clip is approved, needs changes, or is rejected.

set search_path = public, extensions;

-- ─────────────────────────────── 1. Blacklist ───────────────────────────────
create table if not exists public.blocklist (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('email', 'social', 'account')),
  value text not null,
  reason text,
  creator_id uuid,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  unique (kind, value)
);
alter table public.blocklist enable row level security;
drop policy if exists blocklist_admin on public.blocklist;
create policy blocklist_admin on public.blocklist for select to authenticated using (public.is_admin());

create or replace function private.norm_identity(p_kind text, p_value text) returns text
language sql immutable set search_path = pg_catalog as $$
  select case p_kind when 'account' then regexp_replace(coalesce(p_value, ''), '[^0-9]', '', 'g')
                     when 'social' then lower(ltrim(btrim(coalesce(p_value, '')), '@'))
                     else lower(btrim(coalesce(p_value, ''))) end
$$;

create or replace function private.is_blocked(p_kind text, p_value text) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select exists (select 1 from public.blocklist where kind = p_kind and value = private.norm_identity(p_kind, p_value))
$$;

-- Any of the user's identities on the list → refuse.
create or replace function private.assert_not_blocked(p_uid uuid) returns void
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if exists (select 1 from auth.users u where u.id = p_uid and private.is_blocked('email', u.email))
     or exists (select 1 from public.creator_platforms p where p.creator_id = p_uid and private.is_blocked('social', p.handle))
     or exists (select 1 from public.creator_payout_methods m where m.creator_id = p_uid and private.is_blocked('account', m.account_number)) then
    raise exception 'identity_blocked';
  end if;
end $$;

create or replace function private.block_new_user() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  if private.is_blocked('email', new.email) then raise exception 'identity_blocked'; end if;
  return new;
end $$;
drop trigger if exists on_auth_user_blocklist on auth.users;
create trigger on_auth_user_blocklist before insert on auth.users for each row execute function private.block_new_user();

create or replace function private.block_handle() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  if private.is_blocked('social', new.handle) then raise exception 'identity_blocked'; end if;
  return new;
end $$;
create or replace function private.block_account() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  if private.is_blocked('account', new.account_number) then raise exception 'identity_blocked'; end if;
  return new;
end $$;
create or replace function private.block_submitter() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform private.assert_not_blocked(new.creator_id);
  return new;
end $$;
drop trigger if exists creator_platforms_blocklist on public.creator_platforms;
create trigger creator_platforms_blocklist before insert or update of handle on public.creator_platforms for each row execute function private.block_handle();
drop trigger if exists payout_methods_blocklist on public.creator_payout_methods;
create trigger payout_methods_blocklist before insert or update of account_number on public.creator_payout_methods for each row execute function private.block_account();
drop trigger if exists submissions_blocklist on public.submissions;
create trigger submissions_blocklist before insert on public.submissions for each row execute function private.block_submitter();

-- Blacklist a creator: every identity they used + banned.
create or replace function public.admin_blacklist_creator(p_user_id uuid, p_reason text) returns integer
language plpgsql security definer set search_path = public, extensions as $$
declare v_admin uuid := public.assert_admin(); v_n int;
begin
  if nullif(btrim(p_reason), '') is null then raise exception 'reason_required'; end if;
  with ids as (
    select 'email' as kind, private.norm_identity('email', u.email) as value from auth.users u where u.id = p_user_id and u.email is not null
    union select 'social', private.norm_identity('social', p.handle) from public.creator_platforms p where p.creator_id = p_user_id
    union select 'account', private.norm_identity('account', m.account_number) from public.creator_payout_methods m where m.creator_id = p_user_id
  ), ins as (
    insert into public.blocklist (kind, value, reason, creator_id, created_by)
    select kind, value, btrim(p_reason), p_user_id, v_admin from ids where value <> ''
    on conflict (kind, value) do nothing returning 1
  ) select count(*) into v_n from ins;
  update public.creator_profiles set status = 'banned', status_reason = btrim(p_reason) where user_id = p_user_id;
  perform public.write_audit('creator.blacklist', 'creator_profile', p_user_id, null, jsonb_build_object('reason', btrim(p_reason), 'identities', v_n));
  return v_n;
end $$;

create or replace function public.admin_blocklist_add(p_kind text, p_value text, p_reason text) returns public.blocklist
language plpgsql security definer set search_path = public, extensions as $$
declare v_admin uuid := public.assert_admin(); r public.blocklist; v text := private.norm_identity(p_kind, p_value);
begin
  if p_kind not in ('email', 'social', 'account') or v = '' then raise exception 'invalid_identity'; end if;
  insert into public.blocklist (kind, value, reason, created_by) values (p_kind, v, nullif(btrim(p_reason), ''), v_admin)
  on conflict (kind, value) do update set reason = coalesce(excluded.reason, public.blocklist.reason) returning * into r;
  perform public.write_audit('blocklist.add', 'blocklist', r.id, null, to_jsonb(r));
  return r;
end $$;

create or replace function public.admin_blocklist_remove(p_id uuid, p_note text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare v_admin uuid := public.assert_admin(); r public.blocklist;
begin
  select * into r from public.blocklist where id = p_id;
  if not found then raise exception 'not_found'; end if;
  delete from public.blocklist where id = p_id;
  perform public.write_audit('blocklist.remove', 'blocklist', p_id, to_jsonb(r), jsonb_build_object('note', nullif(btrim(p_note), '')));
end $$;

revoke execute on function public.admin_blacklist_creator(uuid, text) from public, anon;
revoke execute on function public.admin_blocklist_add(text, text, text) from public, anon;
revoke execute on function public.admin_blocklist_remove(uuid, text) from public, anon;
grant execute on function public.admin_blacklist_creator(uuid, text), public.admin_blocklist_add(text, text, text),
  public.admin_blocklist_remove(uuid, text) to authenticated;

-- ─────────────────────────────── 2. Withdrawal cap ───────────────────────────────
insert into public.app_settings (key, value) values
  ('max_payout_idr', '{"new": 5000000, "rising": 10000000, "verified": 25000000, "proven": 50000000, "elite": 100000000}'::jsonb)
on conflict (key) do nothing;

drop policy if exists app_settings_read on public.app_settings;
create policy app_settings_read on public.app_settings for select to authenticated
  using (key in ('earnings_hold_days','min_payout_idr','max_submissions_per_day','publish_grace_minutes','view_milestones',
                 'platform_oauth_config','withdrawal_fee_pct','tier_bonus_pct','withdrawal_fee_idr','creator_fee_pct',
                 'tier_thresholds','tier_requirements','referral_bonus_idr','vapid_public_key','max_payout_idr'));

create or replace function public.request_payout(p_idempotency_key uuid) returns public.payout_requests
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_uid uuid := auth.uid(); v_status public.creator_status; v_tier public.creator_tier; r public.payout_requests;
  v_ids uuid[]; v_amount bigint; v_pct numeric; v_fee bigint; v_bpct numeric; v_bonus bigint; v_ref bigint; v_ref_ids uuid[];
  pm public.creator_payout_methods; v_cap bigint;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  perform private.assert_not_blocked(v_uid);
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
  -- Oldest earnings first, up to the per-withdrawal cap for the creator's rank (the first row always fits).
  v_cap := coalesce((select (value ->> coalesce(v_tier, 'new')::text)::bigint from public.app_settings where key = 'max_payout_idr'), 9223372036854775807);
  perform 1 from public.earnings where creator_id = v_uid and status = 'available' and payout_request_id is null for update;
  select array_agg(id), coalesce(sum(amount), 0) into v_ids, v_amount
  from (select id, amount, sum(amount) over (order by available_at, created_at, id) as run, row_number() over (order by available_at, created_at, id) as n
        from public.earnings where creator_id = v_uid and status = 'available' and payout_request_id is null) e
  where e.run <= v_cap or e.n = 1;
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

-- ─────────────────────────────── 3. Clip status emails ───────────────────────────────
create or replace function private.ev_clip_status_email() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare v_email text; v_title text; v_app text; v_type text;
begin
  if new.status is not distinct from old.status then return new; end if;
  v_type := case when new.status in ('approved', 'tracking', 'completed') and old.status in ('pending_review', 'needs_changes', 'flagged') then 'clip_approved'
                 when new.status = 'needs_changes' then 'clip_needs_changes'
                 when new.status = 'rejected' then 'clip_rejected' end;
  if v_type is null then return new; end if;
  select email into v_email from auth.users where id = new.creator_id;
  select title into v_title from public.campaigns where id = new.campaign_id;
  perform public.send_app_email(v_type, v_email, jsonb_build_object('campaign', v_title, 'platform', new.platform, 'url', new.post_url,
    'reason', new.review_reason), 'clip:' || new.id || ':' || new.status);
  return new;
end $$;
drop trigger if exists submissions_status_email on public.submissions;
create trigger submissions_status_email after update of status on public.submissions for each row execute function private.ev_clip_status_email();
