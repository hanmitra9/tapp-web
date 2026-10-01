-- TAPP · 0013 · Scheduled jobs (Supabase only; skipped where pg_cron/pg_net/Vault aren't installed, e.g. local tests)
update public.app_settings set value = to_jsonb('https://njffqsbddzztfxxbavpp.supabase.co/functions/v1/push-dispatch'::text), updated_at = now()
where key = 'push_dispatch_url';

do $$
begin
  if to_regclass('cron.job') is null then return; end if;
  -- Retry sweep for push delivery (the INSERT trigger handles the fast path).
  execute $cmd$ select cron.schedule('push-dispatch-sweep', '*/5 * * * *', $job$
    select net.http_post(
      url := (select value #>> '{}' from public.app_settings where key = 'push_dispatch_url'),
      body := '{}'::jsonb,
      headers := jsonb_build_object('Content-Type', 'application/json',
        'x-dispatch-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'push_dispatch_secret')))
  $job$) $cmd$;
  -- Held earnings become payable once their hold period ends.
  execute $cmd$ select cron.schedule('release-earnings', '*/15 * * * *', 'select public.release_matured_earnings()') $cmd$;
end $$;
