-- TAPP · 0064 · Show the creator fee per clip. admin_submissions gains creator_share_pct (80 = the creator keeps 80%,
-- the 20% creator platform fee stays with TAPP), so the review panel can show: views value → fee → into the balance.

create or replace view public.admin_submissions with (security_invoker = false) as
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
  (select count(*) from public.content_metrics m where m.submission_id = s.id) as metric_count,
  s.auto_hold_reason, s.auto_hold_at,
  coalesce((select pr.creator_share_pct from public.campaign_pricing pr where pr.campaign_id = c.id), 100) as creator_share_pct
from public.submissions s
join public.campaigns c on c.id = s.campaign_id
left join public.brands b on b.id = c.brand_id
left join public.profiles p on p.id = s.creator_id
left join public.creator_profiles cp on cp.user_id = s.creator_id
left join lateral (
  select id, views, likes, comments, shares, saves, captured_at from public.content_metrics
  where submission_id = s.id order by captured_at desc, created_at desc limit 1
) lm on true
where public.is_admin();
grant select on public.admin_submissions to authenticated;
