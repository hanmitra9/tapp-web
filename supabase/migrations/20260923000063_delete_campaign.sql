-- TAPP · 0063 · Admin can delete a campaign that never got a submission (test, duplicate, typo campaigns).
-- Anything with submissions (and so possibly earnings) keeps its history: cancel or archive it instead.
-- A running campaign that creators already joined has to be cancelled first, so they are notified with a reason.
-- Platforms, rules, assets, pricing, hashtag readings and joins go with it (on delete cascade).

create or replace function public.admin_delete_campaign(p_campaign_id uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare v_admin uuid := public.assert_admin(); c public.campaigns; v_joined int;
begin
  select * into c from public.campaigns where id = p_campaign_id for update;
  if not found then raise exception 'campaign_not_found'; end if;
  if exists (select 1 from public.submissions where campaign_id = c.id) then raise exception 'campaign_has_submissions'; end if;
  select count(*) into v_joined from public.campaign_creators where campaign_id = c.id and status = 'joined';
  if v_joined > 0 and c.status in ('active', 'paused', 'ending') then raise exception 'campaign_has_creators'; end if;
  perform public.write_audit('campaign.delete', 'campaign', c.id, to_jsonb(c), null);
  delete from public.campaigns where id = c.id;
end $$;
revoke execute on function public.admin_delete_campaign(uuid) from public, anon;
grant execute on function public.admin_delete_campaign(uuid) to authenticated;
