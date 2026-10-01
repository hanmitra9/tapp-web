-- TAPP · 0011 · Payouts ops, notification delivery, new-campaign alerts (Phase 7)

set search_path = public, extensions;

-- ─────────────────────────────── Push delivery ───────────────────────
-- Notifications are always written to the table (in-app inbox). Push is best-effort on top:
-- an AFTER INSERT trigger pings the `push-dispatch` Edge Function, which claims unsent rows and sends them via Expo.
insert into public.app_settings (key, value) values ('push_dispatch_url', 'null') on conflict (key) do nothing;

-- Claims a batch atomically so concurrent dispatchers never double-send. Service role only.
create or replace function public.claim_push_batch(p_limit integer default 100)
returns setof public.notifications
language sql volatile security definer set search_path = public, extensions as $$
  update public.notifications n set push_sent_at = now()
  where n.id in (
    select id from public.notifications
    where push_sent_at is null and push_error is null and created_at > now() - interval '1 day'
    order by created_at limit least(greatest(p_limit, 1), 500)
    for update skip locked
  )
  returning n.*
$$;
revoke execute on function public.claim_push_batch(integer) from public, anon, authenticated;
grant execute on function public.claim_push_batch(integer) to service_role;

-- Fire-and-forget ping (pg_net is async; a failure here must never block the business transaction).
create or replace function public.ping_push_dispatch() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare v_url text;
begin
  select value #>> '{}' into v_url from public.app_settings where key = 'push_dispatch_url';
  if v_url is null or to_regproc('net.http_post') is null then return null; end if;
  begin
    execute 'select net.http_post(url := $1, body := $2, headers := $3)'
      using v_url, '{}'::jsonb, '{"Content-Type":"application/json"}'::jsonb;
  exception when others then null;   -- delivery is retried by the next ping / cron sweep
  end;
  return null;
end $$;
drop trigger if exists notifications_push on public.notifications;
create trigger notifications_push after insert on public.notifications
  for each statement execute function public.ping_push_dispatch();

-- ─────────────────────────────── New campaign alerts ─────────────────
-- On first activation, alert active creators who can join (platform overlap) AND whose niche matches.
-- Niche filter keeps this relevant rather than a broadcast.
create or replace function public.alert_new_campaign() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  if new.status = 'active' and old.status = 'pending_approval' then
    insert into public.notifications (user_id, type, title, body, data)
    select cp.user_id, 'campaign_new', 'Campaign baru untukmu',
      format('%s — %s per 1.000 qualified views.', new.title, public.format_idr(new.cpm)),
      jsonb_build_object('campaign_id', new.id)
    from public.creator_profiles cp
    where cp.status = 'active' and new.category = any(cp.niches)
      and exists (select 1 from public.creator_platforms x join public.campaign_platforms k on k.platform = x.platform
                  where x.creator_id = cp.user_id and k.campaign_id = new.id)
    limit 2000;
  end if;
  return null;
end $$;
drop trigger if exists campaigns_alert_new on public.campaigns;
create trigger campaigns_alert_new after update of status on public.campaigns
  for each row execute function public.alert_new_campaign();

-- ─────────────────────────────── Inbox helpers ───────────────────────
create or replace function public.mark_notifications_read(p_ids uuid[] default null) returns integer
language plpgsql security invoker set search_path = public, extensions as $$
declare n integer;
begin
  update public.notifications set read_at = now()
  where user_id = auth.uid() and read_at is null and (p_ids is null or id = any(p_ids));
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.mark_notifications_read(uuid[]) from public, anon;
grant execute on function public.mark_notifications_read(uuid[]) to authenticated;

-- ─────────────────────────────── Admin payouts ───────────────────────
create or replace view public.admin_payouts with (security_invoker = true) as
select p.id, p.creator_id, p.amount, p.status, p.payout_method, p.review_reason, p.reviewed_at, p.processed_reference,
  p.paid_at, p.created_at, p.updated_at,
  pr.full_name as creator_name, pr.username as creator_username, cp.status as creator_status,
  (select count(*) from public.earnings e where e.payout_request_id = p.id) as earning_rows,
  (select count(*) from public.submissions s where s.creator_id = p.creator_id and s.status = 'flagged') as creator_flagged,
  (select count(*) from public.disputes d where d.raised_by = p.creator_id and d.status in ('open','under_review')) as creator_open_disputes,
  (select coalesce(sum(x.amount), 0) from public.payout_requests x where x.creator_id = p.creator_id and x.status = 'paid') as creator_paid_total,
  -- Must stay true: the ledger rows attached to this payout add up to its amount.
  (select coalesce(sum(e.amount), 0) from public.earnings e where e.payout_request_id = p.id) = p.amount as ledger_matches
from public.payout_requests p
left join public.profiles pr on pr.id = p.creator_id
left join public.creator_profiles cp on cp.user_id = p.creator_id;
grant select on public.admin_payouts to authenticated;

create or replace view public.admin_queue_counts with (security_invoker = true) as
select
  (select count(*) from public.submissions where status = 'pending_review')                                   as pending_review,
  (select count(*) from public.submissions where status = 'flagged')                                          as flagged,
  (select count(*) from public.submissions where status = 'approved')                                         as awaiting_first_metrics,
  (select count(*) from public.submissions where status = 'tracking'
     and (last_metrics_at is null or last_metrics_at < now() - interval '24 hours'))                          as stale_metrics,
  (select count(*) from public.creator_profiles where status = 'verified')                                    as creators_to_review,
  (select count(*) from public.payout_requests where status in ('requested','reviewing','approved','processing')) as payouts_open;
grant select on public.admin_queue_counts to authenticated;
