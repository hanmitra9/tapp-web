-- TAPP · 0021 · Admin allowlist: listed emails become admin as soon as they are verified (no manual SQL).

set search_path = public, extensions;

insert into public.app_settings (key, value) values ('admin_emails', '["tappcreators@gmail.com"]'::jsonb)
on conflict (key) do update set value = excluded.value;

create or replace function public.ev_admin_allowlist() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  if new.email_confirmed_at is null then return null; end if;
  if tg_op = 'UPDATE' and old.email_confirmed_at is not null then return null; end if;
  if lower(new.email) in (select lower(x) from public.app_settings s, jsonb_array_elements_text(s.value) x where s.key = 'admin_emails') then
    update public.profiles set role = 'admin' where id = new.id and role is distinct from 'admin';
    if found then perform public.write_audit('profile.admin_granted', 'profile', new.id, null, jsonb_build_object('email', new.email, 'via', 'admin_emails')); end if;
  end if;
  return null;
exception when others then return null;   -- never block sign-up
end $$;
revoke execute on function public.ev_admin_allowlist() from public, anon, authenticated;
drop trigger if exists zz_admin_allowlist on auth.users;
-- named zz_ so it fires after on_auth_user_created (AFTER triggers run alphabetically) and the profile exists
create trigger zz_admin_allowlist after insert or update of email_confirmed_at on auth.users for each row execute function public.ev_admin_allowlist();

-- Already-verified accounts on the list are promoted now.
update public.profiles p set role = 'admin'
from auth.users u
where u.id = p.id and u.email_confirmed_at is not null and p.role is distinct from 'admin'
  and lower(u.email) in (select lower(x) from public.app_settings s, jsonb_array_elements_text(s.value) x where s.key = 'admin_emails');
