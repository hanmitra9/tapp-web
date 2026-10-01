-- TAPP · 0016 · Performance: RLS initplan caching, FK indexes, campaign auto-close (Phase 10)
-- Wraps auth.uid() as (select auth.uid()) in RLS policies so Postgres evaluates it once per query
-- instead of once per row (see https://supabase.com/docs/guides/database/postgres/row-level-security).
-- Pure performance change: every condition's logic is unchanged, only the evaluation plan.

set search_path = public, extensions;

alter policy profiles_select on public.profiles
  using (id = (select auth.uid()) or is_admin() or private.brand_can_see_creator(id));
alter policy profiles_update_own on public.profiles
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

alter policy creator_profiles_select on public.creator_profiles
  using (user_id = (select auth.uid()) or is_admin());
alter policy creator_profiles_update_own on public.creator_profiles
  using (user_id = (select auth.uid()) and status <> all (array['suspended'::public.creator_status,'banned'::public.creator_status]))
  with check (user_id = (select auth.uid()));

alter policy creator_platforms_select on public.creator_platforms
  using (creator_id = (select auth.uid()) or is_admin());
alter policy creator_platforms_insert on public.creator_platforms
  with check (creator_id = (select auth.uid()));
alter policy creator_platforms_update on public.creator_platforms
  using (creator_id = (select auth.uid())) with check (creator_id = (select auth.uid()));
alter policy creator_platforms_delete on public.creator_platforms
  using (creator_id = (select auth.uid()) and not exists (
    select 1 from public.submissions s where s.creator_id = (select auth.uid()) and s.platform = creator_platforms.platform
      and s.status = any (array['pending_review','approved','tracking','flagged']::public.submission_status[])));

alter policy payout_methods_select on public.creator_payout_methods
  using (creator_id = (select auth.uid()) or is_admin());
alter policy payout_methods_write on public.creator_payout_methods
  using (creator_id = (select auth.uid())) with check (creator_id = (select auth.uid()));

alter policy brand_members_select on public.brand_members
  using (user_id = (select auth.uid()) or is_admin());

alter policy campaigns_insert on public.campaigns
  with check ((is_brand_member(brand_id) or is_admin()) and status = 'draft'::public.campaign_status
              and earned = 0 and created_by = (select auth.uid()));

alter policy push_tokens_own on public.push_tokens
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

alter policy campaign_creators_select on public.campaign_creators
  using (creator_id = (select auth.uid()) or private.can_manage_campaign(campaign_id));

alter policy submissions_select on public.submissions
  using (creator_id = (select auth.uid()) or private.can_manage_campaign(campaign_id));

alter policy earnings_select on public.earnings
  using (creator_id = (select auth.uid()) or is_admin());
alter policy payouts_select on public.payout_requests
  using (creator_id = (select auth.uid()) or is_admin());

alter policy notifications_select on public.notifications
  using (user_id = (select auth.uid()));
alter policy notifications_mark_read on public.notifications
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

alter policy tickets_select on public.support_tickets
  using (user_id = (select auth.uid()) or is_admin());
alter policy tickets_insert on public.support_tickets
  with check (user_id = (select auth.uid()));

alter policy disputes_select on public.disputes
  using (raised_by = (select auth.uid()) or is_admin());
alter policy disputes_insert on public.disputes
  with check (raised_by = (select auth.uid())
    and (submission_id is null or exists (select 1 from public.submissions s where s.id = disputes.submission_id and s.creator_id = (select auth.uid())))
    and (payout_request_id is null or exists (select 1 from public.payout_requests p where p.id = disputes.payout_request_id and p.creator_id = (select auth.uid()))));

-- ─────────────────────────────── Missing FK indexes ───────────────────
create index if not exists campaigns_approved_by_idx           on public.campaigns(approved_by) where approved_by is not null;
create index if not exists campaigns_created_by_idx             on public.campaigns(created_by) where created_by is not null;
create index if not exists content_metrics_recorded_by_idx      on public.content_metrics(recorded_by) where recorded_by is not null;
create index if not exists disputes_resolved_by_idx             on public.disputes(resolved_by) where resolved_by is not null;
create index if not exists earnings_submission_idx              on public.earnings(submission_id);
create index if not exists payout_requests_reviewed_by_idx      on public.payout_requests(reviewed_by) where reviewed_by is not null;
create index if not exists performance_snapshots_computed_by_idx on public.performance_snapshots(computed_by) where computed_by is not null;
create index if not exists performance_snapshots_metric_idx     on public.performance_snapshots(metric_id);
create index if not exists submissions_membership_idx           on public.submissions(membership_id);
create index if not exists submissions_reviewed_by_idx          on public.submissions(reviewed_by) where reviewed_by is not null;
create index if not exists support_tickets_assigned_to_idx      on public.support_tickets(assigned_to) where assigned_to is not null;

-- ─────────────────────────────── Edge case: campaign expiry ───────────
-- "Campaign expires" (brief §24): a campaign whose ends_at has passed closes itself even if no admin acts.
-- Existing submissions keep tracking and earning; only new joins/submissions stop (guarded by their own checks).
create or replace function public.close_expired_campaigns() returns integer
language plpgsql security definer set search_path = public, extensions as $$
declare n integer;
begin
  update public.campaigns set status = 'completed', status_reason = 'ends_at_passed'
  where status in ('active','paused','ending') and ends_at is not null and ends_at < now();
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.close_expired_campaigns() from public, anon, authenticated;
grant execute on function public.close_expired_campaigns() to service_role;

do $$ begin
  if to_regclass('cron.job') is not null then
    perform cron.schedule('close-expired-campaigns', '*/15 * * * *', 'select public.close_expired_campaigns()');
  end if;
end $$;
