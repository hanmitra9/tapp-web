-- TAPP · 0077 · In-app announcements.
-- The admin writes a short banner (title, text, optional button) for creators, brands or both, with an optional
-- start/end time. The app shows active ones at the top of the home screen; each person can close a banner
-- (remembered on their device).

set search_path = public, extensions;

create table if not exists public.announcements (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (length(btrim(title)) between 1 and 80),
  body        text not null default '' check (length(body) <= 280),
  cta_label   text check (cta_label is null or length(btrim(cta_label)) between 1 and 30),
  cta_url     text check (cta_url is null or cta_url ~ '^(https://|/)'),
  tone        text not null default 'info' check (tone in ('info', 'success', 'warning')),
  audience    text not null default 'creator' check (audience in ('creator', 'brand', 'all')),
  starts_at   timestamptz not null default now(),
  ends_at     timestamptz,
  active      boolean not null default true,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint announcements_window check (ends_at is null or ends_at > starts_at),
  constraint announcements_cta check ((cta_label is null) = (cta_url is null))
);
alter table public.announcements enable row level security;
revoke all on public.announcements from anon, authenticated;

-- What the signed-in person should see now (creators: creator/all; brand members: brand/all). Newest first, max 3.
create or replace function public.my_announcements() returns table (id uuid, title text, body text, cta_label text, cta_url text, tone text)
language plpgsql stable security definer set search_path = public, extensions as $$
declare v_uid uuid := auth.uid(); v_brand boolean; v_creator boolean;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  v_brand := exists (select 1 from public.brand_members where user_id = v_uid);
  v_creator := exists (select 1 from public.creator_profiles where user_id = v_uid);
  return query
  select a.id, a.title, a.body, a.cta_label, a.cta_url, a.tone from public.announcements a
  where a.active and a.starts_at <= now() and (a.ends_at is null or a.ends_at > now())
    and (a.audience = 'all' or (a.audience = 'brand' and v_brand) or (a.audience = 'creator' and v_creator))
  order by a.starts_at desc limit 3;
end $$;
revoke execute on function public.my_announcements() from public, anon;
grant execute on function public.my_announcements() to authenticated;

create or replace function public.admin_announcements() returns setof public.announcements
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.assert_admin();
  return query select * from public.announcements order by created_at desc limit 100;
end $$;

create or replace function public.admin_upsert_announcement(p jsonb) returns public.announcements
language plpgsql security definer set search_path = public, extensions as $$
declare v_admin uuid := public.assert_admin(); r public.announcements; v_id uuid := nullif(p->>'id', '')::uuid;
  v_label text := nullif(btrim(p->>'cta_label'), ''); v_url text := nullif(btrim(p->>'cta_url'), '');
begin
  if nullif(btrim(p->>'title'), '') is null then raise exception 'title_required'; end if;
  if (v_label is null) <> (v_url is null) then raise exception 'cta_incomplete'; end if;
  if v_url is not null and v_url !~ '^(https://|/)' then raise exception 'cta_url_invalid'; end if;
  if v_id is null then
    insert into public.announcements (title, body, cta_label, cta_url, tone, audience, starts_at, ends_at, active, created_by)
    values (btrim(p->>'title'), coalesce(btrim(p->>'body'), ''), v_label, v_url, coalesce(p->>'tone', 'info'), coalesce(p->>'audience', 'creator'),
            coalesce((p->>'starts_at')::timestamptz, now()), nullif(p->>'ends_at', '')::timestamptz, coalesce((p->>'active')::boolean, true), v_admin)
    returning * into r;
  else
    update public.announcements set title = btrim(p->>'title'), body = coalesce(btrim(p->>'body'), ''), cta_label = v_label, cta_url = v_url,
      tone = coalesce(p->>'tone', tone), audience = coalesce(p->>'audience', audience),
      starts_at = coalesce((p->>'starts_at')::timestamptz, starts_at), ends_at = nullif(p->>'ends_at', '')::timestamptz,
      active = coalesce((p->>'active')::boolean, active), updated_at = now()
    where id = v_id returning * into r;
    if r.id is null then raise exception 'announcement_not_found'; end if;
  end if;
  perform public.write_audit('announcement.upsert', 'announcement', r.id, null, to_jsonb(r));
  return r;
end $$;

create or replace function public.admin_delete_announcement(p_id uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.assert_admin();
  delete from public.announcements where id = p_id;
  perform public.write_audit('announcement.delete', 'announcement', p_id, null, null);
end $$;
revoke execute on function public.admin_announcements(), public.admin_upsert_announcement(jsonb), public.admin_delete_announcement(uuid) from public, anon;
grant execute on function public.admin_announcements(), public.admin_upsert_announcement(jsonb), public.admin_delete_announcement(uuid) to authenticated;
