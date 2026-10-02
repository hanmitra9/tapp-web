-- TAPP · 0032 · Admin → Koneksi: which creators have connected TikTok/YouTube/Instagram for automatic views,
-- which connections are failing (expired/revoked consent), and a way for an admin to cut a connection.

set search_path = public, extensions;

-- One row per connection with the creator's name and how much it is actually feeding (tracked clips on that
-- platform, last automatic metric). Tokens are never part of this.
create or replace function public.admin_platform_connections(p_status public.platform_connection_status default null, p_search text default null)
returns table (
  id uuid, creator_id uuid, full_name text, username text, platform public.platform, handle text,
  status public.platform_connection_status, scopes text[], token_expires_at timestamptz, last_synced_at timestamptz,
  last_error text, connected_at timestamptz, revoked_at timestamptz, verified boolean, tracked bigint, last_api_metric_at timestamptz
)
language plpgsql stable security definer set search_path = public, extensions as $$
declare v_q text := nullif(lower(btrim(p_search)), '');
begin
  perform public.assert_admin();
  return query
  select c.id, c.creator_id, p.full_name, p.username::text, c.platform, c.handle, c.status, c.scopes, c.token_expires_at,
         c.last_synced_at, c.last_error, c.connected_at, c.revoked_at,
         exists (select 1 from public.creator_platforms cp where cp.creator_id = c.creator_id and cp.platform = c.platform
                 and cp.verified_at is not null and lower(cp.handle) = lower(c.handle)),
         (select count(*) from public.submissions s where s.creator_id = c.creator_id and s.platform = c.platform and s.status in ('approved', 'tracking')),
         (select max(m.captured_at) from public.content_metrics m join public.submissions s on s.id = m.submission_id
           where s.creator_id = c.creator_id and s.platform = c.platform and m.source = 'api')
  from public.creator_platform_connections c
  join public.profiles p on p.id = c.creator_id
  where (p_status is null or c.status = p_status)
    and (v_q is null or lower(coalesce(c.handle, '')) like '%' || v_q || '%' or lower(coalesce(p.full_name, '')) like '%' || v_q || '%'
         or lower(coalesce(p.username::text, '')) like '%' || v_q || '%')
  order by (c.status = 'error') desc, c.connected_at desc
  limit 300;
end $$;

-- Cut a connection (suspected shared/bought account, creator request, stuck token). Tokens are deleted from
-- Vault; optionally the account's verification is withdrawn too. The creator is told why.
create or replace function public.admin_disconnect_platform(p_connection_id uuid, p_reason text, p_unverify boolean default false)
returns void
language plpgsql security definer set search_path = public, extensions as $$
declare c public.creator_platform_connections;
begin
  perform public.assert_admin();
  if nullif(btrim(p_reason), '') is null then raise exception 'reason_required'; end if;
  select * into c from public.creator_platform_connections where id = p_connection_id for update;
  if not found then raise exception 'not_found'; end if;
  if c.status = 'revoked' then raise exception 'already_disconnected'; end if;
  update public.creator_platform_connections set status = 'revoked', revoked_at = now(), last_error = left('admin: ' || btrim(p_reason), 500)
  where id = c.id;
  if to_regclass('vault.secrets') is not null then
    delete from vault.secrets where name in ('oauth_access:' || c.id, 'oauth_refresh:' || c.id);
  end if;
  if p_unverify then
    update public.creator_platforms set verified_at = null
    where creator_id = c.creator_id and platform = c.platform and lower(handle) = lower(c.handle);
  end if;
  perform public.write_audit('admin.platform_disconnected', 'creator_platform_connection', c.id,
    jsonb_build_object('status', c.status), jsonb_build_object('status', 'revoked', 'unverified', p_unverify),
    jsonb_build_object('reason', btrim(p_reason), 'platform', c.platform, 'handle', c.handle));
  perform public.notify(c.creator_id, 'platform_disconnected', 'Koneksi akun diputus',
    format('Koneksi %s @%s diputus oleh TAPP: %s', c.platform::text, coalesce(c.handle, ''), btrim(p_reason)),
    jsonb_build_object('platform', c.platform));
end $$;

revoke execute on function public.admin_platform_connections(public.platform_connection_status, text), public.admin_disconnect_platform(uuid, text, boolean) from public, anon;
grant execute on function public.admin_platform_connections(public.platform_connection_status, text), public.admin_disconnect_platform(uuid, text, boolean) to authenticated;
