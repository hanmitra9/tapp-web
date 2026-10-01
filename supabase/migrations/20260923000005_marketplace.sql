-- TAPP · 0005 · Marketplace, campaign detail, home summary (Phase 3)
-- Matching V1 is a transparent rules-based score (not ML). Every point is explainable and returned as reasons,
-- so creators see why a campaign is recommended and the weights can be tuned later from real outcomes.

set search_path = public, extensions;

-- Campaign taxonomy uses the same slugs as creator niches (category) and content categories (content_type).
alter table public.campaigns alter column content_type set default 'podcast_clips';

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
  select s.id, s.title, s.category, s.content_type, s.brand_name, s.brand_logo, s.plats, s.cpm, s.budget,
         greatest(s.budget - s.earned, 0), s.min_views_to_qualify, s.submission_deadline, s.ends_at, s.created_at,
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

-- Why a creator can't join right now (null = can join). Mirrors join_campaign's checks so the UI never offers a failing action.
create or replace function public.join_block_reason(p_campaign_id uuid) returns text
language plpgsql stable security definer set search_path = public, extensions as $$
declare c public.campaigns; v_status public.creator_status; m public.campaign_creators;
begin
  select status into v_status from public.creator_profiles where user_id = auth.uid();
  select * into c from public.campaigns where id = p_campaign_id;
  select * into m from public.campaign_creators where campaign_id = p_campaign_id and creator_id = auth.uid();
  if m.status = 'joined' then return 'already_joined'; end if;
  if m.status = 'removed' then return 'membership_removed'; end if;
  if v_status is distinct from 'active' then return 'creator_not_eligible:' || coalesce(v_status::text, 'none'); end if;
  if c.status <> 'active' then return 'campaign_not_active'; end if;
  if c.starts_at is not null and c.starts_at > now() then return 'campaign_not_started'; end if;
  if c.submission_deadline is not null and c.submission_deadline < now() then return 'campaign_closed'; end if;
  if not c.budget_override and c.earned >= c.budget then return 'campaign_budget_exhausted'; end if;
  if not exists (select 1 from public.creator_platforms cp join public.campaign_platforms kp on kp.platform = cp.platform
                 where cp.creator_id = auth.uid() and kp.campaign_id = c.id) then return 'platform_not_eligible'; end if;
  return null;
end $$;

create or replace function public.get_campaign(p_campaign_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare c public.campaigns; b public.brands; m public.campaign_creators;
begin
  select * into c from public.campaigns where id = p_campaign_id;
  if not found or not public.can_view_campaign(p_campaign_id) then raise exception 'campaign_not_found'; end if;
  select * into b from public.brands where id = c.brand_id;
  select * into m from public.campaign_creators where campaign_id = c.id and creator_id = auth.uid();
  return jsonb_build_object(
    'id', c.id, 'title', c.title, 'objective', c.objective, 'description', c.description,
    'category', c.category, 'content_type', c.content_type, 'status', c.status,
    'cpm', c.cpm, 'budget', c.budget, 'remaining', greatest(c.budget - c.earned, 0),
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

create or replace function public.creator_home() returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select jsonb_build_object(
    'available', (select count(*) from public.campaign_feed(p_limit => 50) f where not f.joined),
    'active', (select count(*) from public.campaign_creators m join public.campaigns c on c.id = m.campaign_id
               where m.creator_id = auth.uid() and m.status = 'joined' and c.status in ('active','paused','ending')),
    'qualified_views', (select coalesce(sum(qualified_views), 0) from public.submissions where creator_id = auth.uid()),
    'total_earned', (select coalesce(sum(amount), 0) from public.earnings where creator_id = auth.uid())
  )
$$;

revoke execute on function public.campaign_feed(public.platform[], text[], text[], bigint, integer, text, integer, integer),
  public.join_block_reason(uuid), public.get_campaign(uuid), public.creator_home() from public, anon;
grant execute on function public.campaign_feed(public.platform[], text[], text[], bigint, integer, text, integer, integer),
  public.join_block_reason(uuid), public.get_campaign(uuid), public.creator_home() to authenticated;

create index if not exists campaigns_feed_idx on public.campaigns(status, created_at desc) where status = 'active';
