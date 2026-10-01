-- TAPP · 0017 · Brand portal V1: invite-only access + performance reports (read-only)

set search_path = public, extensions;

-- ─────────────────────────────── Invitations ─────────────────────────
-- Admin invites an email to a brand. The person signs up (or logs in) with that email; once the email is
-- verified, claim_brand_invites() turns the account into a brand account and adds the membership.
create table if not exists public.brand_invites (
  id           uuid primary key default gen_random_uuid(),
  brand_id     uuid not null references public.brands(id) on delete cascade,
  email        citext not null check (email::text ~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$'),
  role         text not null default 'member' check (role in ('owner','member','viewer')),
  invited_by   uuid references public.profiles(id),
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default now() + interval '14 days',
  accepted_at  timestamptz,
  accepted_by  uuid references public.profiles(id),
  revoked_at   timestamptz
);
create unique index if not exists brand_invites_open_key on public.brand_invites(brand_id, email)
  where accepted_at is null and revoked_at is null;
create index if not exists brand_invites_email_idx on public.brand_invites(email) where accepted_at is null and revoked_at is null;
alter table public.brand_invites enable row level security;
revoke all on public.brand_invites from anon, authenticated;
grant select on public.brand_invites to authenticated;
drop policy if exists brand_invites_admin on public.brand_invites;
create policy brand_invites_admin on public.brand_invites for select to authenticated using (public.is_admin());

create or replace function public.admin_invite_brand_member(p_brand_id uuid, p_email text, p_role text default 'member')
returns public.brand_invites
language plpgsql security definer set search_path = public, extensions as $$
declare v_admin uuid := public.assert_admin(); r public.brand_invites; v_email text := lower(btrim(p_email));
begin
  if not exists (select 1 from public.brands where id = p_brand_id) then raise exception 'brand_not_found'; end if;
  if v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' then raise exception 'invalid_email'; end if;
  if p_role not in ('owner','member','viewer') then raise exception 'invalid_role'; end if;
  if exists (select 1 from public.brand_members bm join auth.users u on u.id = bm.user_id
             where bm.brand_id = p_brand_id and lower(u.email) = v_email) then raise exception 'already_member'; end if;
  -- Re-inviting refreshes the open invite instead of failing.
  update public.brand_invites set role = p_role, expires_at = now() + interval '14 days', invited_by = v_admin
  where brand_id = p_brand_id and email = v_email::citext and accepted_at is null and revoked_at is null
  returning * into r;
  if r.id is null then
    insert into public.brand_invites (brand_id, email, role, invited_by) values (p_brand_id, v_email, p_role, v_admin) returning * into r;
  end if;
  perform public.write_audit('brand.invite', 'brand', p_brand_id, null, jsonb_build_object('email', v_email, 'role', p_role));
  return r;
end $$;

create or replace function public.admin_revoke_brand_invite(p_invite_id uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare v_admin uuid := public.assert_admin(); r public.brand_invites;
begin
  update public.brand_invites set revoked_at = now() where id = p_invite_id and accepted_at is null and revoked_at is null returning * into r;
  if r.id is null then raise exception 'invite_not_found'; end if;
  perform public.write_audit('brand.invite_revoke', 'brand', r.brand_id, null, jsonb_build_object('email', r.email));
end $$;

create or replace function public.admin_remove_brand_member(p_brand_id uuid, p_user_id uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare v_admin uuid := public.assert_admin();
begin
  delete from public.brand_members where brand_id = p_brand_id and user_id = p_user_id;
  if not found then raise exception 'member_not_found'; end if;
  perform public.write_audit('brand.member_remove', 'brand', p_brand_id, jsonb_build_object('user_id', p_user_id), null);
end $$;

-- Called by the app after sign-in. Only a VERIFIED email can claim, so nobody can take an invite by
-- registering someone else's address.
create or replace function public.claim_brand_invites() returns integer
language plpgsql security definer set search_path = public, extensions as $$
declare v_uid uuid := auth.uid(); v_email text; v_confirmed timestamptz; n integer := 0; inv record;
begin
  if v_uid is null then return 0; end if;
  select lower(email), email_confirmed_at into v_email, v_confirmed from auth.users where id = v_uid;
  if v_email is null or v_confirmed is null then return 0; end if;
  for inv in select * from public.brand_invites
             where email = v_email::citext and accepted_at is null and revoked_at is null and expires_at > now() for update loop
    insert into public.brand_members (brand_id, user_id, role) values (inv.brand_id, v_uid, inv.role)
      on conflict (brand_id, user_id) do update set role = excluded.role;
    update public.brand_invites set accepted_at = now(), accepted_by = v_uid where id = inv.id;
    perform public.write_audit('brand.invite_accept', 'brand', inv.brand_id, null, jsonb_build_object('email', v_email, 'role', inv.role));
    n := n + 1;
  end loop;
  if n > 0 then update public.profiles set role = 'brand' where id = v_uid and role = 'creator'; end if;
  return n;
end $$;

-- ─────────────────────────────── Brand reports (read-only) ───────────
-- All report RPCs are scoped to campaigns of brands the caller belongs to (admins see everything).
create or replace function private.my_brand_campaign_ids() returns setof uuid
language sql stable security definer set search_path = public, extensions as $$
  select c.id from public.campaigns c
  where public.is_admin() or exists (select 1 from public.brand_members bm where bm.brand_id = c.brand_id and bm.user_id = auth.uid())
$$;
revoke execute on function private.my_brand_campaign_ids() from public, anon;
grant execute on function private.my_brand_campaign_ids() to authenticated;

create or replace function public.brand_campaigns()
returns table (
  id uuid, brand_id uuid, brand_name text, title text, category text, status public.campaign_status,
  cpm bigint, budget bigint, spent bigint, remaining bigint, starts_at timestamptz, ends_at timestamptz,
  submission_deadline timestamptz, platforms text[], creators_joined bigint, submissions bigint, approved bigint,
  qualified_views bigint, raw_views bigint
)
language sql stable security definer set search_path = public, extensions as $$
  select c.id, c.brand_id, b.name, c.title, c.category, c.status, c.cpm, c.budget, c.earned, greatest(c.budget - c.earned, 0),
    c.starts_at, c.ends_at, c.submission_deadline,
    array(select k.platform::text from public.campaign_platforms k where k.campaign_id = c.id order by 1),
    (select count(*) from public.campaign_creators m where m.campaign_id = c.id and m.status = 'joined'),
    (select count(*) from public.submissions s where s.campaign_id = c.id),
    (select count(*) from public.submissions s where s.campaign_id = c.id and s.status in ('approved','tracking','completed')),
    (select coalesce(sum(s.qualified_views), 0) from public.submissions s where s.campaign_id = c.id)::bigint,
    (select coalesce(sum(lm.views), 0) from public.submissions s
       left join lateral (select views from public.content_metrics m where m.submission_id = s.id order by captured_at desc limit 1) lm on true
      where s.campaign_id = c.id)::bigint
  from public.campaigns c join public.brands b on b.id = c.brand_id
  where c.id in (select private.my_brand_campaign_ids()) and c.status <> 'draft'
  order by case c.status when 'active' then 0 when 'ending' then 1 when 'paused' then 2 else 3 end, c.created_at desc
$$;

-- Daily qualified-view gains and spend for one campaign (or all of mine when null).
create or replace function public.brand_daily(p_campaign_id uuid default null, p_days integer default 30, p_tz text default 'Asia/Jakarta')
returns table (day date, qualified_gain bigint, spend bigint)
language plpgsql stable security definer set search_path = public, extensions as $$
declare v_tz text := case when exists (select 1 from pg_timezone_names where name = p_tz) then p_tz else 'Asia/Jakarta' end;
        v_days integer := least(greatest(coalesce(p_days, 30), 7), 180);
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if p_campaign_id is not null and p_campaign_id not in (select private.my_brand_campaign_ids()) then raise exception 'forbidden'; end if;
  return query
  with days as (
    select generate_series((now() at time zone v_tz)::date - (v_days - 1), (now() at time zone v_tz)::date, interval '1 day')::date as d
  ), agg as (
    select (e.created_at at time zone v_tz)::date as d, sum(e.qualified_views_delta)::bigint as q, sum(e.amount)::bigint as a
    from public.earnings e
    where e.campaign_id in (select private.my_brand_campaign_ids())
      and (p_campaign_id is null or e.campaign_id = p_campaign_id)
      and e.created_at >= now() - make_interval(days => v_days + 1)
    group by 1
  )
  select days.d, coalesce(agg.q, 0), coalesce(agg.a, 0) from days left join agg on agg.d = days.d order by days.d;
end $$;

-- Best-performing clips for a campaign — the creator-performance part of the brand report.
create or replace function public.brand_top_clips(p_campaign_id uuid, p_limit integer default 20)
returns table (submission_id uuid, creator_username text, platform public.platform, post_url text, status public.submission_status,
               published_at timestamptz, raw_views bigint, qualified_views bigint, spend bigint)
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if p_campaign_id not in (select private.my_brand_campaign_ids()) then raise exception 'forbidden'; end if;
  return query
  select s.id, p.username::text, s.platform, s.post_url, s.status, s.published_at,
    coalesce(lm.views, 0)::bigint, s.qualified_views, s.earned
  from public.submissions s
  left join public.profiles p on p.id = s.creator_id
  left join lateral (select views from public.content_metrics m where m.submission_id = s.id order by captured_at desc limit 1) lm on true
  where s.campaign_id = p_campaign_id and s.status in ('approved','tracking','completed')
  order by s.qualified_views desc, s.created_at desc
  limit least(greatest(coalesce(p_limit, 20), 1), 100);
end $$;

create or replace function public.my_brands() returns table (id uuid, name text, logo_url text, role text)
language sql stable security definer set search_path = public, extensions as $$
  select b.id, b.name, b.logo_url, bm.role from public.brand_members bm join public.brands b on b.id = bm.brand_id
  where bm.user_id = auth.uid() order by b.name
$$;

-- Admin: members + open invites for one brand (reads auth.users emails, so admin-only definer function).
create or replace function public.admin_brand_people(p_brand_id uuid)
returns table (kind text, user_id uuid, email text, role text, created_at timestamptz, invite_id uuid, expires_at timestamptz)
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.assert_admin();
  return query
  select 'member'::text, bm.user_id, u.email::text, bm.role, bm.created_at, null::uuid, null::timestamptz
  from public.brand_members bm left join auth.users u on u.id = bm.user_id where bm.brand_id = p_brand_id
  union all
  select 'invite', null::uuid, i.email::text, i.role, i.created_at, i.id, i.expires_at
  from public.brand_invites i where i.brand_id = p_brand_id and i.accepted_at is null and i.revoked_at is null
  order by 5 desc;
end $$;

revoke execute on function public.admin_invite_brand_member(uuid, text, text), public.admin_revoke_brand_invite(uuid),
  public.admin_remove_brand_member(uuid, uuid), public.claim_brand_invites(), public.brand_campaigns(),
  public.brand_daily(uuid, integer, text), public.brand_top_clips(uuid, integer), public.my_brands(), public.admin_brand_people(uuid) from public, anon;
grant execute on function public.admin_invite_brand_member(uuid, text, text), public.admin_revoke_brand_invite(uuid),
  public.admin_remove_brand_member(uuid, uuid), public.claim_brand_invites(), public.brand_campaigns(),
  public.brand_daily(uuid, integer, text), public.brand_top_clips(uuid, integer), public.my_brands(), public.admin_brand_people(uuid) to authenticated;
