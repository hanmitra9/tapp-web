-- TAPP · 0042 · Views history per submission, for spotting bot views.
--
-- Every automatic check (at submit, on "Cek ulang", and every 6 hours by the sweep below (runs every 20 minutes, 8 clips at a time)) appends the public
-- counters it read to submission_check_log. The admin panel turns that curve into a fairness score
-- (engagement, sudden spikes, drops, views vs followers, vs the creator's usual engagement).
-- The sweep keeps checking a clip from submit until it is paid/closed, for at most 30 days.

set search_path = public, extensions;

create table if not exists public.submission_check_log (
  id            bigserial primary key,
  submission_id uuid not null references public.submissions(id) on delete cascade,
  status        text not null,
  views         bigint check (views >= 0),
  likes         bigint check (likes >= 0),
  comments      bigint check (comments >= 0),
  shares        bigint check (shares >= 0),
  checked_at    timestamptz not null default now()
);
create index if not exists submission_check_log_sub_idx on public.submission_check_log(submission_id, checked_at);
alter table public.submission_check_log enable row level security;
drop policy if exists submission_check_log_read on public.submission_check_log;
create policy submission_check_log_read on public.submission_check_log for select to authenticated using (
  public.is_admin() or exists (select 1 from public.submissions s where s.id = submission_id and s.creator_id = auth.uid())
);
revoke insert, update, delete on public.submission_check_log from anon, authenticated;
grant select on public.submission_check_log to authenticated;

-- Clips the sweep should check now: still open, submitted in the last 30 days, last check 6+ hours ago.
create or replace function public.due_submission_checks(p_limit integer default 25) returns setof uuid
language sql stable security definer set search_path = public, extensions as $$
  select s.id from public.submissions s
  left join public.submission_checks c on c.submission_id = s.id
  where s.status in ('pending_review', 'approved', 'tracking', 'flagged')
    and s.created_at > now() - interval '30 days'
    and (c.checked_at is null or c.checked_at < now() - interval '6 hours')
  order by c.checked_at nulls first
  limit greatest(1, least(p_limit, 50))
$$;
revoke execute on function public.due_submission_checks(integer) from public, anon, authenticated;
grant execute on function public.due_submission_checks(integer) to service_role;

insert into public.app_settings (key, value)
values ('submission_check_url', to_jsonb('https://njffqsbddzztfxxbavpp.supabase.co/functions/v1/submission-check'::text))
on conflict (key) do nothing;

-- Sweep every 20 minutes, 8 clips per run (stays inside the Edge Function time limit; only clips due per the 6-hour rule). Same shared secret as fetch-metrics.
do $$
begin
  if to_regclass('cron.job') is null then return; end if;
  perform cron.unschedule(jobid) from cron.job where jobname = 'submission-check-sweep';
  execute $cmd$ select cron.schedule('submission-check-sweep', '*/20 * * * *', $job$
    select net.http_post(
      url := (select value #>> '{}' from public.app_settings where key = 'submission_check_url'),
      body := '{"sweep":true}'::jsonb,
      headers := jsonb_build_object('Content-Type', 'application/json',
        'x-dispatch-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'fetch_metrics_secret')),
      timeout_milliseconds := 120000)
  $job$) $cmd$;
end $$;
