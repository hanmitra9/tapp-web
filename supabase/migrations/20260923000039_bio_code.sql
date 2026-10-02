-- TAPP · 0039 · Verify a TikTok / Instagram account with a code in its bio.
--
-- The creator asks for a code (TAPP-XXXXXX), puts it in the bio of the linked account and taps "Cek bio".
-- The bio-check Edge Function reads the public profile: code found → the account is verified right away.
-- When the platform can't be read automatically (blocked / login wall), or the creator asks for it, the account
-- goes to the admin queue (admin_bio_reviews) and an admin checks the bio by hand.
-- After verification the creator may remove the code from the bio.

set search_path = public, extensions;

alter table public.creator_platforms
  add column if not exists bio_code       text,
  add column if not exists bio_code_at    timestamptz,
  add column if not exists bio_status     text,
  add column if not exists bio_checked_at timestamptz,
  add column if not exists bio_note       text;
alter table public.creator_platforms drop constraint if exists creator_platforms_bio_status;
alter table public.creator_platforms add constraint creator_platforms_bio_status
  check (bio_status is null or bio_status in ('code_issued', 'not_found', 'review', 'verified', 'rejected'));
create unique index if not exists creator_platforms_bio_code_key on public.creator_platforms(bio_code) where bio_code is not null;

-- Creator: get (or reuse) the code for one of their unverified TikTok / Instagram accounts.
create or replace function public.bio_code_issue(p_platform_id uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare x public.creator_platforms; v_code text; v_alpha constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; i int;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select * into x from public.creator_platforms where id = p_platform_id and creator_id = auth.uid() for update;
  if not found then raise exception 'platform_not_found'; end if;
  if x.platform not in ('tiktok', 'instagram') then raise exception 'bio_code_unsupported_platform'; end if;
  if x.verified_at is not null then raise exception 'already_verified'; end if;
  if x.bio_code is not null and x.bio_code_at > now() - interval '7 days' then
    return jsonb_build_object('code', x.bio_code, 'status', x.bio_status, 'handle', x.handle, 'platform', x.platform);
  end if;
  loop
    v_code := 'TAPP-';
    for i in 1..6 loop v_code := v_code || substr(v_alpha, 1 + (get_byte(gen_random_bytes(1), 0) % length(v_alpha)), 1); end loop;
    exit when not exists (select 1 from public.creator_platforms where bio_code = v_code);
  end loop;
  update public.creator_platforms set bio_code = v_code, bio_code_at = now(), bio_status = 'code_issued', bio_note = null where id = x.id;
  return jsonb_build_object('code', v_code, 'status', 'code_issued', 'handle', x.handle, 'platform', x.platform);
end $$;
revoke execute on function public.bio_code_issue(uuid) from public, anon;
grant execute on function public.bio_code_issue(uuid) to authenticated;

-- Creator: "Minta cek manual" — send the account to the admin queue.
create or replace function public.bio_code_request_review(p_platform_id uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  update public.creator_platforms set bio_status = 'review', bio_note = 'Diminta kreator'
  where id = p_platform_id and creator_id = auth.uid() and bio_code is not null and verified_at is null;
  if not found then raise exception 'platform_not_found'; end if;
end $$;
revoke execute on function public.bio_code_request_review(uuid) from public, anon;
grant execute on function public.bio_code_request_review(uuid) to authenticated;

-- Shared: mark an account verified via its bio code.
create or replace function private.bio_verify(p_platform_id uuid, p_actor uuid, p_note text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare x public.creator_platforms; v_label text;
begin
  select * into x from public.creator_platforms where id = p_platform_id for update;
  if not found then raise exception 'platform_not_found'; end if;
  update public.creator_platforms set verified_at = coalesce(verified_at, now()), bio_status = 'verified', bio_checked_at = now(), bio_note = p_note
  where id = x.id;
  v_label := case x.platform when 'tiktok' then 'TikTok' when 'instagram' then 'Instagram' else x.platform::text end;
  perform public.write_audit('platform.verify', 'creator_platform', x.id, jsonb_build_object('verified_at', x.verified_at),
    jsonb_build_object('via', 'bio_code', 'code', x.bio_code), jsonb_build_object('creator_id', x.creator_id, 'platform', x.platform, 'handle', x.handle, 'actor', p_actor));
  perform public.notify(x.creator_id, 'platform_verified', format('Akun %s terverifikasi', v_label),
    format('@%s sudah terverifikasi lewat kode bio. Kodenya boleh dihapus dari bio sekarang.', x.handle), jsonb_build_object('platform', x.platform));
end $$;
revoke execute on function private.bio_verify(uuid, uuid, text) from public, anon, authenticated;

-- bio-check Edge Function (service role): result of reading the public profile.
--   p_result: 'found' → verified · 'missing' → creator retries · 'unreadable' → admin queue
create or replace function public.bio_code_result(p_platform_id uuid, p_result text, p_note text default null) returns text
language plpgsql security definer set search_path = public, extensions as $$
begin
  if p_result = 'found' then
    perform private.bio_verify(p_platform_id, null, 'Terdeteksi otomatis');
    return 'verified';
  end if;
  update public.creator_platforms set bio_checked_at = now(), bio_note = p_note,
    bio_status = case when p_result = 'unreadable' then 'review' else 'not_found' end
  where id = p_platform_id and verified_at is null;
  return case when p_result = 'unreadable' then 'review' else 'not_found' end;
end $$;
revoke execute on function public.bio_code_result(uuid, text, text) from public, anon, authenticated;
grant execute on function public.bio_code_result(uuid, text, text) to service_role;

-- Admin: decide a manual review.
create or replace function public.admin_review_bio(p_platform_id uuid, p_ok boolean, p_note text default null) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare v_admin uuid := public.assert_admin(); x public.creator_platforms;
begin
  select * into x from public.creator_platforms where id = p_platform_id;
  if not found then raise exception 'platform_not_found'; end if;
  if p_ok then
    perform private.bio_verify(x.id, v_admin, coalesce(nullif(btrim(p_note), ''), 'Dicek manual oleh admin'));
  else
    if nullif(btrim(p_note), '') is null then raise exception 'reason_required'; end if;
    update public.creator_platforms set bio_status = 'rejected', bio_note = btrim(p_note), bio_checked_at = now() where id = x.id;
    perform public.notify(x.creator_id, 'platform_rejected', 'Kode bio belum ditemukan',
      format('@%s: %s', x.handle, btrim(p_note)), jsonb_build_object('platform', x.platform));
    perform public.write_audit('platform.bio_rejected', 'creator_platform', x.id, null, jsonb_build_object('note', p_note), '{}'::jsonb);
  end if;
end $$;
revoke execute on function public.admin_review_bio(uuid, boolean, text) from public, anon;
grant execute on function public.admin_review_bio(uuid, boolean, text) to authenticated;

-- Admin queue.
create or replace view public.admin_bio_reviews with (security_invoker = true) as
select x.id, x.creator_id, x.platform, x.handle, x.profile_url, x.followers, x.bio_code, x.bio_status, x.bio_note, x.bio_checked_at, x.bio_code_at,
  p.full_name, p.username
from public.creator_platforms x
left join public.profiles p on p.id = x.creator_id
where x.bio_status = 'review' and x.verified_at is null;
grant select on public.admin_bio_reviews to authenticated;
