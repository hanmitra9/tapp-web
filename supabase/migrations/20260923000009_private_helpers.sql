-- TAPP · 0009 · Move RLS helper functions out of the API-exposed schema.
-- They stay callable inside policies/functions, but can no longer be invoked as /rest/v1/rpc/* by clients
-- (which could otherwise reveal e.g. the status or brand of a draft campaign).

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

alter function public.is_campaign_member(uuid, boolean) set schema private;
alter function public.campaign_brand_id(uuid)          set schema private;
alter function public.campaign_status_of(uuid)         set schema private;
alter function public.can_manage_campaign(uuid)        set schema private;
alter function public.can_view_campaign(uuid)          set schema private;
alter function public.can_view_submission(uuid)        set schema private;
alter function public.brand_can_see_creator(uuid)      set schema private;

-- Policies reference functions by OID and follow the move. Function bodies reference by name, so recreate them.
create or replace function private.can_manage_campaign(p_campaign uuid) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select public.is_admin() or public.is_brand_member(private.campaign_brand_id(p_campaign))
$$;
create or replace function private.can_view_campaign(p_campaign uuid) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select private.campaign_status_of(p_campaign) = 'active' or private.is_campaign_member(p_campaign) or private.can_manage_campaign(p_campaign)
$$;
create or replace function private.can_view_submission(p_submission uuid) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select exists (select 1 from public.submissions s where s.id = p_submission
                 and (s.creator_id = auth.uid() or private.can_manage_campaign(s.campaign_id)))
$$;
create or replace function private.brand_can_see_creator(p_creator uuid) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select exists (select 1 from public.submissions s join public.brand_members bm on bm.brand_id = private.campaign_brand_id(s.campaign_id)
                 where s.creator_id = p_creator and bm.user_id = auth.uid())
$$;

revoke execute on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;

-- get_campaign referenced the old location.
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
revoke execute on function public.get_campaign(uuid) from public, anon;
grant execute on function public.get_campaign(uuid) to authenticated;
