-- TAPP · 0040 · Show who has joined a campaign on every campaign card.
--
-- A creator must join a campaign before submitting (check_submission → not_a_member). The public campaign list and
-- the creator app now carry how many creators joined, plus up to 5 initials of the latest joiners for the
-- avatar stack. Only initials leave the database — no names, usernames or ids.

set search_path = public, extensions;

-- Initials of a creator: first letters of the first two words of the full name, else of the username.
create or replace function private.initials(p_name text, p_username text) returns text
language sql immutable set search_path = public, extensions as $$
  select upper(coalesce(
    nullif(left(split_part(btrim(p_name), ' ', 1), 1) || left(split_part(btrim(p_name), ' ', 2), 1), ''),
    left(nullif(btrim(p_username), ''), 2),
    'C'))
$$;

-- Per-campaign participation for a set of campaigns (only campaigns that are open to the public).
create or replace function public.campaign_participation(p_ids uuid[])
returns table (campaign_id uuid, creators_joined integer, initials text[])
language sql stable security definer set search_path = public, extensions as $$
  select c.id,
    (select count(*)::int from public.campaign_creators m where m.campaign_id = c.id and m.status = 'joined'),
    coalesce((select array_agg(x.i) from (
        select private.initials(p.full_name, p.username) i
        from public.campaign_creators m join public.profiles p on p.id = m.creator_id
        where m.campaign_id = c.id and m.status = 'joined'
        order by m.joined_at desc limit 5) x), '{}')
  from public.campaigns c
  where c.id = any(p_ids) and c.status in ('active', 'ending', 'paused', 'completed')
$$;
revoke execute on function public.campaign_participation(uuid[]) from public;
grant execute on function public.campaign_participation(uuid[]) to anon, authenticated;

-- Public campaign list (website) gains the participation (return type changes, so drop + create).
drop function if exists public.public_campaigns();
create function public.public_campaigns()
returns table (
  id uuid, title text, brand_name text, category text, content_type text, cpm bigint,
  min_views_to_qualify integer, max_earning_per_submission bigint, platforms text[],
  budget_left_pct integer, submission_deadline timestamptz, status public.campaign_status, banner_url text,
  creators_joined integer, joined_initials text[]
)
language sql stable security definer set search_path = public, extensions as $$
  select c.id, c.title, b.name, c.category, c.content_type, c.cpm, c.min_views_to_qualify, c.max_earning_per_submission,
    array(select k.platform::text from public.campaign_platforms k where k.campaign_id = c.id order by 1),
    greatest(0, least(100, round(100.0 * (c.budget - c.earned) / nullif(c.budget, 0))))::int,
    c.submission_deadline, c.status, c.banner_url, p.creators_joined, p.initials
  from public.campaigns c
  join public.brands b on b.id = c.brand_id
  left join lateral public.campaign_participation(array[c.id]) p on true
  where c.status in ('active', 'ending') and b.status = 'active'
  order by c.approved_at desc nulls last, c.created_at desc
  limit 60
$$;
revoke execute on function public.public_campaigns() from public;
grant execute on function public.public_campaigns() to anon, authenticated;
