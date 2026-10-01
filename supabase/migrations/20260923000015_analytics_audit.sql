-- TAPP · 0015 · Analytics event log, audit coverage for direct table writes, security tidy-up (Phase 9)

set search_path = public, extensions;

-- ─────────────────────────────── Security tidy-up ────────────────────
revoke execute on all functions in schema public from public, anon;   -- catches trigger functions added since 0008
revoke execute on all functions in schema private from public, anon;

-- ─────────────────────────────── Audit: direct table writes ──────────
-- RPCs already audit themselves. These triggers cover tables that are written directly (RLS-guarded):
-- brands, brand_members, campaign_assets, campaign_rules, creator_payout_methods, creator_platforms, profiles.role.
create or replace function public.audit_row_change() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_old jsonb := case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end;
  v_new jsonb := case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end;
  v_id uuid;
begin
  -- Never write full account numbers into the audit trail.
  if tg_table_name = 'creator_payout_methods' then
    v_old := case when v_old is null then null else v_old - 'account_number' || jsonb_build_object('account_last4', right(v_old->>'account_number', 4)) end;
    v_new := case when v_new is null then null else v_new - 'account_number' || jsonb_build_object('account_last4', right(v_new->>'account_number', 4)) end;
  end if;
  if tg_table_name = 'profiles' then   -- only role changes are sensitive here
    if tg_op <> 'UPDATE' or old.role is not distinct from new.role then return null; end if;
    v_old := jsonb_build_object('role', old.role); v_new := jsonb_build_object('role', new.role);
  end if;
  if tg_op = 'UPDATE' and v_old - 'updated_at' = v_new - 'updated_at' then return null; end if;
  v_id := coalesce((v_new->>'id')::uuid, (v_old->>'id')::uuid, (v_new->>'brand_id')::uuid, (v_old->>'brand_id')::uuid);
  perform public.write_audit(tg_table_name || '.' || lower(tg_op), tg_table_name, v_id, v_old, v_new);
  return null;
end $$;

do $$ declare t text; begin
  foreach t in array array['brands','brand_members','campaign_assets','campaign_rules','creator_payout_methods','creator_platforms'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_audit', t);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.audit_row_change()', t || '_audit', t);
  end loop;
end $$;
drop trigger if exists profiles_role_audit on public.profiles;
create trigger profiles_role_audit after update of role on public.profiles for each row execute function public.audit_row_change();
revoke execute on function public.audit_row_change() from public, anon, authenticated;

-- Fraud signal: payout destination changed shortly before a payout request.
create or replace view public.admin_payouts with (security_invoker = true) as
select p.id, p.creator_id, p.amount, p.status, p.payout_method, p.review_reason, p.reviewed_at, p.processed_reference,
  p.paid_at, p.created_at, p.updated_at,
  pr.full_name as creator_name, pr.username as creator_username, cp.status as creator_status,
  (select count(*) from public.earnings e where e.payout_request_id = p.id) as earning_rows,
  (select count(*) from public.submissions s where s.creator_id = p.creator_id and s.status = 'flagged') as creator_flagged,
  (select count(*) from public.disputes d where d.raised_by = p.creator_id and d.status in ('open','under_review')) as creator_open_disputes,
  (select coalesce(sum(x.amount), 0) from public.payout_requests x where x.creator_id = p.creator_id and x.status = 'paid') as creator_paid_total,
  (select coalesce(sum(e.amount), 0) from public.earnings e where e.payout_request_id = p.id) = p.amount as ledger_matches,
  exists (select 1 from public.audit_logs a where a.entity_type = 'creator_payout_methods' and a.action = 'creator_payout_methods.update'
          and a.actor_id = p.creator_id and a.created_at between p.created_at - interval '72 hours' and p.created_at) as method_changed_recently
from public.payout_requests p
left join public.profiles pr on pr.id = p.creator_id
left join public.creator_profiles cp on cp.user_id = p.creator_id;
grant select on public.admin_payouts to authenticated;

-- ─────────────────────────────── Product events ──────────────────────
-- Server-truth events (things that happen in the backend or admin panel), independent of any client SDK.
-- Client-side behaviour events go to PostHog; both use the same event names and user id.
create table if not exists public.product_events (
  id          bigint generated always as identity primary key,
  user_id     uuid references public.profiles(id) on delete set null,
  event       text not null,
  properties  jsonb not null default '{}',
  created_at  timestamptz not null default now()
);
create index if not exists product_events_event_idx on public.product_events(event, created_at desc);
create index if not exists product_events_user_idx on public.product_events(user_id, created_at desc);
alter table public.product_events enable row level security;
revoke all on public.product_events from anon, authenticated;
grant select on public.product_events to authenticated;
drop policy if exists product_events_admin on public.product_events;
create policy product_events_admin on public.product_events for select to authenticated using (public.is_admin());

create or replace function public.emit_event(p_user uuid, p_event text, p_props jsonb default '{}') returns void
language sql security definer set search_path = public, extensions as $$
  insert into public.product_events (user_id, event, properties) values (p_user, p_event, coalesce(p_props, '{}'));
$$;
revoke execute on function public.emit_event(uuid, text, jsonb) from public, anon, authenticated;

-- One trigger function per table: PL/pgSQL caches expression plans per function, so sharing one
-- function across tables with different enum types for `status` breaks at runtime.
create or replace function public.ev_profiles() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin perform public.emit_event(new.id, 'signup_completed', '{}'); return null; end $$;

create or replace function public.ev_creator_profiles() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  if new.status is distinct from old.status then
    perform public.emit_event(new.user_id, case new.status when 'verified' then 'onboarding_completed' when 'active' then 'creator_approved'
      when 'suspended' then 'creator_suspended' when 'banned' then 'creator_banned' else 'creator_status_changed' end,
      jsonb_build_object('from', old.status, 'to', new.status));
  end if;
  return null;
end $$;

create or replace function public.ev_campaign_creators() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    perform public.emit_event(new.creator_id, case new.status when 'joined' then 'campaign_joined' when 'left' then 'campaign_left' else 'campaign_removed' end,
      jsonb_build_object('campaign_id', new.campaign_id));
  end if;
  return null;
end $$;

create or replace function public.ev_submissions() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  if tg_op = 'INSERT' then
    perform public.emit_event(new.creator_id, 'submission_submitted', jsonb_build_object('campaign_id', new.campaign_id, 'platform', new.platform));
  elsif new.status is distinct from old.status and new.status in ('approved','rejected','needs_changes','flagged','pending_review') then
    perform public.emit_event(new.creator_id, case new.status when 'approved' then 'submission_approved' when 'rejected' then 'submission_rejected'
      when 'needs_changes' then 'submission_needs_changes' when 'flagged' then 'submission_flagged' else 'submission_resubmitted' end,
      jsonb_build_object('campaign_id', new.campaign_id, 'platform', new.platform, 'from', old.status));
  end if;
  return null;
end $$;

create or replace function public.ev_payout_requests() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  if tg_op = 'INSERT' then
    perform public.emit_event(new.creator_id, 'payout_requested', jsonb_build_object('amount', new.amount));
  elsif new.status is distinct from old.status and new.status in ('paid','rejected') then
    perform public.emit_event(new.creator_id, case new.status when 'paid' then 'payout_completed' else 'payout_rejected' end,
      jsonb_build_object('amount', new.amount, 'hours_to_resolve', round(extract(epoch from (now() - new.created_at)) / 3600, 1)));
  end if;
  return null;
end $$;

revoke execute on function public.ev_profiles(), public.ev_creator_profiles(), public.ev_campaign_creators(),
  public.ev_submissions(), public.ev_payout_requests() from public, anon, authenticated;

drop trigger if exists profiles_events on public.profiles;
create trigger profiles_events after insert on public.profiles for each row execute function public.ev_profiles();
drop trigger if exists creator_profiles_events on public.creator_profiles;
create trigger creator_profiles_events after update of status on public.creator_profiles for each row execute function public.ev_creator_profiles();
drop trigger if exists campaign_creators_events on public.campaign_creators;
create trigger campaign_creators_events after insert or update of status on public.campaign_creators for each row execute function public.ev_campaign_creators();
drop trigger if exists submissions_events on public.submissions;
create trigger submissions_events after insert or update of status on public.submissions for each row execute function public.ev_submissions();
drop trigger if exists payout_requests_events on public.payout_requests;
create trigger payout_requests_events after insert or update of status on public.payout_requests for each row execute function public.ev_payout_requests();

-- ─────────────────────────────── Growth read models (admin) ──────────
-- Creator activation funnel: each step counts creators who reached it (cumulative, not exclusive).
create or replace view public.admin_creator_funnel with (security_invoker = true) as
select
  (select count(*) from public.profiles where role = 'creator')                                                    as signed_up,
  (select count(*) from public.creator_profiles where onboarding_completed_at is not null)                         as onboarded,
  (select count(*) from public.creator_profiles where status = 'active')                                           as approved,
  (select count(distinct creator_id) from public.campaign_creators)                                                as joined_campaign,
  (select count(distinct creator_id) from public.submissions)                                                      as submitted,
  (select count(distinct creator_id) from public.submissions where status in ('approved','tracking','completed'))  as approved_submission,
  (select count(distinct creator_id) from public.earnings where amount > 0)                                        as earned,
  (select count(distinct creator_id) from public.payout_requests where status = 'paid')                            as paid_out;
grant select on public.admin_creator_funnel to authenticated;

create or replace view public.admin_weekly_activity with (security_invoker = true) as
select date_trunc('week', created_at)::date as week, event, count(*) as events, count(distinct user_id) as users
from public.product_events where created_at > now() - interval '12 weeks'
group by 1, 2;
grant select on public.admin_weekly_activity to authenticated;
