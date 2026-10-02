-- TAPP · 0026 · Admin two-factor (TOTP), server-enforced.
-- With app_settings.require_admin_mfa = true, an admin's session only counts as admin once it reached
-- AAL2 (password/code + authenticator app). An AAL1 admin session is treated like any non-admin user,
-- so every admin RLS policy and admin_* RPC (all go through is_admin) refuses it. Enrolling a factor is
-- done through Supabase Auth, which only needs AAL1, so admins can always set it up from the panel.

set search_path = public, extensions;

insert into public.app_settings (key, value) values ('require_admin_mfa', 'true'::jsonb)
on conflict (key) do nothing;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
     and (not coalesce((select (value #>> '{}')::boolean from public.app_settings where key = 'require_admin_mfa'), false)
          or (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'aal') = 'aal2')
$$;
