-- TAPP · 0061 · UGC campaigns. campaigns.content_type becomes the campaign kind: 'clipping' (cut the brand's own
-- videos) or 'ugc' (creators make original content). Same join → submit → review → pay-per-views engine; UGC adds a
-- structured brief (campaigns.ugc_brief) shown to creators: narrative, CTA, must-include, caption rules, face, duration.

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

create or replace function public.upsert_campaign_draft(p_id uuid, p jsonb) returns public.campaigns
language plpgsql security definer set search_path = public, extensions as $$
declare c public.campaigns; r public.campaigns; v_brand uuid := (p->>'brand_id')::uuid; v_plats public.platform[]; v_share numeric;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if p_id is not null then
    select * into c from public.campaigns where id = p_id for update;
    if not found then raise exception 'campaign_not_found'; end if;
    if c.status <> 'draft' then raise exception 'terms_locked_after_draft'; end if;
    v_brand := c.brand_id;
  end if;
  if v_brand is null or not exists (select 1 from public.brands where id = v_brand) then raise exception 'brand_required'; end if;
  if not (public.is_admin() or public.is_brand_member(v_brand)) then raise exception 'forbidden'; end if;

  v_plats := coalesce(array(select jsonb_array_elements_text(p->'platforms'))::public.platform[], '{}');
  if coalesce(nullif(btrim(p->>'title'), ''), '') = '' then raise exception 'title_required'; end if;
  if coalesce((p->>'cpm')::bigint, 0) <= 0 then raise exception 'cpm_required'; end if;
  if coalesce(nullif(p->>'content_type', ''), 'clipping') not in ('clipping', 'ugc') then raise exception 'invalid_content_type'; end if;
  if coalesce((p->>'budget')::bigint, 0) <= 0 then raise exception 'budget_required'; end if;

  v_share := coalesce((select creator_share_pct from public.campaign_pricing where campaign_id = p_id),
                      private.setting_num('creator_share_pct', 70));
  if public.is_admin() and nullif(p->>'creator_share_pct', '') is not null then v_share := (p->>'creator_share_pct')::numeric; end if;
  if v_share <= 0 or v_share > 100 then raise exception 'invalid_creator_share'; end if;

  if p_id is null then
    insert into public.campaigns (brand_id, title, category, cpm, budget, created_by)
    values (v_brand, btrim(p->>'title'), coalesce(nullif(p->>'category', ''), 'other'), (p->>'cpm')::bigint, (p->>'budget')::bigint, auth.uid())
    returning * into c;
  end if;

  update public.campaigns set
    title = btrim(p->>'title'), objective = nullif(btrim(p->>'objective'), ''), description = nullif(btrim(p->>'description'), ''),
    category = coalesce(nullif(p->>'category', ''), category), content_type = coalesce(nullif(p->>'content_type', ''), content_type),
    max_earning_per_submission = nullif(p->>'max_earning_per_submission', '')::bigint,
    min_views_to_qualify = coalesce(nullif(p->>'min_views_to_qualify', '')::int, 0),
    starts_at = nullif(p->>'starts_at', '')::timestamptz, ends_at = nullif(p->>'ends_at', '')::timestamptz,
    submission_deadline = nullif(p->>'submission_deadline', '')::timestamptz,
    guidelines_do = coalesce(array(select btrim(x) from jsonb_array_elements_text(p->'guidelines_do') x where btrim(x) <> ''), '{}'),
    guidelines_dont = coalesce(array(select btrim(x) from jsonb_array_elements_text(p->'guidelines_dont') x where btrim(x) <> ''), '{}'),
    terms = nullif(btrim(p->>'terms'), ''),
    ugc_brief = case when p ? 'ugc_brief' then private.clean_ugc_brief(p->'ugc_brief') else ugc_brief end
  where id = c.id;

  insert into public.campaign_pricing (campaign_id, brand_cpm, brand_budget, creator_share_pct)
  values (c.id, (p->>'cpm')::bigint, (p->>'budget')::bigint, v_share)
  on conflict (campaign_id) do update set brand_cpm = excluded.brand_cpm, brand_budget = excluded.brand_budget,
    creator_share_pct = excluded.creator_share_pct;
  select * into r from public.campaigns where id = c.id;

  delete from public.campaign_platforms where campaign_id = c.id;
  insert into public.campaign_platforms (campaign_id, platform) select c.id, x from unnest(v_plats) x on conflict do nothing;

  if p ? 'rules' then
    delete from public.campaign_rules where campaign_id = c.id;
    insert into public.campaign_rules (campaign_id, kind, body, sort)
    select c.id, e->>'kind', btrim(e->>'body'), ord::int from jsonb_array_elements(p->'rules') with ordinality t(e, ord)
    where btrim(coalesce(e->>'body', '')) <> '';
  end if;

  perform public.write_audit(case when p_id is null then 'campaign.create' else 'campaign.edit' end, 'campaign', c.id,
    case when p_id is null then null else to_jsonb(c) end,
    to_jsonb(r) || jsonb_build_object('brand_cpm', (p->>'cpm')::bigint, 'brand_budget', (p->>'budget')::bigint, 'creator_share_pct', v_share));
  return r;
end $$;

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
