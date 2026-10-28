-- Performance advisor fixes: index unindexed foreign keys, and evaluate auth.uid() once per query
-- (wrapped in a subselect) instead of once per row in RLS policies.

create index if not exists brand_invites_accepted_by_idx on public.brand_invites (accepted_by);
create index if not exists brand_invites_invited_by_idx on public.brand_invites (invited_by);
create index if not exists referral_rewards_payout_request_id_idx on public.referral_rewards (payout_request_id);

drop policy if exists submission_checks_read on public.submission_checks;
create policy submission_checks_read on public.submission_checks for select to authenticated using (
  public.is_admin() or exists (select 1 from public.submissions s where s.id = submission_id and s.creator_id = (select auth.uid()))
);

drop policy if exists submission_check_log_read on public.submission_check_log;
create policy submission_check_log_read on public.submission_check_log for select to authenticated using (
  public.is_admin() or exists (select 1 from public.submissions s where s.id = submission_id and s.creator_id = (select auth.uid()))
);

drop policy if exists referrals_read on public.referrals;
create policy referrals_read on public.referrals for select to authenticated
  using (referrer_id = (select auth.uid()) or referee_id = (select auth.uid()) or public.is_admin());

drop policy if exists referral_rewards_read on public.referral_rewards;
create policy referral_rewards_read on public.referral_rewards for select to authenticated
  using (referrer_id = (select auth.uid()) or public.is_admin());

drop policy if exists push_subscriptions_own on public.push_subscriptions;
create policy push_subscriptions_own on public.push_subscriptions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
