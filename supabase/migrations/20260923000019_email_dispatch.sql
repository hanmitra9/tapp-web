-- TAPP · 0019 · Transactional email via the tapp-mailer service (Railway) — brand invites and payout outcomes.
-- Auth emails (OTP, reset) go through Supabase's Send Email hook directly to the mailer; this file covers app emails.
-- Nothing is sent until app_settings.mailer_url is set, so it is safe to apply before the mailer exists.

set search_path = public, extensions;

-- Posts one email job to the mailer. Fire-and-forget: a failed send never blocks the business transaction.
create or replace function public.send_app_email(p_type text, p_to text, p_data jsonb, p_key text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare v_url text; v_secret text;
begin
  select value #>> '{}' into v_url from public.app_settings where key = 'mailer_url';
  if v_url is null or p_to is null or to_regproc('net.http_post') is null or to_regclass('vault.decrypted_secrets') is null then return; end if;
  begin
    execute 'select decrypted_secret from vault.decrypted_secrets where name = $1' into v_secret using 'mailer_secret';
    if v_secret is null then return; end if;
    execute 'select net.http_post(url := $1, body := $2, headers := $3)'
      using rtrim(v_url, '/') || '/send',
            jsonb_build_object('type', p_type, 'to', p_to, 'data', coalesce(p_data, '{}'::jsonb), 'key', p_key),
            jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_secret);
  exception when others then null;
  end;
end $$;
revoke execute on function public.send_app_email(text, text, jsonb, text) from public, anon, authenticated;

-- Brand invite created or refreshed → invitation email with the sign-up link.
create or replace function public.ev_brand_invite_email() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare v_app text; v_brand text;
begin
  if new.accepted_at is not null or new.revoked_at is not null then return null; end if;
  if tg_op = 'UPDATE' and new.expires_at is not distinct from old.expires_at then return null; end if;
  select value #>> '{}' into v_app from public.app_settings where key = 'app_url';
  select name into v_brand from public.brands where id = new.brand_id;
  perform public.send_app_email('brand_invite', new.email::text, jsonb_build_object(
    'brand_name', v_brand, 'role', new.role, 'email', new.email::text, 'expires_at', new.expires_at,
    'link', case when v_app is null then null else rtrim(v_app, '/') || '/register?invite=brand&email=' || replace(new.email::text, '+', '%2B') end),
    'invite:' || new.id || ':' || extract(epoch from new.expires_at)::bigint);
  return null;
end $$;
drop trigger if exists brand_invites_email on public.brand_invites;
create trigger brand_invites_email after insert or update of expires_at on public.brand_invites for each row execute function public.ev_brand_invite_email();

-- Payout paid / rejected → email to the creator's login address.
create or replace function public.ev_payout_email() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare v_email text; v_method text;
begin
  if new.status is not distinct from old.status or new.status not in ('paid', 'rejected') then return null; end if;
  select email into v_email from auth.users where id = new.creator_id;
  -- never put a full account number in an email: provider + last 4 digits only
  v_method := concat_ws(' ', new.payout_method->>'provider', case when coalesce(new.payout_method->>'account_number', '') <> '' then '••••' || right(new.payout_method->>'account_number', 4) end);
  if new.status = 'paid' then
    perform public.send_app_email('payout_paid', v_email, jsonb_build_object('amount', new.amount, 'method', nullif(v_method, ''), 'reference', new.processed_reference), 'payout:' || new.id || ':paid');
  else
    perform public.send_app_email('payout_rejected', v_email, jsonb_build_object('amount', new.amount, 'reason', new.review_reason), 'payout:' || new.id || ':rejected');
  end if;
  return null;
end $$;
drop trigger if exists payout_requests_email on public.payout_requests;
create trigger payout_requests_email after update of status on public.payout_requests for each row execute function public.ev_payout_email();

revoke execute on function public.ev_brand_invite_email(), public.ev_payout_email() from public, anon, authenticated;
