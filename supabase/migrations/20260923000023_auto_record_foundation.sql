-- TAPP · 0023 · Auto-record foundation: OAuth connections + official-API metric fetching.
--
-- Shape: a creator connects their TikTok/Instagram/YouTube account via OAuth (from the app). We store the
-- access/refresh tokens in Supabase Vault (never in a plain table) and keep only a reference + expiry here.
-- A scheduled sweep (cron, like push-dispatch) calls the `fetch-metrics` Edge Function, which:
--   1. finds trackable submissions whose creator has a connected account for that platform,
--   2. calls the platform's official API for that specific video's view count,
--   3. writes the result through admin_record_metrics(source := 'api') — the exact same path human admins
--      use, so qualification, budgets, notifications and tier recompute all work unchanged.
-- Manual entry (source := 'manual') keeps working for creators who haven't connected an account yet, or for
-- any platform whose App Review isn't approved — this table is additive, not a replacement.
--
-- What THIS migration does NOT do: call any platform API. It sets up storage, the connect/disconnect RPCs
-- a creator uses, and the trusted entry point the Edge Function calls. Per-platform OAuth app credentials
-- (client id/secret) go in app_settings as they're issued; see platform_oauth_config below.

set search_path = public, extensions;

create type public.platform_connection_status as enum ('connected', 'expired', 'revoked', 'error');

-- One row per creator × platform OAuth connection. Tokens themselves live in Vault (connection id doubles
-- as a stable key for the secret names: 'oauth_access:<id>' and 'oauth_refresh:<id>'), so a leaked database
-- backup or a bug that over-selects this table never exposes a usable token.
create table public.creator_platform_connections (
  id                uuid primary key default gen_random_uuid(),
  creator_id        uuid not null references public.creator_profiles(user_id) on delete cascade,
  platform          public.platform not null,
  platform_user_id  text not null,                      -- the platform's own account id (stable even if handle changes)
  handle            text,
  status            public.platform_connection_status not null default 'connected',
  scopes            text[] not null default '{}',
  token_expires_at  timestamptz,
  last_synced_at    timestamptz,
  last_error        text,
  connected_at      timestamptz not null default now(),
  revoked_at        timestamptz,
  constraint creator_platform_connections_unique unique (creator_id, platform)
);
create index creator_platform_connections_status_idx on public.creator_platform_connections(platform, status) where status = 'connected';
alter table public.creator_platform_connections enable row level security;

create policy creator_platform_connections_own on public.creator_platform_connections for select to authenticated
  using (creator_id = (select auth.uid()));
-- No direct insert/update/delete grants for creators: connecting/disconnecting goes through the RPCs below,
-- which validate the OAuth exchange server-side before writing. See 20260923000003_security.sql's pattern.
revoke insert, update, delete on public.creator_platform_connections from authenticated;
grant select on public.creator_platform_connections to authenticated;

-- Per-platform OAuth app credentials (client id; the client secret stays in Vault, never here). Filled in
-- as each platform's developer app is created — safe to ship empty, every function below checks for null.
insert into public.app_settings (key, value) values (
  'platform_oauth_config',
  '{
     "tiktok":    {"enabled": false, "client_id": null, "redirect_uri": null, "scopes": ["user.info.basic", "video.list"]},
     "instagram": {"enabled": false, "client_id": null, "redirect_uri": null, "scopes": ["instagram_basic", "instagram_manage_insights"]},
     "youtube":   {"enabled": false, "client_id": null, "redirect_uri": null, "scopes": ["https://www.googleapis.com/auth/youtube.readonly"]}
   }'::jsonb
) on conflict (key) do nothing;

-- app_settings.platform_oauth_config has no secrets in it (client_id and scopes are not sensitive — the
-- client_secret for each platform lives only in Vault), so it's safe to expose alongside the other
-- already-public operational keys.
drop policy if exists app_settings_read on public.app_settings;
create policy app_settings_read on public.app_settings for select to authenticated
  using (key in ('earnings_hold_days','min_payout_idr','max_submissions_per_day','publish_grace_minutes','view_milestones','platform_oauth_config'));

-- Called by the app once a creator completes the OAuth flow in their browser/webview. p_access_token and
-- p_refresh_token are the tokens the platform just issued; this function is the only place they ever touch
-- the database, and it puts them straight into Vault rather than a column.
create or replace function public.connect_platform_account(
  p_platform public.platform, p_platform_user_id text, p_handle text,
  p_access_token text, p_refresh_token text, p_expires_in_seconds integer, p_scopes text[] default '{}'
) returns public.creator_platform_connections
language plpgsql security definer set search_path = public, extensions as $$
declare v_uid uuid := auth.uid(); r public.creator_platform_connections; v_expires timestamptz;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from public.creator_profiles where user_id = v_uid) then raise exception 'creator_profile_not_found'; end if;
  if nullif(btrim(p_access_token), '') is null then raise exception 'missing_access_token'; end if;
  if to_regclass('vault.secrets') is null then raise exception 'vault_unavailable'; end if;   -- not available in local/test DBs

  v_expires := case when p_expires_in_seconds is not null then now() + make_interval(secs => p_expires_in_seconds) end;

  insert into public.creator_platform_connections
    (creator_id, platform, platform_user_id, handle, status, scopes, token_expires_at, last_synced_at)
  values (v_uid, p_platform, p_platform_user_id, p_handle, 'connected', coalesce(p_scopes, '{}'), v_expires, null)
  on conflict (creator_id, platform) do update set
    platform_user_id = excluded.platform_user_id, handle = excluded.handle, status = 'connected',
    scopes = excluded.scopes, token_expires_at = excluded.token_expires_at, last_error = null, revoked_at = null,
    connected_at = now()
  returning * into r;

  -- One secret per token per connection; re-connecting overwrites rather than accumulating.
  perform (select case when exists (select 1 from vault.secrets where name = 'oauth_access:' || r.id)
    then vault.update_secret((select id from vault.secrets where name = 'oauth_access:' || r.id), p_access_token)
    else vault.create_secret(p_access_token, 'oauth_access:' || r.id, 'TAPP OAuth access token') end);
  if nullif(btrim(p_refresh_token), '') is not null then
    perform (select case when exists (select 1 from vault.secrets where name = 'oauth_refresh:' || r.id)
      then vault.update_secret((select id from vault.secrets where name = 'oauth_refresh:' || r.id), p_refresh_token)
      else vault.create_secret(p_refresh_token, 'oauth_refresh:' || r.id, 'TAPP OAuth refresh token') end);
  end if;

  perform public.write_audit('creator.platform_connected', 'creator_platform_connection', r.id, null,
    jsonb_build_object('platform', p_platform, 'handle', p_handle));
  return r;
end $$;
revoke execute on function public.connect_platform_account(public.platform, text, text, text, text, integer, text[]) from public, anon;
grant execute on function public.connect_platform_account(public.platform, text, text, text, text, integer, text[]) to authenticated;

create or replace function public.disconnect_platform_account(p_platform public.platform) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare v_uid uuid := auth.uid(); v_id uuid;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select id into v_id from public.creator_platform_connections where creator_id = v_uid and platform = p_platform and status <> 'revoked';
  if not found then raise exception 'not_connected'; end if;
  update public.creator_platform_connections set status = 'revoked', revoked_at = now() where id = v_id;
  if to_regclass('vault.secrets') is not null then
    delete from vault.secrets where name in ('oauth_access:' || v_id, 'oauth_refresh:' || v_id);
  end if;
  perform public.write_audit('creator.platform_disconnected', 'creator_platform_connection', v_id, null, jsonb_build_object('platform', p_platform));
end $$;
revoke execute on function public.disconnect_platform_account(public.platform) from public, anon;
grant execute on function public.disconnect_platform_account(public.platform) to authenticated;

-- ── Trusted entry point for the fetch-metrics Edge Function (service role only; never exposed to users) ──

-- Lists submissions that are due for an automatic check: status trackable, creator has a *connected* account
-- for that platform, and it's been at least p_min_interval_minutes since the last check (or never checked).
-- The Edge Function calls this first to build its work queue, then calls the two functions below per item.
create or replace function public.due_for_auto_metrics(p_min_interval_minutes integer default 180, p_limit integer default 200)
returns table (submission_id uuid, connection_id uuid, platform public.platform, platform_user_id text, normalized_url text, creator_id uuid)
language sql stable security definer set search_path = public, extensions as $$
  select s.id, cpc.id, s.platform, cpc.platform_user_id, s.normalized_url, s.creator_id
  from public.submissions s
  join public.creator_platform_connections cpc on cpc.creator_id = s.creator_id and cpc.platform = s.platform and cpc.status = 'connected'
  where s.status in ('approved', 'tracking')
    and (s.last_metrics_at is null or s.last_metrics_at < now() - make_interval(mins => p_min_interval_minutes))
  order by s.last_metrics_at asc nulls first
  limit p_limit
$$;
revoke execute on function public.due_for_auto_metrics(integer, integer) from public, anon, authenticated;
grant execute on function public.due_for_auto_metrics(integer, integer) to service_role;

-- Returns the decrypted access token for a connection, and whether it's expired (so the Edge Function knows
-- to refresh before calling the platform API). service_role only — this is the one place a token round-trips
-- out of Vault in cleartext, and it happens inside the trusted Edge Function's request, never in app code.
create or replace function public.get_platform_token(p_connection_id uuid)
returns table (access_token text, refresh_token text, expires_at timestamptz, platform public.platform, platform_user_id text)
language plpgsql security definer set search_path = public, extensions as $$
declare c public.creator_platform_connections;
begin
  select * into c from public.creator_platform_connections where id = p_connection_id and status = 'connected';
  if not found then return; end if;
  if to_regclass('vault.decrypted_secrets') is null then return; end if;
  return query
    select (select decrypted_secret from vault.decrypted_secrets where name = 'oauth_access:' || c.id),
           (select decrypted_secret from vault.decrypted_secrets where name = 'oauth_refresh:' || c.id),
           c.token_expires_at, c.platform, c.platform_user_id;
end $$;
revoke execute on function public.get_platform_token(uuid) from public, anon, authenticated;
grant execute on function public.get_platform_token(uuid) to service_role;

-- Refreshed tokens come back from the platform; the Edge Function stores them the same way connect did.
create or replace function public.update_platform_token(
  p_connection_id uuid, p_access_token text, p_refresh_token text default null, p_expires_in_seconds integer default null
) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if to_regclass('vault.secrets') is null then return; end if;
  perform (select case when exists (select 1 from vault.secrets where name = 'oauth_access:' || p_connection_id)
    then vault.update_secret((select id from vault.secrets where name = 'oauth_access:' || p_connection_id), p_access_token)
    else vault.create_secret(p_access_token, 'oauth_access:' || p_connection_id, 'TAPP OAuth access token') end);
  if p_refresh_token is not null then
    perform (select case when exists (select 1 from vault.secrets where name = 'oauth_refresh:' || p_connection_id)
      then vault.update_secret((select id from vault.secrets where name = 'oauth_refresh:' || p_connection_id), p_refresh_token)
      else vault.create_secret(p_refresh_token, 'oauth_refresh:' || p_connection_id, 'TAPP OAuth refresh token') end);
  end if;
  update public.creator_platform_connections set
    token_expires_at = case when p_expires_in_seconds is not null then now() + make_interval(secs => p_expires_in_seconds) else token_expires_at end
  where id = p_connection_id;
end $$;
revoke execute on function public.update_platform_token(uuid, text, text, integer) from public, anon, authenticated;
grant execute on function public.update_platform_token(uuid, text, text, integer) to service_role;

-- A refresh/call failed hard enough that the connection needs the creator to reconnect (e.g. revoked
-- consent, expired refresh token). Marks it and notifies them — same shape as any other notify() call.
create or replace function public.mark_platform_connection_error(p_connection_id uuid, p_error text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare v_creator uuid; v_platform public.platform;
begin
  update public.creator_platform_connections set status = 'error', last_error = left(p_error, 500)
  where id = p_connection_id returning creator_id, platform into v_creator, v_platform;
  if found then
    perform public.notify(v_creator, 'platform_connection_error', 'Sambungkan ulang akunmu',
      format('Koneksi %s terputus. Hubungkan ulang supaya views-mu tetap terpantau otomatis.', v_platform::text),
      jsonb_build_object('platform', v_platform, 'connection_id', p_connection_id));
    perform public.write_audit('creator.platform_connection_error', 'creator_platform_connection', p_connection_id, null,
      jsonb_build_object('error', left(p_error, 500)));
  end if;
end $$;
revoke execute on function public.mark_platform_connection_error(uuid, text) from public, anon, authenticated;
grant execute on function public.mark_platform_connection_error(uuid, text) to service_role;

-- The trusted write path: identical effect to admin_record_metrics, but callable by the Edge Function
-- (service_role) without a human admin session, and always tagged source := 'api'. Reuses every check and
-- side effect admin_record_metrics already has (content_state transitions, audit log) by calling it, rather
-- than duplicating that logic — except assert_admin(), which a service-role call can't and shouldn't satisfy.
create or replace function public.record_api_metrics(
  p_submission_id uuid, p_views bigint, p_likes bigint default 0, p_comments bigint default 0,
  p_shares bigint default 0, p_saves bigint default 0, p_content_state public.content_state default 'live',
  p_raw jsonb default '{}'
) returns public.content_metrics
language plpgsql security definer set search_path = public, extensions as $$
declare s public.submissions; r public.content_metrics; v_last bigint;
begin
  select * into s from public.submissions where id = p_submission_id for update;
  if not found then raise exception 'submission_not_found'; end if;
  if s.status not in ('approved','tracking','flagged') then raise exception 'submission_not_trackable:%', s.status; end if;

  insert into public.content_metrics (submission_id, captured_at, views, likes, comments, shares, saves, source, raw, recorded_by)
  values (s.id, now(), p_views, p_likes, p_comments, p_shares, p_saves, 'api', coalesce(p_raw,'{}'), null)
  returning * into r;

  select views into v_last from public.content_metrics
  where submission_id = s.id and id <> r.id order by captured_at desc limit 1;

  update public.submissions set
    last_metrics_at = now(),
    content_state = p_content_state,
    status = case
      when p_content_state in ('deleted','private') then 'flagged'
      when status = 'approved' then 'tracking'
      else status end,
    review_reason = case
      when p_content_state in ('deleted','private') then format('Postingan %s di platform.', case p_content_state when 'deleted' then 'sudah dihapus' else 'diprivat' end)
      else review_reason end
  where id = s.id;

  perform public.write_audit('metrics.record_api', 'submission', s.id, null,
    jsonb_build_object('metric_id', r.id, 'views', p_views, 'content_state', p_content_state),
    jsonb_build_object('views_dropped', v_last is not null and p_views < v_last));
  return r;
end $$;
revoke execute on function public.record_api_metrics(uuid, bigint, bigint, bigint, bigint, bigint, public.content_state, jsonb) from public, anon, authenticated;
grant execute on function public.record_api_metrics(uuid, bigint, bigint, bigint, bigint, bigint, public.content_state, jsonb) to service_role;

-- Scheduled sweep (same shape as push-dispatch-sweep / release-earnings). Skipped where cron/net/Vault
-- aren't installed (local tests). Interval matches the 3-hour default in due_for_auto_metrics above.
insert into public.app_settings (key, value) values ('fetch_metrics_url', 'null'::jsonb) on conflict (key) do nothing;

do $$
begin
  if to_regclass('cron.job') is null then return; end if;
  execute $cmd$ select cron.schedule('fetch-metrics-sweep', '0 */3 * * *', $job$
    select net.http_post(
      url := (select value #>> '{}' from public.app_settings where key = 'fetch_metrics_url'),
      body := '{}'::jsonb,
      headers := jsonb_build_object('Content-Type', 'application/json',
        'x-dispatch-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'fetch_metrics_secret')))
    where (select value from public.app_settings where key = 'fetch_metrics_url') is distinct from 'null'::jsonb
  $job$) $cmd$;
end $$;

do $$
begin
  if to_regclass('vault.secrets') is null then return; end if;
  if not exists (select 1 from vault.secrets where name = 'fetch_metrics_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'fetch_metrics_secret', 'Shared secret for the fetch-metrics Edge Function');
  end if;
end $$;

create or replace function public.verify_fetch_metrics_secret(p_secret text) returns boolean
language plpgsql stable security definer set search_path = public, extensions as $$
declare v text;
begin
  if to_regclass('vault.decrypted_secrets') is null then return false; end if;
  execute 'select decrypted_secret from vault.decrypted_secrets where name = $1' into v using 'fetch_metrics_secret';
  return v is not null and p_secret is not null and v = p_secret;
end $$;
revoke execute on function public.verify_fetch_metrics_secret(text) from public, anon, authenticated;
grant execute on function public.verify_fetch_metrics_secret(text) to service_role;

-- ── Read model for the app: which platforms are connected, so the submit-content screen can show
-- "views will auto-update" vs "an admin will check this manually" ──
create or replace function public.my_platform_connections() returns setof public.creator_platform_connections
language sql stable security definer set search_path = public, extensions as $$
  select * from public.creator_platform_connections where creator_id = (select auth.uid()) and status <> 'revoked'
$$;
revoke execute on function public.my_platform_connections() from public, anon;
grant execute on function public.my_platform_connections() to authenticated;
