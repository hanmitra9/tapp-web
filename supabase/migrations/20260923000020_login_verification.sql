-- TAPP · 0020 · Email verification at every sign-in (server-enforced, switchable) + welcome email.
--
-- How sign-in verification is enforced: every API request runs public.check_request() first (PostgREST
-- db-pre-request). When app_settings.require_login_otp is true, an authenticated request whose JWT was
-- obtained with a password alone (amr = password) is refused — only sessions that finished an email code
-- (otp / magiclink / recovery / signup verification) get through. The app signs in with the password first,
-- throws that session away, then signs in with the emailed code.
-- Off by default: switch it on once email delivery (Resend + mailer) is live.

set search_path = public, extensions;

insert into public.app_settings (key, value) values ('require_login_otp', 'false'::jsonb)
on conflict (key) do nothing;

-- Signed-out clients ask this before showing the login form, so the app knows whether to expect a code.
create or replace function public.login_policy() returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select jsonb_build_object('require_login_otp', coalesce((select (value #>> '{}')::boolean from public.app_settings where key = 'require_login_otp'), false))
$$;
revoke execute on function public.login_policy() from public;
grant execute on function public.login_policy() to anon, authenticated;

create or replace function public.check_request() returns void
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  claims jsonb := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  methods text[];
begin
  if claims is null or claims->>'role' is distinct from 'authenticated' then return; end if;
  if not coalesce((select (value #>> '{}')::boolean from public.app_settings where key = 'require_login_otp'), false) then return; end if;
  select coalesce(array_agg(e->>'method'), '{}') into methods from jsonb_array_elements(coalesce(claims->'amr', '[]'::jsonb)) e;
  if methods && array['otp', 'magiclink', 'recovery', 'email/signup', 'invite', 'email_change'] then return; end if;
  raise sqlstate 'PT401' using message = 'login_verification_required', detail = 'Masuk ulang dan masukkan kode yang dikirim ke emailmu.';
end $$;
revoke execute on function public.check_request() from public, anon;
grant execute on function public.check_request() to authenticated, anon;   -- PostgREST calls it as the request role

-- Welcome email the moment an account's email is verified.
create or replace function public.ev_welcome_email() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  if old.email_confirmed_at is null and new.email_confirmed_at is not null then
    perform public.send_app_email('welcome', new.email, jsonb_build_object('name', coalesce(new.raw_user_meta_data->>'full_name', '')), 'welcome:' || new.id);
  end if;
  return null;
exception when others then return null;   -- never block sign-up on email
end $$;
revoke execute on function public.ev_welcome_email() from public, anon, authenticated;
drop trigger if exists auth_users_welcome_email on auth.users;
create trigger auth_users_welcome_email after update of email_confirmed_at on auth.users for each row execute function public.ev_welcome_email();
