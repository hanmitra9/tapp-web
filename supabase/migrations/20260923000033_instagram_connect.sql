-- TAPP · 0033 · "Hubungkan dengan Instagram": same shape as the TikTok connect (0031).
--
-- Instagram API with Instagram Login (professional accounts: Business or Creator). Flow, in the Edge Function
-- supabase/functions/instagram-oauth: one-time state → Instagram login → code exchanged server-side for a
-- long-lived token (60 days, refreshed by fetch-metrics) → oauth_complete_instagram() verifies the account.
-- Views: fetch-metrics reads due_for_instagram_metrics() every 3 hours and records views/likes/comments/
-- shares/saves for the creator's own submitted posts and reels.
-- Off until the Meta app exists: app_settings.platform_oauth_config.instagram.enabled + function secrets
-- INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET.

set search_path = public, extensions;

update public.app_settings set value = jsonb_set(value, '{instagram}',
  coalesce(value->'instagram', '{}'::jsonb) || jsonb_build_object(
    'scopes', jsonb_build_array('instagram_business_basic', 'instagram_business_manage_insights'),
    'redirect_uri', 'https://njffqsbddzztfxxbavpp.supabase.co/functions/v1/instagram-oauth')), updated_at = now()
where key = 'platform_oauth_config';

-- Shared body for every "login = proof of ownership" connect. The TikTok entry point keeps its name and
-- behaviour (0031) and now calls this too.
create or replace function public.oauth_complete_account(
  p_creator uuid, p_platform public.platform, p_platform_user_id text, p_username text, p_followers integer,
  p_access_token text, p_refresh_token text, p_expires_in integer, p_scopes text[]
) returns public.creator_platforms
language plpgsql security definer set search_path = public, extensions as $$
declare
  c public.creator_platform_connections; r public.creator_platforms;
  v_handle text := lower(btrim(p_username, ' @'));
  v_label text := case p_platform when 'tiktok' then 'TikTok' when 'instagram' then 'Instagram' when 'youtube' then 'YouTube' else p_platform::text end;
  v_profile text := case p_platform when 'tiktok' then 'https://www.tiktok.com/@' when 'instagram' then 'https://www.instagram.com/' else null end;
begin
  if not exists (select 1 from public.creator_profiles where user_id = p_creator) then raise exception 'creator_profile_not_found'; end if;
  if v_handle is null or v_handle !~ '^[a-z0-9_.\-]{1,64}$' then raise exception '%_username_missing', p_platform; end if;
  if nullif(btrim(p_platform_user_id), '') is null then raise exception 'missing_platform_user_id'; end if;
  -- One account per TAPP creator (anti account-sharing).
  if exists (select 1 from public.creator_platforms where platform = p_platform and lower(handle) = v_handle and creator_id <> p_creator) then
    raise exception '%_account_taken', p_platform;
  end if;
  if exists (select 1 from public.creator_platform_connections where platform = p_platform and platform_user_id = p_platform_user_id
             and creator_id <> p_creator and status = 'connected') then
    raise exception '%_account_taken', p_platform;
  end if;

  insert into public.creator_platform_connections (creator_id, platform, platform_user_id, handle, status, scopes, token_expires_at)
  values (p_creator, p_platform, p_platform_user_id, v_handle, 'connected', coalesce(p_scopes, '{}'), now() + make_interval(secs => coalesce(p_expires_in, 86400)))
  on conflict (creator_id, platform) do update set platform_user_id = excluded.platform_user_id, handle = excluded.handle, status = 'connected',
    scopes = excluded.scopes, token_expires_at = excluded.token_expires_at, last_error = null, revoked_at = null, connected_at = now()
  returning * into c;
  perform public.update_platform_token(c.id, p_access_token, p_refresh_token, p_expires_in);

  select * into r from public.creator_platforms where creator_id = p_creator and platform = p_platform order by created_at limit 1;
  if r.id is null then
    insert into public.creator_platforms (creator_id, platform, handle, profile_url, followers, verified_at)
    values (p_creator, p_platform, v_handle, v_profile || v_handle, p_followers, now()) returning * into r;
  else
    update public.creator_platforms set handle = v_handle, profile_url = coalesce(v_profile || v_handle, profile_url),
      followers = coalesce(p_followers, followers), verified_at = now()
    where id = r.id returning * into r;
  end if;

  perform public.write_audit('creator.platform_connected', 'creator_platform_connection', c.id, null,
    jsonb_build_object('platform', p_platform, 'handle', v_handle, 'verified', true, 'via', 'oauth'));
  perform public.notify(p_creator, 'platform_verified', format('Akun %s terverifikasi', v_label),
    format('@%s terhubung. Views klip %s-mu sekarang tercatat otomatis.', v_handle, v_label), jsonb_build_object('platform', p_platform));
  return r;
end $$;
revoke execute on function public.oauth_complete_account(uuid, public.platform, text, text, integer, text, text, integer, text[]) from public, anon, authenticated;
grant execute on function public.oauth_complete_account(uuid, public.platform, text, text, integer, text, text, integer, text[]) to service_role;

create or replace function public.oauth_complete_tiktok(
  p_creator uuid, p_open_id text, p_username text, p_followers integer,
  p_access_token text, p_refresh_token text, p_expires_in integer, p_scopes text[]
) returns public.creator_platforms
language sql security definer set search_path = public, extensions as $$
  select public.oauth_complete_account(p_creator, 'tiktok', p_open_id, p_username, p_followers, p_access_token, p_refresh_token, p_expires_in, p_scopes)
$$;

-- Instagram issues a single long-lived token (no refresh token); fetch-metrics refreshes it before it lapses.
create or replace function public.oauth_complete_instagram(
  p_creator uuid, p_ig_user_id text, p_username text, p_followers integer,
  p_access_token text, p_expires_in integer, p_scopes text[]
) returns public.creator_platforms
language sql security definer set search_path = public, extensions as $$
  select public.oauth_complete_account(p_creator, 'instagram', p_ig_user_id, p_username, p_followers, p_access_token, null, p_expires_in, p_scopes)
$$;
revoke execute on function public.oauth_complete_instagram(uuid, text, text, integer, text, integer, text[]) from public, anon, authenticated;
grant execute on function public.oauth_complete_instagram(uuid, text, text, integer, text, integer, text[]) to service_role;

-- Instagram work queue: the creator's own approved/tracking posts and reels, by shortcode.
create or replace function public.due_for_instagram_metrics(p_min_interval_minutes integer default 170, p_limit integer default 500)
returns table (submission_id uuid, connection_id uuid, shortcode text, last_views bigint)
language sql stable security definer set search_path = public, extensions as $$
  select s.id, c.id, substring(s.normalized_url from '^instagram\.com/(?:p|reel|tv)/([A-Za-z0-9_-]+)'),
         (select m.views from public.content_metrics m where m.submission_id = s.id order by m.captured_at desc limit 1)
  from public.submissions s
  join public.creator_platform_connections c on c.creator_id = s.creator_id and c.platform = 'instagram' and c.status = 'connected'
  where s.platform = 'instagram' and s.status in ('approved', 'tracking')
    and s.normalized_url ~ '^instagram\.com/(p|reel|tv)/[A-Za-z0-9_-]+'
    and (s.last_metrics_at is null or s.last_metrics_at < now() - make_interval(mins => p_min_interval_minutes))
  order by c.id, s.last_metrics_at asc nulls first
  limit p_limit
$$;
revoke execute on function public.due_for_instagram_metrics(integer, integer) from public, anon, authenticated;
grant execute on function public.due_for_instagram_metrics(integer, integer) to service_role;
