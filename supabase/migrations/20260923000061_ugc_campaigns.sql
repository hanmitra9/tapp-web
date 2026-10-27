-- TAPP · 0061 · UGC campaigns. campaigns.content_type becomes the campaign kind: 'clipping' (cut the brand's own
-- videos) or 'ugc' (creators make original content). Same join → submit → review → pay-per-views engine; UGC adds a
-- structured brief (campaigns.ugc_brief, set via set_campaign_ugc_brief / admin_update_campaign_copy) shown to creators: narrative, CTA, must-include, caption rules, face, duration.

set search_path = public, extensions;

update public.campaigns set content_type = 'clipping' where content_type is distinct from 'ugc';
alter table public.campaigns alter column content_type set default 'clipping';
alter table public.campaigns drop constraint if exists campaigns_content_type_kind;
alter table public.campaigns add constraint campaigns_content_type_kind check (content_type in ('clipping', 'ugc'));
alter table public.campaigns add column if not exists ugc_brief jsonb not null default '{}'::jsonb;

-- Keep only known keys, trimmed and length-capped; anything else is dropped.
create or replace function private.clean_ugc_brief(p jsonb) returns jsonb
language sql immutable set search_path = pg_catalog as $$
  select case when jsonb_typeof(p) = 'object' then jsonb_strip_nulls(jsonb_build_object(
    'brand_about',   left(nullif(btrim(p->>'brand_about'), ''), 1000),
    'narrative',     left(nullif(btrim(p->>'narrative'), ''), 2000),
    'cta',           left(nullif(btrim(p->>'cta'), ''), 300),
    'must_include',  left(nullif(btrim(p->>'must_include'), ''), 1000),
    'caption_rules', left(nullif(btrim(p->>'caption_rules'), ''), 500),
    'face',          case when p->>'face' in ('show', 'hide', 'either') then p->>'face' end,
    'duration_min',  case when (p->>'duration_min') ~ '^\d{1,3}$' then (p->>'duration_min')::int end,
    'duration_max',  case when (p->>'duration_max') ~ '^\d{1,3}$' then (p->>'duration_max')::int end
  )) else '{}'::jsonb end
$$;

-- Draft editor saves the brief right after upsert_campaign_draft (admins, or the brand's own members, drafts only).
create or replace function public.set_campaign_ugc_brief(p_id uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare c public.campaigns;
begin
  select * into c from public.campaigns where id = p_id for update;
  if not found then raise exception 'campaign_not_found'; end if;
  if not (public.is_admin() or (public.is_brand_member(c.brand_id) and c.status = 'draft')) then raise exception 'forbidden'; end if;
  update public.campaigns set ugc_brief = private.clean_ugc_brief(p) where id = p_id returning ugc_brief into c.ugc_brief;
  return c.ugc_brief;
end $$;
revoke execute on function public.set_campaign_ugc_brief(uuid, jsonb) from public, anon;
grant execute on function public.set_campaign_ugc_brief(uuid, jsonb) to authenticated;

create or replace function public.admin_update_campaign_copy(p_id uuid, p jsonb) returns public.campaigns
language plpgsql security definer set search_path = public, extensions as $$
declare v_admin uuid := public.assert_admin(); c public.campaigns; r public.campaigns;
begin
  select * into c from public.campaigns where id = p_id for update;
  if not found then raise exception 'campaign_not_found'; end if;
  update public.campaigns set
    title = coalesce(nullif(btrim(p->>'title'), ''), title),
    objective = case when p ? 'objective' then nullif(btrim(p->>'objective'), '') else objective end,
    description = case when p ? 'description' then nullif(btrim(p->>'description'), '') else description end,
    guidelines_do = case when p ? 'guidelines_do' then array(select btrim(x) from jsonb_array_elements_text(p->'guidelines_do') x where btrim(x) <> '') else guidelines_do end,
    guidelines_dont = case when p ? 'guidelines_dont' then array(select btrim(x) from jsonb_array_elements_text(p->'guidelines_dont') x where btrim(x) <> '') else guidelines_dont end,
    terms = case when p ? 'terms' then nullif(btrim(p->>'terms'), '') else terms end,
    submission_deadline = case when p ? 'submission_deadline' then nullif(p->>'submission_deadline', '')::timestamptz else submission_deadline end,
    ends_at = case when p ? 'ends_at' then nullif(p->>'ends_at', '')::timestamptz else ends_at end,
    ugc_brief = case when p ? 'ugc_brief' then private.clean_ugc_brief(p->'ugc_brief') else ugc_brief end
  where id = c.id returning * into r;
  perform public.write_audit('campaign.edit_copy', 'campaign', c.id, to_jsonb(c), to_jsonb(r));
  return r;
end $$;

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
    'guidelines_do', to_jsonb(c.guidelines_do), 'guidelines_dont', to_jsonb(c.guidelines_dont), 'terms', c.terms, 'ugc_brief', c.ugc_brief,
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
