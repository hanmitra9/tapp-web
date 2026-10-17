-- Rank & Rewards v2 (Monte Carlo 10,000 runs, 0 losses; scratch model in the PR): five ranks gated on lifetime
-- qualified views AND quality (approved clips, approval rate), with a smaller, steeper bonus ladder.
--   rank      views   approved clips  approval  bonus
--   new           0          0           -        0%
--   rising     150k          3           -        3%
--   verified     1M         10          60%       6%
--   proven       3M         25          70%      10%
--   elite       10M         60          75%      15%
update public.app_settings set value = '{"new": 0, "rising": 150000, "verified": 1000000, "proven": 3000000, "elite": 10000000}'::jsonb, updated_at = now()
 where key = 'tier_thresholds';
update public.app_settings set value = '{"new": 0, "rising": 3, "verified": 6, "proven": 10, "elite": 15}'::jsonb, updated_at = now()
 where key = 'tier_bonus_pct';
insert into public.app_settings (key, value) values ('tier_requirements',
  '{"min_approved": {"new": 0, "rising": 3, "verified": 10, "proven": 25, "elite": 60},
    "min_approval_pct": {"new": 0, "rising": 0, "verified": 60, "proven": 70, "elite": 75}}'::jsonb)
on conflict (key) do update set value = excluded.value, updated_at = now();

drop policy if exists app_settings_read on public.app_settings;
create policy app_settings_read on public.app_settings for select to authenticated
  using (key in ('earnings_hold_days','min_payout_idr','max_submissions_per_day','publish_grace_minutes','view_milestones',
                 'platform_oauth_config','withdrawal_fee_pct','tier_bonus_pct','withdrawal_fee_idr','creator_fee_pct',
                 'tier_thresholds','tier_requirements','referral_bonus_idr','vapid_public_key'));

-- Quality: clips accepted vs rejected (pending / in-review clips don't count either way).
create or replace function public.creator_quality(p_creator uuid, out approved bigint, out rejected bigint, out approval_pct numeric)
language sql stable security definer set search_path = public, extensions as $$
  select count(*) filter (where status in ('approved', 'tracking', 'completed')),
         count(*) filter (where status = 'rejected'),
         case when count(*) filter (where status in ('approved', 'tracking', 'completed', 'rejected')) = 0 then 100
              else round(100.0 * count(*) filter (where status in ('approved', 'tracking', 'completed'))
                         / count(*) filter (where status in ('approved', 'tracking', 'completed', 'rejected')), 1) end
  from public.submissions where creator_id = p_creator
$$;
revoke execute on function public.creator_quality(uuid) from public, anon, authenticated;

-- Highest rank whose views, approved-clips and approval-rate bars are all met.
create or replace function public.tier_for_creator(p_creator uuid) returns public.creator_tier
language plpgsql stable security definer set search_path = public, extensions as $$
declare v_views bigint := public.lifetime_qualified_views(p_creator); q record; th jsonb; rq jsonb; t text; v_tier text := 'new';
begin
  select * into q from public.creator_quality(p_creator);
  select value into th from public.app_settings where key = 'tier_thresholds';
  select value into rq from public.app_settings where key = 'tier_requirements';
  foreach t in array array['rising', 'verified', 'proven', 'elite'] loop
    exit when v_views < coalesce((th->>t)::bigint, 0)
           or q.approved < coalesce((rq->'min_approved'->>t)::bigint, 0)
           or q.approval_pct < coalesce((rq->'min_approval_pct'->>t)::numeric, 0);
    v_tier := t;
  end loop;
  return v_tier::public.creator_tier;
end $$;
revoke execute on function public.tier_for_creator(uuid) from public, anon, authenticated;

create or replace function public.recompute_tier(p_creator uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare v_new public.creator_tier; v_old public.creator_tier;
        v_label constant jsonb := '{"new":"New","rising":"Rising","verified":"Verified","proven":"Proven","elite":"Elite"}'::jsonb;
begin
  select tier into v_old from public.creator_profiles where user_id = p_creator for update;
  if not found then return; end if;
  v_new := public.tier_for_creator(p_creator);
  if v_new = v_old then return; end if;
  update public.creator_profiles set tier = v_new where user_id = p_creator;
  perform public.write_audit('creator.tier_change', 'creator_profile', p_creator,
    jsonb_build_object('tier', v_old), jsonb_build_object('tier', v_new, 'lifetime_qualified_views', public.lifetime_qualified_views(p_creator)));
  if v_new > v_old then
    perform public.notify(p_creator, 'tier_change', 'Naik rank: ' || (v_label->>v_new::text) || ' Clipper',
      format('Selamat! Kamu sekarang %s Clipper. Bonus tarik saldomu ikut naik.', v_label->>v_new::text),
      jsonb_build_object('tier', v_new));
  end if;
end $$;
revoke execute on function public.recompute_tier(uuid) from public, anon, authenticated;

-- Approval rate changes when a clip is accepted or rejected, so re-rank on every status change.
create or replace function private.rerank_on_status() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  if new.status is distinct from old.status then perform public.recompute_tier(new.creator_id); end if;
  return new;
end $$;
drop trigger if exists submissions_rerank on public.submissions;
create trigger submissions_rerank after update of status on public.submissions
  for each row execute function private.rerank_on_status();

-- Progress read model: views plus the two quality bars, for the current and the next rank.
create or replace function public.my_tier_progress() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare v_uid uuid := auth.uid(); v_views bigint; v_tier public.creator_tier; v_thresholds jsonb; v_req jsonb; q record;
        v_order text[] := array['new','rising','verified','proven','elite']; v_idx int; v_next text; v_next_at bigint;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select tier into v_tier from public.creator_profiles where user_id = v_uid;
  if not found then raise exception 'creator_profile_not_found'; end if;
  v_views := public.lifetime_qualified_views(v_uid);
  select * into q from public.creator_quality(v_uid);
  select value into v_thresholds from public.app_settings where key = 'tier_thresholds';
  select value into v_req from public.app_settings where key = 'tier_requirements';
  v_idx := array_position(v_order, v_tier::text);
  v_next := case when v_idx < 5 then v_order[v_idx + 1] end;
  v_next_at := case when v_next is not null then (v_thresholds->>v_next)::bigint end;
  return jsonb_build_object(
    'tier', v_tier, 'lifetime_qualified_views', v_views,
    'next_tier', v_next, 'views_to_next', case when v_next_at is not null then greatest(v_next_at - v_views, 0) end,
    'thresholds', v_thresholds, 'requirements', v_req,
    'approved', q.approved, 'approval_pct', q.approval_pct
  );
end $$;
revoke execute on function public.my_tier_progress() from public, anon;
grant execute on function public.my_tier_progress() to authenticated;

-- Re-rank everyone under the new rules (moves both ways; promotions notify).
do $$ declare r record; begin
  for r in select user_id from public.creator_profiles loop perform public.recompute_tier(r.user_id); end loop;
end $$;
