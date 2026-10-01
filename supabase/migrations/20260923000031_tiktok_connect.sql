-- TAPP · 0031 · "Hubungkan dengan TikTok": OAuth handled server-side, automatic account verification, and
-- automatic TikTok views.
--
-- Flow (Edge Function supabase/functions/tiktok-oauth):
--   1. the signed-in creator asks for a login URL → a one-time state is stored here (10 minutes)
--   2. TikTok redirects back to the function with ?code&state → the function exchanges the code with TikTok,
--      reads the account (open_id, username, followers) and calls oauth_complete_tiktok() below
--   3. the creator's TikTok account is upserted with that username and verified_at = now(): logging in to the
--      account IS the proof of ownership, so no admin check and no bio code
-- Views: fetch-metrics also reads due_for_tiktok_metrics() every 3 hours and records views/likes/comments/
-- shares for the creator's own submitted videos (TikTok only returns stats for the connected user's videos).
-- Off until the TikTok app exists: app_settings.platform_oauth_config.tiktok.enabled + function secrets
-- TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET.

set search_path = public, extensions;

create table public.oauth_states (
  state       text primary key,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  platform    public.platform not null,
  return_to   text,
  created_at  timestamptz not null default now()
);
create index oauth_states_user_idx on public.oauth_states(user_id);
alter table public.oauth_states enable row level security;   -- service role only; no policies, no grants
revoke all on public.oauth_states from public, anon, authenticated;

-- The old client-callable connect path accepted tokens straight from the browser without checking them with
-- the platform. Connections now only come from the server-side exchange below.
revoke execute on function public.connect_platform_account(public.platform, text, text, text, text, integer, text[]) from authenticated;

update public.app_settings set value = jsonb_set(value, '{tiktok}',
  coalesce(value->'tiktok', '{}'::jsonb) || jsonb_build_object(
    'scopes', jsonb_build_array('user.info.basic', 'user.info.profile', 'user.info.stats', 'video.list'),
    'redirect_uri', 'https://njffqsbddzztfxxbavpp.supabase.co/functions/v1/tiktok-oauth')), updated_at = now()
where key = 'platform_oauth_config';

create or replace function public.oauth_complete_tiktok(
  p_creator uuid, p_open_id text, p_username text, p_followers integer,
  p_access_token text, p_refresh_token text, p_expires_in integer, p_scopes text[]
) returns public.creator_platforms
language plpgsql security definer set search_path = public, extensions as $$
declare c public.creator_platform_connections; r public.creator_platforms; v_handle text := lower(btrim(p_username, ' @'));
begin
  if not exists (select 1 from public.creator_profiles where user_id = p_creator) then raise exception 'creator_profile_not_found'; end if;
  if v_handle is null or v_handle !~ '^[a-z0-9_.\-]{1,64}$' then raise exception 'tiktok_username_missing'; end if;
  -- One TikTok account per TAPP creator (anti account-sharing): if someone else registered this username, stop
  -- and let an admin resolve it rather than silently moving it.
  if exists (select 1 from public.creator_platforms where platform = 'tiktok' and lower(handle) = v_handle and creator_id <> p_creator) then
    raise exception 'tiktok_account_taken';
  end if;
  if exists (select 1 from public.creator_platform_connections where platform = 'tiktok' and platform_user_id = p_open_id and creator_id <> p_creator and status = 'connected') then
    raise exception 'tiktok_account_taken';
  end if;

  insert into public.creator_platform_connections (creator_id, platform, platform_user_id, handle, status, scopes, token_expires_at)
  values (p_creator, 'tiktok', p_open_id, v_handle, 'connected', coalesce(p_scopes, '{}'), now() + make_interval(secs => coalesce(p_expires_in, 86400)))
  on conflict (creator_id, platform) do update set platform_user_id = excluded.platform_user_id, handle = excluded.handle, status = 'connected',
    scopes = excluded.scopes, token_expires_at = excluded.token_expires_at, last_error = null, revoked_at = null, connected_at = now()
  returning * into c;
  perform public.update_platform_token(c.id, p_access_token, p_refresh_token, p_expires_in);

  -- The creator's TikTok account row: the authenticated username, verified now. A previously typed handle for
  -- TikTok is replaced (login proves which account is theirs).
  select * into r from public.creator_platforms where creator_id = p_creator and platform = 'tiktok' order by created_at limit 1;
  if r.id is null then
    insert into public.creator_platforms (creator_id, platform, handle, profile_url, followers, verified_at)
    values (p_creator, 'tiktok', v_handle, 'https://www.tiktok.com/@' || v_handle, p_followers, now()) returning * into r;
  else
    update public.creator_platforms set handle = v_handle, profile_url = 'https://www.tiktok.com/@' || v_handle,
      followers = coalesce(p_followers, followers), verified_at = now()
    where id = r.id returning * into r;
  end if;

  perform public.write_audit('creator.platform_connected', 'creator_platform_connection', c.id, null,
    jsonb_build_object('platform', 'tiktok', 'handle', v_handle, 'verified', true, 'via', 'oauth'));
  perform public.notify(p_creator, 'platform_verified', 'Akun TikTok terverifikasi',
    format('@%s terhubung. Views klip TikTok-mu sekarang tercatat otomatis.', v_handle), jsonb_build_object('platform', 'tiktok'));
  return r;
end $$;
revoke execute on function public.oauth_complete_tiktok(uuid, text, text, integer, text, text, integer, text[]) from public, anon, authenticated;
grant execute on function public.oauth_complete_tiktok(uuid, text, text, integer, text, text, integer, text[]) to service_role;

-- TikTok work queue for fetch-metrics: the creator's own approved/tracking TikTok videos, grouped by connection.
create or replace function public.due_for_tiktok_metrics(p_min_interval_minutes integer default 170, p_limit integer default 500)
returns table (submission_id uuid, connection_id uuid, video_id text, last_views bigint)
language sql stable security definer set search_path = public, extensions as $$
  select s.id, c.id, substring(s.normalized_url from '/video/([0-9]+)'),
         (select m.views from public.content_metrics m where m.submission_id = s.id order by m.captured_at desc limit 1)
  from public.submissions s
  join public.creator_platform_connections c on c.creator_id = s.creator_id and c.platform = 'tiktok' and c.status = 'connected'
  where s.platform = 'tiktok' and s.status in ('approved', 'tracking')
    and s.normalized_url ~ '/video/[0-9]+'
    and (s.last_metrics_at is null or s.last_metrics_at < now() - make_interval(mins => p_min_interval_minutes))
  order by c.id, s.last_metrics_at asc nulls first
  limit p_limit
$$;
revoke execute on function public.due_for_tiktok_metrics(integer, integer) from public, anon, authenticated;
grant execute on function public.due_for_tiktok_metrics(integer, integer) to service_role;

-- Housekeeping: drop stale login attempts.
do $$
begin
  if to_regclass('cron.job') is null then return; end if;
  execute $cmd$ select cron.unschedule(jobid) from cron.job where jobname = 'oauth-states-cleanup' $cmd$;
  execute $cmd$ select cron.schedule('oauth-states-cleanup', '17 * * * *', $job$ delete from public.oauth_states where created_at < now() - interval '1 hour' $job$) $cmd$;
end $$;
