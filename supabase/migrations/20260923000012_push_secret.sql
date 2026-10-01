-- TAPP · 0012 · Authenticate the push-dispatch webhook with a secret kept in Supabase Vault.
-- The DB trigger/cron send it as a header; the Edge Function checks it through a service-role-only RPC.

set search_path = public, extensions;

do $$
declare v_exists boolean;
begin
  if to_regclass('vault.secrets') is null then return; end if;   -- local test DBs have no Vault
  execute 'select exists (select 1 from vault.secrets where name = $1)' into v_exists using 'push_dispatch_secret';
  if not v_exists then
    execute 'select vault.create_secret($1, $2, $3)'
      using encode(extensions.gen_random_bytes(32), 'hex'), 'push_dispatch_secret', 'Shared secret for the push-dispatch Edge Function';
  end if;
end $$;

create or replace function public.verify_push_secret(p_secret text) returns boolean
language plpgsql stable security definer set search_path = public, extensions as $$
declare v text;
begin
  if to_regclass('vault.decrypted_secrets') is null then return false; end if;
  execute 'select decrypted_secret from vault.decrypted_secrets where name = $1' into v using 'push_dispatch_secret';
  return v is not null and p_secret is not null and v = p_secret;
end $$;
revoke execute on function public.verify_push_secret(text) from public, anon, authenticated;
grant execute on function public.verify_push_secret(text) to service_role;

create or replace function public.ping_push_dispatch() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare v_url text; v_secret text;
begin
  select value #>> '{}' into v_url from public.app_settings where key = 'push_dispatch_url';
  if v_url is null or to_regproc('net.http_post') is null or to_regclass('vault.decrypted_secrets') is null then return null; end if;
  begin
    execute 'select decrypted_secret from vault.decrypted_secrets where name = $1' into v_secret using 'push_dispatch_secret';
    execute 'select net.http_post(url := $1, body := $2, headers := $3)'
      using v_url, '{}'::jsonb, jsonb_build_object('Content-Type', 'application/json', 'x-dispatch-secret', v_secret);
  exception when others then null;   -- delivery is retried by the cron sweep
  end;
  return null;
end $$;

-- app_settings is readable by signed-in users; keep operational URLs out of that surface.
drop policy if exists app_settings_read on public.app_settings;
create policy app_settings_read on public.app_settings for select to authenticated
  using (key in ('earnings_hold_days','min_payout_idr','max_submissions_per_day','publish_grace_minutes','view_milestones'));
