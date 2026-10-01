-- TAPP · 0002 · Server-side business logic
-- All state transitions and every financial calculation happen here. Clients only call these RPCs.
-- Errors are raised as stable machine codes (e.g. 'duplicate_submission'); the app maps them to copy.

set search_path = public, extensions;

-- ─────────────────────────────── Primitives ──────────────────────────
create or replace function public.setting_int(p_key text) returns bigint
language sql stable security definer set search_path = public, extensions as $$
  select (value #>> '{}')::bigint from public.app_settings where key = p_key
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
$$;

create or replace function public.is_brand_member(p_brand_id uuid) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select exists (select 1 from public.brand_members where brand_id = p_brand_id and user_id = auth.uid())
$$;

create or replace function public.assert_admin() returns uuid
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return auth.uid();
end $$;

create or replace function public.assert_active_creator() returns uuid
language plpgsql stable security definer set search_path = public, extensions as $$
declare v_uid uuid := auth.uid(); v_status public.creator_status;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select status into v_status from public.creator_profiles where user_id = v_uid;
  if v_status is null then raise exception 'creator_profile_missing'; end if;
  if v_status <> 'active' then raise exception 'creator_not_eligible:%', v_status; end if;
  return v_uid;
end $$;

create or replace function public.write_audit(
  p_action text, p_entity_type text, p_entity_id uuid,
  p_before jsonb default null, p_after jsonb default null, p_metadata jsonb default '{}'
) returns void
language sql security definer set search_path = public, extensions as $$
  insert into public.audit_logs (actor_id, actor_role, action, entity_type, entity_id, before, after, metadata)
  values (auth.uid(), (select role from public.profiles where id = auth.uid()),
          p_action, p_entity_type, p_entity_id, p_before, p_after, coalesce(p_metadata, '{}'));
$$;

create or replace function public.notify(p_user uuid, p_type text, p_title text, p_body text, p_data jsonb default '{}')
returns void
language sql security definer set search_path = public, extensions as $$
  insert into public.notifications (user_id, type, title, body, data) values (p_user, p_type, p_title, p_body, coalesce(p_data,'{}'));
$$;

create or replace function public.format_idr(p_amount bigint) returns text
language sql immutable set search_path = public as $$
  select 'Rp' || replace(to_char(p_amount, 'FM999,999,999,999,990'), ',', '.')
$$;

-- ─────────────────────────────── URL handling ────────────────────────
-- Canonical form used for duplicate detection. Host is lower-cased; path keeps case (IDs are case-sensitive).
create or replace function public.normalize_post_url(p_url text) returns text
language plpgsql immutable set search_path = public as $$
declare
  v text := btrim(coalesce(p_url, ''));
  m text[]; host text; path text; query text;
begin
  m := regexp_match(v, '^https?://([^/?#\s]+)([^?#\s]*)(\?[^#\s]*)?(#.*)?$', 'i');
  if m is null then return null; end if;
  host  := regexp_replace(lower(m[1]), '^(www\.|m\.|mobile\.)', '');
  host  := regexp_replace(host, ':\d+$', '');
  path  := regexp_replace(coalesce(m[2], ''), '/+$', '');
  query := coalesce(m[3], '');
  if host = 'twitter.com' then host := 'x.com'; end if;
  if host = 'instagr.am' then host := 'instagram.com'; end if;
  if host in ('youtube.com', 'youtu.be', 'music.youtube.com') then
    m := coalesce(
      regexp_match(query, '[?&]v=([A-Za-z0-9_-]{6,})'),
      regexp_match(path, '^/(?:shorts|embed|live)/([A-Za-z0-9_-]{6,})'),
      case when host = 'youtu.be' then regexp_match(path, '^/([A-Za-z0-9_-]{6,})') end);
    if m is not null then return 'youtube.com/watch/' || m[1]; end if;
  end if;
  if host = 'instagram.com' then  -- /reels/ID and /reel/ID are the same post
    path := regexp_replace(path, '^/reels/', '/reel/');
  end if;
  return host || path;
end $$;

create or replace function public.platform_for_host(p_normalized text) returns public.platform
language sql immutable set search_path = public as $$
  select case
    when p_normalized ~ '^(tiktok\.com)/' then 'tiktok'::public.platform
    when p_normalized ~ '^instagram\.com/(p|reel|tv)/' then 'instagram'
    when p_normalized ~ '^youtube\.com/watch/' then 'youtube'
    when p_normalized ~ '^x\.com/[^/]+/status/' then 'x'
    when p_normalized ~ '^(facebook\.com|fb\.watch)/' then 'facebook'
    else null end
$$;

-- ─────────────────────────────── Onboarding ──────────────────────────
-- Called at the end of onboarding. Platforms and payout method are inserted by the client beforehand (RLS-guarded).
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
  if coalesce(array_length(p_niches, 1), 0) = 0 then raise exception 'niche_required'; end if;
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
    main_platform = p_main_platform, niches = p_niches, content_categories = coalesce(p_content_categories, '{}'),
    content_style = p_content_style, audience = coalesce(p_audience, '{}'), experience_level = p_experience_level,
    onboarding_completed_at = coalesce(onboarding_completed_at, now()),
    status = case when status = 'pending' then 'verified'::public.creator_status else status end,
    status_changed_at = case when status = 'pending' then now() else status_changed_at end
  where user_id = v_uid returning * into r;
  return r;
end $$;

-- ─────────────────────────────── Campaign membership ─────────────────
create or replace function public.join_campaign(p_campaign_id uuid) returns public.campaign_creators
language plpgsql security definer set search_path = public, extensions as $$
declare v_uid uuid := public.assert_active_creator(); c public.campaigns; r public.campaign_creators;
begin
  select * into c from public.campaigns where id = p_campaign_id;
  if not found then raise exception 'campaign_not_found'; end if;
  if c.status <> 'active' then raise exception 'campaign_not_active'; end if;
  if c.starts_at is not null and c.starts_at > now() then raise exception 'campaign_not_started'; end if;
  if c.submission_deadline is not null and c.submission_deadline < now() then raise exception 'campaign_closed'; end if;
  if not c.budget_override and c.earned >= c.budget then raise exception 'campaign_budget_exhausted'; end if;
  if not exists (
    select 1 from public.creator_platforms cp
    join public.campaign_platforms kp on kp.platform = cp.platform
    where cp.creator_id = v_uid and kp.campaign_id = c.id
  ) then raise exception 'platform_not_eligible'; end if;

  select * into r from public.campaign_creators where campaign_id = c.id and creator_id = v_uid for update;
  if found then
    if r.status = 'joined' then return r; end if;                         -- idempotent
    if r.status = 'removed' then raise exception 'membership_removed'; end if;
    update public.campaign_creators set status = 'joined', joined_at = now(), left_at = null, status_reason = null
    where id = r.id returning * into r;
    return r;
  end if;

  insert into public.campaign_creators (campaign_id, creator_id) values (c.id, v_uid)
  on conflict (campaign_id, creator_id) do nothing returning * into r;
  if r.id is null then select * into r from public.campaign_creators where campaign_id = c.id and creator_id = v_uid; end if;
  return r;
end $$;

create or replace function public.leave_campaign(p_campaign_id uuid) returns public.campaign_creators
language plpgsql security definer set search_path = public, extensions as $$
declare v_uid uuid := auth.uid(); r public.campaign_creators;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  update public.campaign_creators set status = 'left', left_at = now()
  where campaign_id = p_campaign_id and creator_id = v_uid and status = 'joined' returning * into r;
  if r.id is null then raise exception 'not_a_member'; end if;
  -- Existing submissions keep tracking and earning; the creator just can't submit new ones.
  return r;
end $$;

-- ─────────────────────────────── Submissions ─────────────────────────
create or replace function public.submit_content(
  p_campaign_id uuid, p_platform public.platform, p_post_url text, p_published_at timestamptz,
  p_caption text default null, p_screenshot_path text default null
) returns public.submissions
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_uid uuid := public.assert_active_creator();
  c public.campaigns; m public.campaign_creators; r public.submissions;
  v_norm text := public.normalize_post_url(p_post_url);
  v_detected public.platform;
begin
  select * into c from public.campaigns where id = p_campaign_id;
  if not found then raise exception 'campaign_not_found'; end if;
  select * into m from public.campaign_creators where campaign_id = c.id and creator_id = v_uid;
  if not found or m.status <> 'joined' then raise exception 'not_a_member'; end if;
  if c.status <> 'active' then raise exception 'campaign_not_accepting'; end if;
  if c.submission_deadline is not null and c.submission_deadline < now() then raise exception 'submission_deadline_passed'; end if;
  if not c.budget_override and c.earned >= c.budget then raise exception 'campaign_budget_exhausted'; end if;

  if v_norm is null then raise exception 'invalid_url'; end if;
  if v_norm ~ '^(vm|vt)\.tiktok\.com/' then raise exception 'short_link_not_allowed'; end if;
  if not exists (select 1 from public.campaign_platforms where campaign_id = c.id and platform = p_platform) then
    raise exception 'platform_not_allowed';
  end if;
  v_detected := public.platform_for_host(v_norm);
  if p_platform <> 'other' and v_detected is distinct from p_platform then raise exception 'url_platform_mismatch'; end if;
  if not exists (select 1 from public.creator_platforms where creator_id = v_uid and platform = p_platform) then
    raise exception 'platform_account_not_linked';
  end if;

  if p_published_at is null or p_published_at > now() + interval '5 minutes' then raise exception 'invalid_published_at'; end if;
  if p_published_at < m.joined_at - make_interval(mins => public.setting_int('publish_grace_minutes')::int)
     or (c.starts_at is not null and p_published_at < c.starts_at) then
    raise exception 'published_before_join';
  end if;
  if p_screenshot_path is not null and split_part(p_screenshot_path, '/', 1) <> v_uid::text then
    raise exception 'invalid_screenshot_path';
  end if;

  -- Resubmission after "needs changes" reuses the same row.
  select * into r from public.submissions where normalized_url = v_norm for update;
  if found then
    if r.creator_id = v_uid and r.campaign_id = c.id and r.status = 'needs_changes' then
      update public.submissions set
        platform = p_platform, post_url = btrim(p_post_url), published_at = p_published_at,
        caption = p_caption, screenshot_path = coalesce(p_screenshot_path, screenshot_path),
        status = 'pending_review', review_reason = null, reviewed_by = null, reviewed_at = null
      where id = r.id returning * into r;
      return r;
    end if;
    raise exception 'duplicate_submission';
  end if;

  if (select count(*) from public.submissions where creator_id = v_uid and created_at > now() - interval '24 hours')
     >= public.setting_int('max_submissions_per_day') then
    raise exception 'submission_rate_limited';
  end if;

  begin
    insert into public.submissions (campaign_id, creator_id, membership_id, platform, post_url, normalized_url,
                                    published_at, caption, screenshot_path)
    values (c.id, v_uid, m.id, p_platform, btrim(p_post_url), v_norm, p_published_at, p_caption, p_screenshot_path)
    returning * into r;
  exception when unique_violation then raise exception 'duplicate_submission';  -- lost a race
  end;
  return r;
end $$;

create or replace function public.admin_review_submission(
  p_submission_id uuid, p_decision public.submission_status, p_reason text default null
) returns public.submissions
language plpgsql security definer set search_path = public, extensions as $$
declare v_admin uuid := public.assert_admin(); s public.submissions; r public.submissions; v_title text;
begin
  if p_decision not in ('approved','rejected','needs_changes','flagged') then raise exception 'invalid_decision'; end if;
  if p_decision <> 'approved' and nullif(btrim(p_reason), '') is null then raise exception 'reason_required'; end if;
  select * into s from public.submissions where id = p_submission_id for update;
  if not found then raise exception 'submission_not_found'; end if;
  if not (
       (s.status in ('pending_review','flagged') and p_decision in ('approved','rejected','needs_changes','flagged'))
    or (s.status in ('approved','tracking') and p_decision in ('flagged','rejected'))
  ) or s.status = p_decision then
    raise exception 'invalid_transition:%->%', s.status, p_decision;
  end if;
  if p_decision = 'rejected' and s.earned > 0 then raise exception 'reverse_earnings_first'; end if;

  update public.submissions set
    status = case when p_decision = 'approved' and s.last_metrics_at is not null then 'tracking' else p_decision end,
    review_reason = case when p_decision = 'approved' then null else btrim(p_reason) end,
    reviewed_by = v_admin, reviewed_at = now()
  where id = s.id returning * into r;

  select title into v_title from public.campaigns where id = s.campaign_id;
  if p_decision = 'approved' then
    perform public.notify(s.creator_id, 'submission_approved', 'Submission disetujui',
      format('Klip kamu untuk %s disetujui. Views sekarang mulai dilacak.', v_title), jsonb_build_object('submission_id', s.id));
  elsif p_decision = 'rejected' then
    perform public.notify(s.creator_id, 'submission_rejected', 'Submission ditolak',
      format('Ditolak: %s', btrim(p_reason)), jsonb_build_object('submission_id', s.id));
  elsif p_decision = 'needs_changes' then
    perform public.notify(s.creator_id, 'submission_needs_changes', 'Perlu revisi',
      format('Perbarui klip kamu untuk %s: %s', v_title, btrim(p_reason)), jsonb_build_object('submission_id', s.id));
  end if;
  perform public.write_audit('submission.review', 'submission', s.id,
    jsonb_build_object('status', s.status), jsonb_build_object('status', r.status, 'reason', r.review_reason));
  return r;
end $$;

-- ─────────────────────────────── Performance engine ──────────────────
-- Step 1: record raw metrics (manual now; an API ingestor calls the same function later via service role).
create or replace function public.admin_record_metrics(
  p_submission_id uuid, p_views bigint, p_likes bigint default 0, p_comments bigint default 0,
  p_shares bigint default 0, p_saves bigint default 0, p_captured_at timestamptz default now(),
  p_source public.metric_source default 'manual', p_content_state public.content_state default 'live',
  p_raw jsonb default '{}'
) returns public.content_metrics
language plpgsql security definer set search_path = public, extensions as $$
declare v_admin uuid := public.assert_admin(); s public.submissions; r public.content_metrics; v_last bigint;
begin
  select * into s from public.submissions where id = p_submission_id for update;
  if not found then raise exception 'submission_not_found'; end if;
  if s.status not in ('approved','tracking','flagged') then raise exception 'submission_not_trackable:%', s.status; end if;
  if p_captured_at > now() + interval '5 minutes' then raise exception 'invalid_captured_at'; end if;

  insert into public.content_metrics (submission_id, captured_at, views, likes, comments, shares, saves, source, raw, recorded_by)
  values (s.id, p_captured_at, p_views, p_likes, p_comments, p_shares, p_saves, p_source, coalesce(p_raw,'{}'), v_admin)
  returning * into r;

  select views into v_last from public.content_metrics
  where submission_id = s.id and id <> r.id order by captured_at desc limit 1;

  update public.submissions set
    last_metrics_at = greatest(coalesce(last_metrics_at, p_captured_at), p_captured_at),
    content_state = p_content_state,
    status = case
      when p_content_state in ('deleted','private') then 'flagged'
      when status = 'approved' then 'tracking'
      else status end,
    review_reason = case
      when p_content_state in ('deleted','private') then format('Postingan %s di platform.', case p_content_state when 'deleted' then 'sudah dihapus' else 'diprivat' end)
      else review_reason end
  where id = s.id;

  perform public.write_audit('metrics.record', 'submission', s.id, null,
    jsonb_build_object('metric_id', r.id, 'views', p_views, 'content_state', p_content_state),
    jsonb_build_object('views_dropped', v_last is not null and p_views < v_last));
  return r;
end $$;

-- Step 2: qualify views → earnings. Totals-based (not delta-based) so rounding never drifts.
create or replace function public.admin_qualify_views(
  p_submission_id uuid, p_metric_id uuid, p_qualified_views bigint,
  p_note text default null, p_allow_decrease boolean default false
) returns public.performance_snapshots
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_admin uuid := public.assert_admin();
  s public.submissions; c public.campaigns; mt public.content_metrics; snap public.performance_snapshots;
  v_payable_views bigint; v_target bigint; v_delta bigint; v_capped boolean := false;
  v_milestone bigint;
begin
  select * into s from public.submissions where id = p_submission_id for update;
  if not found then raise exception 'submission_not_found'; end if;
  if s.status <> 'tracking' then raise exception 'submission_not_tracking:%', s.status; end if;
  select * into mt from public.content_metrics where id = p_metric_id and submission_id = s.id;
  if not found then raise exception 'metric_not_found'; end if;
  if p_qualified_views < 0 or p_qualified_views > mt.views then raise exception 'qualified_exceeds_raw'; end if;
  if p_qualified_views < s.qualified_views and not p_allow_decrease then raise exception 'decrease_requires_flag'; end if;
  if p_qualified_views < s.qualified_views and nullif(btrim(p_note), '') is null then raise exception 'reason_required'; end if;

  select * into c from public.campaigns where id = s.campaign_id for update;   -- serialises budget allocation

  v_payable_views := case when p_qualified_views >= c.min_views_to_qualify then p_qualified_views else 0 end;
  v_target := (v_payable_views * c.cpm) / 1000;                                 -- integer floor
  if c.max_earning_per_submission is not null then v_target := least(v_target, c.max_earning_per_submission); end if;
  v_delta := v_target - s.earned;
  if v_delta > 0 and not c.budget_override and v_delta > c.budget - c.earned then
    v_delta := greatest(c.budget - c.earned, 0);
    v_capped := true;
  end if;

  insert into public.performance_snapshots
    (submission_id, metric_id, raw_views, qualified_views, previous_qualified_views, budget_capped, note, computed_by)
  values (s.id, mt.id, mt.views, p_qualified_views, s.qualified_views, v_capped, p_note, v_admin)
  returning * into snap;

  if v_delta <> 0 then
    insert into public.earnings (creator_id, campaign_id, submission_id, snapshot_id, qualified_views_delta, cpm, amount, status, available_at)
    values (s.creator_id, c.id, s.id, snap.id, p_qualified_views - s.qualified_views, c.cpm, v_delta,
            case when v_delta > 0 then 'pending'::public.earning_status else 'available' end,
            case when v_delta > 0 then now() + make_interval(days => public.setting_int('earnings_hold_days')::int) else now() end);
    update public.campaigns set earned = earned + v_delta,
      status = case when not budget_override and earned + v_delta >= budget and status = 'active' then 'ending' else status end,
      status_reason = case when not budget_override and earned + v_delta >= budget and status = 'active' then 'budget_exhausted' else status_reason end
    where id = c.id;
  end if;

  update public.submissions set qualified_views = p_qualified_views, earned = earned + v_delta where id = s.id;

  if v_delta > 0 then
    perform public.notify(s.creator_id, 'earnings_update', 'Penghasilan bertambah',
      format('%s telah ditambahkan ke penghasilanmu.', public.format_idr(v_delta)),
      jsonb_build_object('submission_id', s.id, 'amount', v_delta));
  end if;
  select max(x) into v_milestone
  from jsonb_array_elements_text((select value from public.app_settings where key = 'view_milestones')) t(v), lateral (select v::bigint x) y
  where x > s.qualified_views and x <= p_qualified_views;
  if v_milestone is not null then
    perform public.notify(s.creator_id, 'performance_milestone', 'Milestone tercapai',
      format('Klip kamu mencapai %s qualified views.', case when v_milestone >= 1000000 then (v_milestone/1000000)::text || 'M'
                                                       else (v_milestone/1000)::text || 'K' end),
      jsonb_build_object('submission_id', s.id, 'milestone', v_milestone));
  end if;

  perform public.write_audit('performance.qualify', 'submission', s.id,
    jsonb_build_object('qualified_views', s.qualified_views, 'earned', s.earned),
    jsonb_build_object('qualified_views', p_qualified_views, 'earned', s.earned + v_delta),
    jsonb_build_object('snapshot_id', snap.id, 'budget_capped', v_capped, 'note', p_note));
  return snap;
end $$;

create or replace function public.release_matured_earnings(p_creator uuid default null) returns integer
language plpgsql security definer set search_path = public, extensions as $$
declare n integer;
begin
  update public.earnings set status = 'available'
  where status = 'pending' and available_at <= now() and (p_creator is null or creator_id = p_creator);
  get diagnostics n = row_count;
  return n;
end $$;

-- ─────────────────────────────── Payouts ─────────────────────────────
create or replace function public.request_payout(p_idempotency_key uuid) returns public.payout_requests
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_uid uuid := auth.uid(); v_status public.creator_status; r public.payout_requests;
  v_ids uuid[]; v_amount bigint; pm public.creator_payout_methods;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if p_idempotency_key is null then raise exception 'idempotency_key_required'; end if;
  perform pg_advisory_xact_lock(hashtextextended('payout:' || v_uid::text, 0));

  select * into r from public.payout_requests where creator_id = v_uid and idempotency_key = p_idempotency_key;
  if found then return r; end if;                                   -- retried request

  select status into v_status from public.creator_profiles where user_id = v_uid;
  if v_status is distinct from 'active' then raise exception 'creator_not_eligible:%', v_status; end if;
  if exists (select 1 from public.payout_requests where creator_id = v_uid
             and status in ('requested','reviewing','approved','processing')) then
    raise exception 'payout_already_open';
  end if;
  select * into pm from public.creator_payout_methods where creator_id = v_uid and is_default;
  if not found then raise exception 'payout_method_missing'; end if;

  perform public.release_matured_earnings(v_uid);
  select array_agg(id), coalesce(sum(amount), 0) into v_ids, v_amount
  from (select id, amount from public.earnings
        where creator_id = v_uid and status = 'available' and payout_request_id is null for update) e;
  if v_amount < public.setting_int('min_payout_idr') then raise exception 'payout_below_minimum'; end if;

  insert into public.payout_requests (creator_id, amount, idempotency_key, payout_method)
  values (v_uid, v_amount, p_idempotency_key, jsonb_build_object(
    'kind', pm.kind, 'provider', pm.provider, 'account_name', pm.account_name, 'account_number', pm.account_number))
  returning * into r;
  update public.earnings set payout_request_id = r.id where id = any(v_ids);

  perform public.write_audit('payout.request', 'payout_request', r.id, null, jsonb_build_object('amount', v_amount));
  return r;
end $$;

create or replace function public.admin_update_payout(
  p_payout_id uuid, p_status public.payout_status, p_reason text default null, p_reference text default null
) returns public.payout_requests
language plpgsql security definer set search_path = public, extensions as $$
declare v_admin uuid := public.assert_admin(); p public.payout_requests; r public.payout_requests;
begin
  select * into p from public.payout_requests where id = p_payout_id for update;
  if not found then raise exception 'payout_not_found'; end if;
  if not (
       (p.status = 'requested'  and p_status in ('reviewing','rejected'))
    or (p.status = 'reviewing'  and p_status in ('approved','rejected'))
    or (p.status = 'approved'   and p_status in ('processing','rejected'))
    or (p.status = 'processing' and p_status in ('paid','rejected'))
  ) then raise exception 'invalid_transition:%->%', p.status, p_status; end if;
  if p_status = 'rejected' and nullif(btrim(p_reason), '') is null then raise exception 'reason_required'; end if;
  if p_status = 'paid' and nullif(btrim(p_reference), '') is null then raise exception 'reference_required'; end if;

  update public.payout_requests set
    status = p_status, reviewed_by = v_admin, reviewed_at = now(),
    review_reason = coalesce(nullif(btrim(p_reason), ''), review_reason),
    processed_reference = coalesce(nullif(btrim(p_reference), ''), processed_reference),
    paid_at = case when p_status = 'paid' then now() else paid_at end
  where id = p.id returning * into r;

  if p_status = 'paid' then
    update public.earnings set status = 'paid' where payout_request_id = p.id;
    update public.campaigns c set paid = c.paid + x.total
    from (select campaign_id, sum(amount) total from public.earnings where payout_request_id = p.id group by campaign_id) x
    where c.id = x.campaign_id;
    perform public.notify(p.creator_id, 'payout_update', 'Pencairan terkirim',
      format('%s telah dikirim ke akun %s kamu.', public.format_idr(p.amount), p.payout_method->>'provider'),
      jsonb_build_object('payout_id', p.id));
  elsif p_status = 'rejected' then
    update public.earnings set payout_request_id = null where payout_request_id = p.id;   -- funds return to available
    perform public.notify(p.creator_id, 'payout_update', 'Pencairan ditolak',
      format('Ditolak: %s. Saldo kamu tersedia kembali.', btrim(p_reason)), jsonb_build_object('payout_id', p.id));
  elsif p_status = 'approved' then
    perform public.notify(p.creator_id, 'payout_update', 'Pencairan disetujui',
      format('Pencairan %s disetujui dan akan segera dikirim.', public.format_idr(p.amount)), jsonb_build_object('payout_id', p.id));
  end if;

  perform public.write_audit('payout.' || p_status, 'payout_request', p.id,
    jsonb_build_object('status', p.status), jsonb_build_object('status', p_status, 'reason', p_reason, 'reference', p_reference));
  return r;
end $$;

-- ─────────────────────────────── Admin: creators & campaigns ─────────
create or replace function public.admin_set_creator_status(
  p_user_id uuid, p_status public.creator_status, p_reason text default null
) returns public.creator_profiles
language plpgsql security definer set search_path = public, extensions as $$
declare v_admin uuid := public.assert_admin(); cp public.creator_profiles; r public.creator_profiles;
begin
  select * into cp from public.creator_profiles where user_id = p_user_id for update;
  if not found then raise exception 'creator_not_found'; end if;
  if not (
       (cp.status = 'verified'  and p_status in ('active','suspended','banned'))
    or (cp.status = 'pending'   and p_status in ('suspended','banned'))
    or (cp.status = 'active'    and p_status in ('suspended','banned'))
    or (cp.status = 'suspended' and p_status in ('active','banned'))
  ) then raise exception 'invalid_transition:%->%', cp.status, p_status; end if;
  if p_status in ('suspended','banned') and nullif(btrim(p_reason), '') is null then raise exception 'reason_required'; end if;
  if p_status = 'active' and cp.onboarding_completed_at is null then raise exception 'onboarding_incomplete'; end if;

  update public.creator_profiles set status = p_status, status_reason = p_reason, status_changed_at = now()
  where user_id = cp.user_id returning * into r;

  perform public.notify(cp.user_id, 'account_status',
    case p_status when 'active' then 'Akunmu disetujui' when 'suspended' then 'Akun ditangguhkan' else 'Akun ditutup' end,
    case p_status when 'active' then 'Akun kreatormu sudah aktif. Sekarang kamu bisa bergabung ke campaign.'
                  else format('Alasan: %s', p_reason) end, '{}');
  perform public.write_audit('creator.status', 'creator', cp.user_id,
    jsonb_build_object('status', cp.status), jsonb_build_object('status', p_status, 'reason', p_reason));
  return r;
end $$;

create or replace function public.submit_campaign_for_approval(p_campaign_id uuid) returns public.campaigns
language plpgsql security definer set search_path = public, extensions as $$
declare c public.campaigns; r public.campaigns;
begin
  select * into c from public.campaigns where id = p_campaign_id for update;
  if not found then raise exception 'campaign_not_found'; end if;
  if not (public.is_brand_member(c.brand_id) or public.is_admin()) then raise exception 'forbidden'; end if;
  if c.status <> 'draft' then raise exception 'invalid_transition:%->pending_approval', c.status; end if;
  if not exists (select 1 from public.campaign_platforms where campaign_id = c.id) then raise exception 'platform_required'; end if;
  update public.campaigns set status = 'pending_approval', status_reason = null where id = c.id returning * into r;
  perform public.write_audit('campaign.submit', 'campaign', c.id, jsonb_build_object('status', c.status), jsonb_build_object('status', r.status));
  return r;
end $$;

create or replace function public.admin_set_campaign_status(
  p_campaign_id uuid, p_status public.campaign_status, p_reason text default null
) returns public.campaigns
language plpgsql security definer set search_path = public, extensions as $$
declare v_admin uuid := public.assert_admin(); c public.campaigns; r public.campaigns; v_member record;
begin
  select * into c from public.campaigns where id = p_campaign_id for update;
  if not found then raise exception 'campaign_not_found'; end if;
  if not (
       (c.status = 'pending_approval' and p_status in ('active','draft'))
    or (c.status = 'active'    and p_status in ('paused','ending','completed','cancelled'))
    or (c.status = 'paused'    and p_status in ('active','ending','completed','cancelled'))
    or (c.status = 'ending'    and p_status in ('active','completed'))
    or (c.status in ('completed','cancelled') and p_status = 'archived')
  ) then raise exception 'invalid_transition:%->%', c.status, p_status; end if;
  if p_status in ('draft','paused','cancelled') and nullif(btrim(p_reason), '') is null then raise exception 'reason_required'; end if;
  if p_status = 'active' then
    if not exists (select 1 from public.campaign_platforms where campaign_id = c.id) then raise exception 'platform_required'; end if;
    if not c.budget_override and c.earned >= c.budget then raise exception 'campaign_budget_exhausted'; end if;
    if c.ends_at is not null and c.ends_at < now() then raise exception 'campaign_expired'; end if;
  end if;

  update public.campaigns set status = p_status, status_reason = p_reason,
    approved_by = case when c.status = 'pending_approval' and p_status = 'active' then v_admin else approved_by end,
    approved_at = case when c.status = 'pending_approval' and p_status = 'active' then now() else approved_at end
  where id = c.id returning * into r;

  if p_status in ('paused','cancelled') then
    for v_member in select creator_id from public.campaign_creators where campaign_id = c.id and status = 'joined' loop
      perform public.notify(v_member.creator_id, 'campaign_update',
        case p_status when 'paused' then 'Campaign dijeda' else 'Campaign dibatalkan' end,
        format('%s %s. Penghasilan dari klip yang sudah disubmit tetap aman.', c.title, case p_status when 'paused' then 'dijeda' else 'dibatalkan' end), jsonb_build_object('campaign_id', c.id));
    end loop;
  end if;
  perform public.write_audit('campaign.status', 'campaign', c.id,
    jsonb_build_object('status', c.status), jsonb_build_object('status', p_status, 'reason', p_reason));
  return r;
end $$;

create or replace function public.admin_adjust_campaign_budget(
  p_campaign_id uuid, p_budget bigint, p_override boolean, p_reason text
) returns public.campaigns
language plpgsql security definer set search_path = public, extensions as $$
declare v_admin uuid := public.assert_admin(); c public.campaigns; r public.campaigns;
begin
  if nullif(btrim(p_reason), '') is null then raise exception 'reason_required'; end if;
  select * into c from public.campaigns where id = p_campaign_id for update;
  if not found then raise exception 'campaign_not_found'; end if;
  if p_budget < c.earned and not p_override then raise exception 'budget_below_earned'; end if;
  update public.campaigns set budget = p_budget, budget_override = p_override where id = c.id returning * into r;
  perform public.write_audit('campaign.budget', 'campaign', c.id,
    jsonb_build_object('budget', c.budget, 'override', c.budget_override),
    jsonb_build_object('budget', p_budget, 'override', p_override), jsonb_build_object('reason', p_reason));
  return r;
end $$;

-- ─────────────────────────────── Read models ─────────────────────────
create or replace view public.my_earnings_summary with (security_invoker = true) as
select creator_id,
  coalesce(sum(amount) filter (where status = 'pending' and available_at > now()), 0)::bigint              as pending,
  coalesce(sum(amount) filter (where (status = 'available' or (status = 'pending' and available_at <= now()))
                                 and payout_request_id is null), 0)::bigint                                as available,
  coalesce(sum(amount) filter (where status = 'available' and payout_request_id is not null), 0)::bigint   as in_payout,
  coalesce(sum(amount) filter (where status = 'paid'), 0)::bigint                                          as paid
from public.earnings group by creator_id;

create or replace view public.campaign_funnel with (security_invoker = true) as
select c.id as campaign_id, c.brand_id, c.title, c.status, c.budget, c.earned, c.paid,
  (c.budget - c.earned)                                                                          as remaining,
  (select count(*) from public.campaign_creators m where m.campaign_id = c.id)                   as joined,
  (select count(distinct s.creator_id) from public.submissions s where s.campaign_id = c.id)     as creators_submitted,
  (select count(*) from public.submissions s where s.campaign_id = c.id)                         as submissions,
  (select count(*) from public.submissions s where s.campaign_id = c.id
     and s.status in ('approved','tracking','completed'))                                        as approved,
  (select coalesce(sum(s.qualified_views), 0) from public.submissions s where s.campaign_id = c.id) as qualified_views,
  case when (select sum(s.qualified_views) from public.submissions s where s.campaign_id = c.id) > 0
       then round(c.earned::numeric / (select sum(s.qualified_views) from public.submissions s where s.campaign_id = c.id), 4)
  end                                                                                            as effective_cpv
from public.campaigns c;
