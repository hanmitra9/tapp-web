-- TAPP · 0053 · Creators never see campaign money amounts — only how much budget is left, as a percentage.
--
--  · campaigns.budget / earned / paid / budget_override are no longer readable by API roles (column grants).
--  · campaign_feed and get_campaign report budget = 100 and remaining = percent left (0–100), so the app's
--    "remaining / budget" math and "remaining <= 0" checks keep working without amounts.
--  · Admin/brand views that show money (admin_campaigns, admin_submissions, campaign_funnel) run as the view owner
--    and filter rows themselves (admins; brand members for their own funnel).

set search_path = public, extensions;

create or replace function private.budget_left_pct(p_budget bigint, p_earned bigint) returns integer
language sql immutable set search_path = pg_catalog as $$
  select greatest(0, least(100, round(100.0 * (coalesce(p_budget, 0) - coalesce(p_earned, 0)) / nullif(p_budget, 0))))::int
$$;

create or replace function public.campaign_feed(
  p_platforms          public.platform[] default null,
  p_categories         text[]            default null,
  p_content_types      text[]            default null,
  p_min_cpm            bigint            default null,
  p_ending_within_days integer           default null,
  p_sort               text              default 'recommended',   -- recommended | newest | cpm | deadline
  p_limit              integer           default 20,
  p_offset             integer           default 0
) returns table (
  id uuid, title text, category text, content_type text, brand_name text, brand_logo text,
  platforms public.platform[], cpm bigint, budget bigint, remaining bigint, min_views_to_qualify integer,
  submission_deadline timestamptz, ends_at timestamptz, created_at timestamptz,
  joined boolean, match_score integer, match_reasons text[]
)
language sql stable security definer set search_path = public, extensions as $$
  with me as (
    select cp.user_id, cp.niches, cp.content_categories, cp.main_platform,
           coalesce(array_agg(pl.platform) filter (where pl.platform is not null), '{}') as linked
    from public.creator_profiles cp
    left join public.creator_platforms pl on pl.creator_id = cp.user_id
    where cp.user_id = auth.uid()
    group by cp.user_id
  ),
  history as (
    select c.category, count(*)::int as n
    from public.submissions s join public.campaigns c on c.id = s.campaign_id
    where s.creator_id = auth.uid() and s.status in ('approved','tracking','completed')
    group by c.category
  ),
  base as (
    select c.id, c.title, c.category, c.content_type, c.cpm, c.budget, c.earned, c.budget_override,
           c.min_views_to_qualify, c.submission_deadline, c.ends_at, c.created_at,
           b.name as brand_name, b.logo_url as brand_logo,
           coalesce((select array_agg(kp.platform order by kp.platform) from public.campaign_platforms kp where kp.campaign_id = c.id), '{}') as plats,
           exists (select 1 from public.campaign_creators m where m.campaign_id = c.id and m.creator_id = auth.uid() and m.status = 'joined') as is_joined,
           coalesce((select h.n from history h where h.category = c.category), 0) as track
    from public.campaigns c join public.brands b on b.id = c.brand_id
    where c.status = 'active'
      and (c.starts_at is null or c.starts_at <= now())
      and (c.submission_deadline is null or c.submission_deadline > now())
      and (c.budget_override or c.earned < c.budget)
  ),
  scored as (
    select base.*,
      (  case when base.category = any(me.niches) then 40 else 0 end
       + case when me.main_platform = any(base.plats) then 25 when base.plats && me.linked then 15 else 0 end
       + case when base.content_type = any(me.content_categories) then 15 else 0 end
       + least(base.track * 2, 10)
       + case when base.budget_override then 10 else (10 * greatest(base.budget - base.earned, 0) / base.budget)::int end
      )::int as score,
      array_remove(array[
        case when base.category = any(me.niches) then 'Sesuai niche kamu' end,
        case when me.main_platform = any(base.plats) then 'Cocok dengan platform utamamu' end,
        case when base.content_type = any(me.content_categories) then 'Sesuai jenis kontenmu' end,
        case when base.track > 0 then 'Kamu punya rekam jejak di kategori ini' end
      ], null) as reasons
    from base cross join me
    where base.plats && me.linked                       -- only campaigns the creator can actually join
  )
  select s.id, s.title, s.category, s.content_type, s.brand_name, s.brand_logo, s.plats, s.cpm, 100::bigint,
         private.budget_left_pct(s.budget, s.earned)::bigint, s.min_views_to_qualify, s.submission_deadline, s.ends_at, s.created_at,
         s.is_joined, s.score, s.reasons
  from scored s
  where (p_platforms is null or cardinality(p_platforms) = 0 or s.plats && p_platforms)
    and (p_categories is null or cardinality(p_categories) = 0 or s.category = any(p_categories))
    and (p_content_types is null or cardinality(p_content_types) = 0 or s.content_type = any(p_content_types))
    and (p_min_cpm is null or s.cpm >= p_min_cpm)
    and (p_ending_within_days is null
         or coalesce(s.submission_deadline, s.ends_at) <= now() + make_interval(days => p_ending_within_days))
  order by
    case when p_sort = 'recommended' then s.score end desc nulls last,
    case when p_sort = 'cpm' then s.cpm end desc nulls last,
    case when p_sort = 'deadline' then coalesce(s.submission_deadline, s.ends_at) end asc nulls last,
    s.created_at desc, s.id
  limit least(greatest(coalesce(p_limit, 20), 1), 50) offset greatest(coalesce(p_offset, 0), 0)
$$;

create or replace function public.get_campaign(p_campaign_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare c public.campaigns; b public.brands; m public.campaign_creators;
begin
  select * into c from public.campaigns where id = p_campaign_id;
  if not found or not private.can_view_campaign(p_campaign_id) then raise exception 'campaign_not_found'; end if;
  select * into b from public.brands where id = c.brand_id;
  select * into m from public.campaign_creators where campaign_id = c.id and creator_id = auth.uid();
  return jsonb_build_object(
    'id', c.id, 'title', c.title, 'objective', c.objective, 'description', c.description,
    'category', c.category, 'content_type', c.content_type, 'status', c.status,
    'cpm', c.cpm, 'budget', 100, 'remaining', private.budget_left_pct(c.budget, c.earned),
    'min_views_to_qualify', c.min_views_to_qualify, 'max_earning_per_submission', c.max_earning_per_submission,
    'starts_at', c.starts_at, 'ends_at', c.ends_at, 'submission_deadline', c.submission_deadline,
    'guidelines_do', to_jsonb(c.guidelines_do), 'guidelines_dont', to_jsonb(c.guidelines_dont), 'terms', c.terms,
    'brand', jsonb_build_object('name', b.name, 'logo_url', b.logo_url, 'website', b.website),
    'platforms', coalesce((select jsonb_agg(platform order by platform) from public.campaign_platforms where campaign_id = c.id), '[]'),
    'rules', coalesce((select jsonb_agg(jsonb_build_object('kind', kind, 'body', body) order by sort)
                       from public.campaign_rules where campaign_id = c.id), '[]'),
    'creators_joined', (select count(*) from public.campaign_creators where campaign_id = c.id and status = 'joined'),
    'membership', case when m.id is null then null
                  else jsonb_build_object('status', m.status, 'joined_at', m.joined_at) end,
    'join_block', public.join_block_reason(c.id)
  );
end $$;

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
  s.auto_hold_reason, s.auto_hold_at
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

create or replace view public.admin_campaigns with (security_invoker = false) as
select c.id, c.brand_id, b.name as brand_name, c.title, c.category, c.content_type, c.status, c.status_reason,
  c.cpm, c.budget, c.earned, c.paid, c.budget_override, greatest(c.budget - c.earned, 0) as remaining,
  c.min_views_to_qualify, c.max_earning_per_submission, c.starts_at, c.ends_at, c.submission_deadline, c.created_at, c.approved_at,
  array(select k.platform::text from public.campaign_platforms k where k.campaign_id = c.id order by 1) as platforms,
  (select count(*) from public.campaign_creators m where m.campaign_id = c.id and m.status = 'joined') as creators_joined,
  (select count(*) from public.submissions s where s.campaign_id = c.id) as submissions,
  (select count(*) from public.submissions s where s.campaign_id = c.id and s.status in ('approved','tracking','completed')) as approved,
  (select count(*) from public.submissions s where s.campaign_id = c.id and s.status = 'pending_review') as pending_review,
  (select coalesce(sum(s.qualified_views), 0) from public.submissions s where s.campaign_id = c.id) as qualified_views,
  (select count(*) from public.campaign_assets a where a.campaign_id = c.id) as assets,
  pr.brand_cpm, pr.brand_budget, pr.creator_share_pct, private.brand_amount(c.earned, private.spend_share(pr.creator_share_pct, pr.budget_fee_pct)) as brand_spent,
  pr.budget_fee_pct
from public.campaigns c left join public.brands b on b.id = c.brand_id
left join public.campaign_pricing pr on pr.campaign_id = c.id
where public.is_admin();
grant select on public.admin_campaigns to authenticated;

create or replace view public.campaign_funnel with (security_invoker = false) as
select c.id as campaign_id, c.brand_id, c.title, c.status, c.budget, c.earned, c.paid,
  (c.budget - c.earned)                                                                          as remaining,
  (select count(*) from public.campaign_creators m where m.campaign_id = c.id)                   as joined,
  (select count(distinct s.creator_id) from public.submissions s where s.campaign_id = c.id)     as creators_submitted,
  (select count(*) from public.submissions s where s.campaign_id = c.id)                         as submissions,
  (select count(*) from public.submissions s where s.campaign_id = c.id
     and s.status in ('approved','tracking','completed'))                                        as approved,
  (select coalesce(sum(s.qualified_views), 0) from public.submissions s where s.campaign_id = c.id) as qualified_views,
  case when (select sum(s.qualified_views) from public.submissions s where s.campaign_id = c.id) > 0
       then round(c.earned::numeric / (select sum(s.qualified_views) from public.submissions s where s.campaign_id = c.id), 4)
  end                                                                                            as effective_cpv
from public.campaigns c
where public.is_admin() or public.is_brand_member(c.brand_id);
grant select on public.campaign_funnel to authenticated;

-- Column grants: everything except the money columns.
revoke select on public.campaigns from authenticated, anon;
do $$
declare v_cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into v_cols
  from information_schema.columns
  where table_schema = 'public' and table_name = 'campaigns' and column_name not in ('budget', 'earned', 'paid', 'budget_override');
  execute format('grant select (%s) on public.campaigns to authenticated', v_cols);
end $$;
