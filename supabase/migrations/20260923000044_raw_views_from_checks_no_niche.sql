-- TAPP · 0044 · Raw views follow the automatic checks; creators no longer pick a niche.
--
-- 1. Every successful public reading of a clip (at submit, "Cek ulang", the 6-hourly sweep) is also stored as a
--    raw-views metric (content_metrics, source 'api'), so the brand report's raw / "menunggu verifikasi" views and
--    the daily curve move on their own. Qualified views (what is paid and billed) still change only when the admin
--    pays. The reading never changes a submission's status: a post that cannot be read is left for the admin.
-- 2. Niche is no longer asked at onboarding (TAPP campaigns are not niche-based); existing values stay unused.

set search_path = public, extensions;

create or replace function public.record_check_metrics(
  p_submission_id uuid, p_views bigint, p_likes bigint, p_comments bigint, p_shares bigint
) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare s public.submissions;
begin
  select * into s from public.submissions where id = p_submission_id for update;
  if not found or p_views is null or p_views < 0 then return; end if;
  if s.status in ('rejected', 'needs_changes') then return; end if;
  insert into public.content_metrics (submission_id, captured_at, views, likes, comments, shares, saves, source, raw)
  values (s.id, now(), p_views, greatest(coalesce(p_likes, 0), 0), greatest(coalesce(p_comments, 0), 0), greatest(coalesce(p_shares, 0), 0), 0,
          'api', jsonb_build_object('via', 'submission-check'));
  update public.submissions set last_metrics_at = now() where id = s.id;
end $$;
revoke execute on function public.record_check_metrics(uuid, bigint, bigint, bigint, bigint) from public, anon, authenticated;
grant execute on function public.record_check_metrics(uuid, bigint, bigint, bigint, bigint) to service_role;

create or replace function public.complete_creator_onboarding(
  p_full_name text, p_username text, p_country text, p_main_platform public.platform,
  p_niches text[], p_content_categories text[], p_content_style text,
  p_audience jsonb, p_experience_level text
) returns public.creator_profiles
language plpgsql security definer set search_path = public, extensions as $$
declare v_uid uuid := auth.uid(); r public.creator_profiles;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from auth.users where id = v_uid and email_confirmed_at is not null) then
    raise exception 'email_not_verified';
  end if;
  select * into r from public.creator_profiles where user_id = v_uid for update;
  if r.status in ('suspended','banned') then raise exception 'creator_not_eligible:%', r.status; end if;
  if not exists (select 1 from public.creator_platforms where creator_id = v_uid) then raise exception 'platform_required'; end if;
  if not exists (select 1 from public.creator_platforms where creator_id = v_uid and platform = p_main_platform) then
    raise exception 'main_platform_not_linked';
  end if;
  if not exists (select 1 from public.creator_payout_methods where creator_id = v_uid) then raise exception 'payout_method_required'; end if;

  begin
    update public.profiles set full_name = btrim(p_full_name), username = lower(btrim(p_username)), country = upper(p_country)
    where id = v_uid;
  exception when unique_violation then raise exception 'username_taken';
  end;

  update public.creator_profiles set
    main_platform = p_main_platform, niches = coalesce(p_niches, '{}'), content_categories = coalesce(p_content_categories, '{}'),
    content_style = p_content_style, audience = coalesce(p_audience, '{}'), experience_level = p_experience_level,
    onboarding_completed_at = coalesce(onboarding_completed_at, now()),
    status = case when status = 'pending' then 'verified'::public.creator_status else status end,
    status_changed_at = case when status = 'pending' then now() else status_changed_at end
  where user_id = v_uid returning * into r;
  return r;
end $$;
