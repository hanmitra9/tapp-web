-- TAPP · 0065 · Per-campaign cap on videos per creator (campaigns.max_submissions_per_creator, null = no cap).
-- Enforced on insert: rejected clips don't count, so a creator can replace a rejected one. Admin sets it any time.

alter table public.campaigns add column if not exists max_submissions_per_creator integer
  check (max_submissions_per_creator is null or max_submissions_per_creator between 1 and 1000);

create or replace function private.enforce_submission_cap() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare v_cap int;
begin
  select max_submissions_per_creator into v_cap from public.campaigns where id = new.campaign_id;
  if v_cap is not null and (select count(*) from public.submissions
      where campaign_id = new.campaign_id and creator_id = new.creator_id and status <> 'rejected') >= v_cap then
    raise exception 'submission_limit_reached';
  end if;
  return new;
end $$;
drop trigger if exists submissions_cap on public.submissions;
create trigger submissions_cap before insert on public.submissions for each row execute function private.enforce_submission_cap();

create or replace function public.admin_set_submission_cap(p_campaign_id uuid, p_max integer) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare v_admin uuid := public.assert_admin(); c public.campaigns;
begin
  select * into c from public.campaigns where id = p_campaign_id for update;
  if not found then raise exception 'campaign_not_found'; end if;
  update public.campaigns set max_submissions_per_creator = nullif(p_max, 0) where id = c.id;
  perform public.write_audit('campaign.submission_cap', 'campaign', c.id,
    jsonb_build_object('max', c.max_submissions_per_creator), jsonb_build_object('max', nullif(p_max, 0)));
end $$;
revoke execute on function public.admin_set_submission_cap(uuid, integer) from public, anon;
grant execute on function public.admin_set_submission_cap(uuid, integer) to authenticated;

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
    'guidelines_do', to_jsonb(c.guidelines_do), 'guidelines_dont', to_jsonb(c.guidelines_dont), 'terms', c.terms, 'ugc_brief', c.ugc_brief, 'max_submissions_per_creator', c.max_submissions_per_creator,
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
