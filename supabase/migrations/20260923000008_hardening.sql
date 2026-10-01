-- TAPP · 0008 · Privilege hardening (applied after a Supabase advisor review)
-- anon (not logged in) never needs to call anything in public. Authenticated keeps its explicit grants.
revoke execute on all functions in schema public from public, anon;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon;
alter default privileges for role postgres in schema public revoke all on tables from anon;
grant execute on function public.is_campaign_member(uuid,boolean), public.campaign_brand_id(uuid), public.campaign_status_of(uuid),
  public.can_manage_campaign(uuid), public.can_view_campaign(uuid), public.can_view_submission(uuid), public.brand_can_see_creator(uuid)
  to authenticated;
