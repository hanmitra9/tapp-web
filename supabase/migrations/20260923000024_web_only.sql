-- TAPP · 0024 · Web only: remove native push delivery. The in-app notification inbox is unchanged.
-- Drops the INSERT trigger → push-dispatch Edge Function path, its retry cron, the claim/secret RPCs,
-- device tokens, and the push bookkeeping columns on notifications.

do $$
begin
  if to_regclass('cron.job') is null then return; end if;
  execute $cmd$ select cron.unschedule(jobid) from cron.job where jobname = 'push-dispatch-sweep' $cmd$;
end $$;

drop trigger if exists notifications_push on public.notifications;
drop function if exists public.ping_push_dispatch();
drop function if exists public.claim_push_batch(integer);
drop function if exists public.verify_push_secret(text);
drop table if exists public.push_tokens;

drop index if exists public.notifications_unsent_idx;
alter table public.notifications drop column if exists push_sent_at, drop column if exists push_error;

delete from public.app_settings where key = 'push_dispatch_url';

do $$
begin
  if to_regclass('vault.secrets') is not null then
    execute 'delete from vault.secrets where name = $1' using 'push_dispatch_secret';
  end if;
end $$;
