-- TAPP · 0018 · Public campaign listing for the marketing site (read-only, safe fields only)

set search_path = public, extensions;

-- Anyone (signed out) can see which campaigns are open, their rate and rules. Nothing about budgets in rupiah,
-- creators, submissions or earnings is exposed: only the share of budget left.
create or replace function public.public_campaigns()
returns table (
  id uuid, title text, brand_name text, category text, content_type text, cpm bigint,
  min_views_to_qualify integer, max_earning_per_submission bigint, platforms text[],
  budget_left_pct integer, submission_deadline timestamptz, status public.campaign_status
)
language sql stable security definer set search_path = public, extensions as $$
  select c.id, c.title, b.name, c.category, c.content_type, c.cpm, c.min_views_to_qualify, c.max_earning_per_submission,
    array(select k.platform::text from public.campaign_platforms k where k.campaign_id = c.id order by 1),
    greatest(0, least(100, round(100.0 * (c.budget - c.earned) / nullif(c.budget, 0))))::int,
    c.submission_deadline, c.status
  from public.campaigns c join public.brands b on b.id = c.brand_id
  where c.status in ('active', 'ending') and b.status = 'active'
  order by c.approved_at desc nulls last, c.created_at desc
  limit 60
$$;
revoke execute on function public.public_campaigns() from public;
grant execute on function public.public_campaigns() to anon, authenticated;
