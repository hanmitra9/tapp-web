-- TAPP · 0036 · Campaign banner photo.
--
-- Admin uploads a banner (2:1, at least 1200×600, JPG/PNG/WebP, max 2 MB — the shape of the TAPP Campaign card
-- header) when creating or editing a campaign. Stored in the public bucket "campaign-banners" under
-- <campaign_id>/<file>; campaigns.banner_url holds its public URL. Shown on the creator app's campaign cards and
-- detail page and on the public /campaigns page. No banner = the default TAPP gradient.

set search_path = public, extensions;

alter table public.campaigns add column if not exists banner_url text;
alter table public.campaigns drop constraint if exists campaigns_banner_url_https;
alter table public.campaigns add constraint campaigns_banner_url_https check (banner_url is null or banner_url ~ '^https://');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('campaign-banners', 'campaign-banners', true, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

drop policy if exists campaign_banners_insert on storage.objects;
drop policy if exists campaign_banners_update on storage.objects;
drop policy if exists campaign_banners_delete on storage.objects;
create policy campaign_banners_insert on storage.objects for insert to authenticated with check (bucket_id = 'campaign-banners' and public.is_admin());
create policy campaign_banners_update on storage.objects for update to authenticated using (bucket_id = 'campaign-banners' and public.is_admin());
create policy campaign_banners_delete on storage.objects for delete to authenticated using (bucket_id = 'campaign-banners' and public.is_admin());

create or replace function public.admin_set_campaign_banner(p_campaign_id uuid, p_url text) returns public.campaigns
language plpgsql security definer set search_path = public, extensions as $$
declare v_admin uuid := public.assert_admin(); c public.campaigns; r public.campaigns;
begin
  select * into c from public.campaigns where id = p_campaign_id for update;
  if not found then raise exception 'campaign_not_found'; end if;
  if p_url is not null and p_url !~ '^https://' then raise exception 'invalid_banner_url'; end if;
  update public.campaigns set banner_url = nullif(btrim(p_url), '') where id = c.id returning * into r;
  perform public.write_audit('campaign.banner', 'campaign', c.id, jsonb_build_object('banner_url', c.banner_url), jsonb_build_object('banner_url', r.banner_url));
  return r;
end $$;
revoke execute on function public.admin_set_campaign_banner(uuid, text) from public, anon;
grant execute on function public.admin_set_campaign_banner(uuid, text) to authenticated;

-- Public campaign list (website) gains the banner (return type changes, so drop + create).
drop function if exists public.public_campaigns();
create function public.public_campaigns()
returns table (
  id uuid, title text, brand_name text, category text, content_type text, cpm bigint,
  min_views_to_qualify integer, max_earning_per_submission bigint, platforms text[],
  budget_left_pct integer, submission_deadline timestamptz, status public.campaign_status, banner_url text
)
language sql stable security definer set search_path = public, extensions as $$
  select c.id, c.title, b.name, c.category, c.content_type, c.cpm, c.min_views_to_qualify, c.max_earning_per_submission,
    array(select k.platform::text from public.campaign_platforms k where k.campaign_id = c.id order by 1),
    greatest(0, least(100, round(100.0 * (c.budget - c.earned) / nullif(c.budget, 0))))::int,
    c.submission_deadline, c.status, c.banner_url
  from public.campaigns c join public.brands b on b.id = c.brand_id
  where c.status in ('active', 'ending') and b.status = 'active'
  order by c.approved_at desc nulls last, c.created_at desc
  limit 60
$$;
revoke execute on function public.public_campaigns() from public;
grant execute on function public.public_campaigns() to anon, authenticated;
