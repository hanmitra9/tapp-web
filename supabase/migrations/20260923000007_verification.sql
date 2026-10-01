-- TAPP · 0007 · Verification & performance read models (Phase 5)
-- security_invoker views: admins see everything via RLS; anyone else sees only rows RLS already allows.

set search_path = public, extensions;

create or replace view public.admin_submissions with (security_invoker = true) as
select s.id, s.campaign_id, s.creator_id, s.platform, s.post_url, s.normalized_url, s.published_at, s.caption, s.screenshot_path,
  s.status, s.review_reason, s.reviewed_at, s.content_state, s.qualified_views, s.earned, s.last_metrics_at, s.created_at,
  c.title as campaign_title, c.status as campaign_status, c.cpm, c.min_views_to_qualify, c.max_earning_per_submission,
  c.budget, c.earned as campaign_earned, c.budget_override, c.submission_deadline,
  b.name as brand_name,
  p.full_name as creator_name, p.username as creator_username, p.avatar_url as creator_avatar,
  cp.status as creator_status, cp.tier as creator_tier,
  (select x.handle from public.creator_platforms x where x.creator_id = s.creator_id and x.platform = s.platform order by x.created_at limit 1) as account_handle,
  (select x.followers from public.creator_platforms x where x.creator_id = s.creator_id and x.platform = s.platform order by x.created_at limit 1) as account_followers,
  (select count(*) from public.submissions h where h.creator_id = s.creator_id and h.status in ('approved','tracking','completed')) as creator_approved,
  (select count(*) from public.submissions h where h.creator_id = s.creator_id and h.status = 'rejected') as creator_rejected,
  lm.id as latest_metric_id, lm.views, lm.likes, lm.comments, lm.shares, lm.saves, lm.captured_at as metrics_captured_at,
  (select count(*) from public.content_metrics m where m.submission_id = s.id) as metric_count
from public.submissions s
join public.campaigns c on c.id = s.campaign_id
left join public.brands b on b.id = c.brand_id
left join public.profiles p on p.id = s.creator_id
left join public.creator_profiles cp on cp.user_id = s.creator_id
left join lateral (
  select id, views, likes, comments, shares, saves, captured_at from public.content_metrics
  where submission_id = s.id order by captured_at desc, created_at desc limit 1
) lm on true;

create or replace view public.admin_queue_counts with (security_invoker = true) as
select
  (select count(*) from public.submissions where status = 'pending_review')                                   as pending_review,
  (select count(*) from public.submissions where status = 'flagged')                                          as flagged,
  (select count(*) from public.submissions where status = 'approved')                                         as awaiting_first_metrics,
  (select count(*) from public.submissions where status = 'tracking'
     and (last_metrics_at is null or last_metrics_at < now() - interval '24 hours'))                          as stale_metrics,
  (select count(*) from public.creator_profiles where status = 'verified')                                    as creators_to_review;

grant select on public.admin_submissions, public.admin_queue_counts to authenticated;

-- Mark a creator's social account as verified (ownership checked by the reviewer, e.g. bio code or DM).
create or replace function public.admin_verify_platform(p_platform_id uuid, p_verified boolean) returns public.creator_platforms
language plpgsql security definer set search_path = public, extensions as $$
declare v_admin uuid := public.assert_admin(); x public.creator_platforms; r public.creator_platforms;
begin
  select * into x from public.creator_platforms where id = p_platform_id for update;
  if not found then raise exception 'platform_not_found'; end if;
  update public.creator_platforms set verified_at = case when p_verified then coalesce(verified_at, now()) end
  where id = x.id returning * into r;
  perform public.write_audit(case when p_verified then 'platform.verify' else 'platform.unverify' end, 'creator_platform', x.id,
    jsonb_build_object('verified_at', x.verified_at), jsonb_build_object('verified_at', r.verified_at),
    jsonb_build_object('creator_id', x.creator_id, 'platform', x.platform, 'handle', x.handle));
  return r;
end $$;
revoke execute on function public.admin_verify_platform(uuid, boolean) from public, anon;
grant execute on function public.admin_verify_platform(uuid, boolean) to authenticated;
