-- Brand "Submission" tab: every clip in the campaign (any status), newest first, for the list and the CSV export.
create or replace function public.brand_submissions(p_campaign_id uuid)
returns table (submission_id uuid, creator_username text, platform public.platform, post_url text, status public.submission_status,
               published_at timestamptz, raw_views bigint, qualified_views bigint, spend bigint, pending_views bigint, last_metrics_at timestamptz)
language plpgsql stable security definer set search_path = public, extensions as $$
declare v_share numeric;
begin
  if p_campaign_id not in (select private.my_brand_campaign_ids()) then raise exception 'forbidden'; end if;
  select private.spend_share(creator_share_pct, budget_fee_pct) into v_share from public.campaign_pricing where campaign_id = p_campaign_id;
  return query
  select s.id, p.username::text, s.platform, s.post_url, s.status, s.published_at, cv.raw, s.qualified_views,
    private.brand_amount(s.earned, v_share), cv.pending, cv.last_metrics_at
  from public.submissions s
  join private.clip_views(p_campaign_id) cv on cv.submission_id = s.id
  left join public.profiles p on p.id = s.creator_id
  order by s.created_at desc
  limit 1000;
end $$;
revoke execute on function public.brand_submissions(uuid) from public, anon;
grant execute on function public.brand_submissions(uuid) to authenticated;
