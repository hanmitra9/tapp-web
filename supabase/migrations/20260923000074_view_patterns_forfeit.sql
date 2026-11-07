-- TAPP · 0074 · View-pattern checks and forfeiting a cheating clip.
--   1. The automatic filter (0030/0072) also holds a clip for the admin when its views history looks bought:
--        • likes above like_max_ratio (35%) of views, or many likes with almost no comments
--        • views fell more than 10% below their peak (the platform removing fake views)
--        • a late surge: a clip 3+ days old suddenly gains 1.5× its views within a day
--        • a night surge: a big jump that happened between 00:00 and 06:00 WIB
--      A held clip earns nothing until an admin qualifies it (unchanged).
--   2. admin_forfeit_submission: "Hanguskan" a clip — only that clip. Its unpaid earnings are reversed, anything
--      already withdrawn is taken back from the next withdrawal, its views and earnings drop to 0, the budget goes
--      back to the campaign, and the creator is told why. The creator account stays active.

set search_path = public, extensions;

update public.app_settings
set value = jsonb_build_object('like_max_ratio', 0.35, 'late_surge_days', 3, 'late_surge_ratio', 1.5,
                               'night_surge_min', 5000, 'peak_drop', 0.9) || value,
    updated_at = now()
where key = 'auto_qualify';

-- ─────────────────────────────── 1. pattern checks ───────────────────────────────
create or replace function private.view_pattern_flags(s public.submissions, m public.content_metrics) returns text[]
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  cfg jsonb := coalesce((select value from public.app_settings where key = 'auto_qualify'), '{}'::jsonb);
  prev public.content_metrics; v_first timestamptz; v_peak bigint; v_hours numeric; v_gain bigint; v_mid timestamptz;
  out text[] := '{}';
begin
  if m.views >= 2000 and m.likes::numeric / m.views > coalesce((cfg->>'like_max_ratio')::numeric, 0.35) then
    out := array_append(out, format('likes tidak wajar (%s%% dari views)', round(m.likes::numeric * 100 / m.views)));
  end if;
  if m.likes >= 500 and m.comments::numeric / m.likes < 0.002 then
    out := array_append(out, 'banyak likes tapi hampir tanpa komentar');
  end if;

  select min(captured_at), max(views) into v_first, v_peak from public.content_metrics where submission_id = s.id and captured_at <= m.captured_at;
  if v_peak >= 1000 and m.views < v_peak * coalesce((cfg->>'peak_drop')::numeric, 0.9) then
    out := array_append(out, format('views turun dari puncak %s ke %s', to_char(v_peak, 'FM999G999G999G999'), to_char(m.views, 'FM999G999G999G999')));
  end if;

  select * into prev from public.content_metrics where submission_id = s.id and captured_at < m.captured_at order by captured_at desc limit 1;
  if prev.id is not null then
    v_hours := extract(epoch from (m.captured_at - prev.captured_at)) / 3600;
    v_gain := m.views - prev.views;
    if prev.views >= 1000 and v_hours <= 24 and v_gain >= prev.views * coalesce((cfg->>'late_surge_ratio')::numeric, 1.5)
       and prev.captured_at - v_first >= make_interval(days => coalesce((cfg->>'late_surge_days')::int, 3)) then
      out := array_append(out, format('lonjakan setelah sepi (+%s dalam %s jam, klip umur %s hari)',
        to_char(v_gain, 'FM999G999G999G999'), greatest(1, round(v_hours)), floor(extract(epoch from (prev.captured_at - v_first)) / 86400)));
    end if;
    v_mid := prev.captured_at + (m.captured_at - prev.captured_at) / 2;
    if v_hours <= 8 and extract(hour from (v_mid at time zone 'Asia/Jakarta')) < 6
       and v_gain >= coalesce((cfg->>'night_surge_min')::bigint, 5000) and v_gain >= prev.views * 2 then
      out := array_append(out, format('lonjakan dini hari (+%s antara jam 00–06 WIB)', to_char(v_gain, 'FM999G999G999G999')));
    end if;
  end if;
  return out;
end $$;
revoke execute on function private.view_pattern_flags(public.submissions, public.content_metrics) from public, anon, authenticated;

-- 0072's filter + the pattern checks.
create or replace function private.auto_qualify_hold(s public.submissions, m public.content_metrics) returns text
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  cfg jsonb := coalesce((select value from public.app_settings where key = 'auto_qualify'), '{}'::jsonb);
  prev public.content_metrics; v_followers bigint; v_verified timestamptz; v_status public.creator_status;
  v_eng numeric; v_hours numeric; out text[] := '{}';
begin
  select status into v_status from public.creator_profiles where user_id = s.creator_id;
  if v_status is distinct from 'active' then out := array_append(out, 'akun creator tidak aktif'); end if;
  if s.content_state <> 'live' then out := array_append(out, 'postingan tidak tayang'); end if;
  select x.followers, x.verified_at into v_followers, v_verified from public.creator_platforms x
   where x.creator_id = s.creator_id and x.platform = s.platform order by x.verified_at desc nulls last, x.created_at limit 1;
  if coalesce((cfg->>'require_verified_account')::boolean, true) and v_verified is null then out := array_append(out, 'akun sosial belum diverifikasi'); end if;
  if m.views < s.qualified_views then out := array_append(out, 'views lebih kecil dari qualified sebelumnya'); end if;

  select * into prev from public.content_metrics where submission_id = s.id and captured_at < m.captured_at order by captured_at desc limit 1;
  if prev.id is not null then
    if m.views < prev.views then out := array_append(out, 'views turun dibanding data sebelumnya'); end if;
    v_hours := extract(epoch from (m.captured_at - prev.captured_at)) / 3600;
    if prev.views > 0 and m.views::numeric / prev.views >= coalesce((cfg->>'max_jump')::numeric, 10)
       and v_hours <= coalesce((cfg->>'jump_hours')::numeric, 24) then
      out := array_append(out, format('views naik %s× dalam %s jam', round(m.views::numeric / prev.views), greatest(1, round(v_hours))));
    end if;
  end if;
  if m.views >= coalesce((cfg->>'engagement_min_views')::bigint, 5000) then
    v_eng := (m.likes + m.comments + m.shares)::numeric / nullif(m.views, 0);
    if v_eng < coalesce((cfg->>'min_engagement')::numeric, 0.005) then out := array_append(out, format('engagement rendah (%s%%)', round(v_eng * 100, 2))); end if;
  end if;
  if v_followers > 0 and m.views::numeric / v_followers > coalesce((cfg->>'max_views_per_follower')::numeric, 50) then
    out := array_append(out, format('views %s× jumlah followers', round(m.views::numeric / v_followers)));
  end if;
  if exists (select 1 from public.submission_checks k where k.submission_id = s.id and k.posted_before_join) then
    out := array_append(out, 'diposting sebelum bergabung ke campaign');
  end if;
  out := out || private.view_pattern_flags(s, m);
  return nullif(array_to_string(out, '; '), '');
end $$;
revoke execute on function private.auto_qualify_hold(public.submissions, public.content_metrics) from public, anon, authenticated;

-- ─────────────────────────────── 2. forfeit one clip ───────────────────────────────
create or replace function public.admin_forfeit_submission(p_submission_id uuid, p_reason text) returns public.submissions
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_admin uuid := public.assert_admin(); s public.submissions; r public.submissions; v_title text;
  v_unpaid bigint; v_taken bigint; v_metric uuid; v_snap uuid; v_cpm bigint;
begin
  if nullif(btrim(p_reason), '') is null then raise exception 'reason_required'; end if;
  select * into s from public.submissions where id = p_submission_id for update;
  if not found then raise exception 'submission_not_found'; end if;
  if s.status = 'rejected' then raise exception 'invalid_transition:rejected->rejected'; end if;
  perform 1 from public.campaigns where id = s.campaign_id for update;

  -- Earnings not yet in a withdrawal are cancelled outright.
  with x as (
    update public.earnings set status = 'reversed'
    where submission_id = s.id and status in ('pending', 'available') and payout_request_id is null
    returning amount)
  select coalesce(sum(amount), 0) into v_unpaid from x;
  -- What was already withdrawn (or is in a withdrawal) is taken back from the next one.
  v_taken := greatest(s.earned - v_unpaid, 0);
  if v_taken > 0 then
    select id into v_metric from public.content_metrics where submission_id = s.id order by captured_at desc, created_at desc limit 1;
    select cpm into v_cpm from public.campaigns where id = s.campaign_id;
    insert into public.performance_snapshots (submission_id, metric_id, raw_views, qualified_views, previous_qualified_views, note, computed_by)
    select s.id, m.id, m.views, 0, s.qualified_views, 'Dihanguskan: ' || btrim(p_reason), v_admin from public.content_metrics m where m.id = v_metric
    returning id into v_snap;
    insert into public.earnings (creator_id, campaign_id, submission_id, snapshot_id, qualified_views_delta, cpm, amount, status, available_at)
    values (s.creator_id, s.campaign_id, s.id, v_snap, -s.qualified_views, v_cpm, -v_taken, 'available', now());
  end if;
  update public.campaigns set earned = greatest(earned - s.earned, 0) where id = s.campaign_id;

  update public.submissions set status = 'rejected', qualified_views = 0, earned = 0, review_reason = 'Dihanguskan: ' || btrim(p_reason),
    reviewed_by = v_admin, reviewed_at = now(), auto_hold_reason = null, auto_hold_metric_id = null
  where id = s.id returning * into r;
  perform public.recompute_tier(s.creator_id);

  select title into v_title from public.campaigns where id = s.campaign_id;
  perform public.notify(s.creator_id, 'submission_rejected', 'Klip dihanguskan',
    format('Klip kamu untuk %s dihanguskan: %s. Penghasilan dari klip ini dibatalkan%s.', v_title, btrim(p_reason),
      case when v_taken > 0 then format(' (%s dipotong dari pencairan berikutnya)', public.format_idr(v_taken)) else '' end),
    jsonb_build_object('submission_id', s.id, 'reversed', v_unpaid, 'taken_back', v_taken));
  perform public.write_audit('submission.forfeit', 'submission', s.id,
    jsonb_build_object('status', s.status, 'qualified_views', s.qualified_views, 'earned', s.earned),
    jsonb_build_object('status', 'rejected', 'reason', btrim(p_reason), 'reversed', v_unpaid, 'taken_back', v_taken));
  return r;
end $$;
revoke execute on function public.admin_forfeit_submission(uuid, text) from public, anon;
grant execute on function public.admin_forfeit_submission(uuid, text) to authenticated;
