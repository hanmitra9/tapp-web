-- TAPP · 0006 · Campaign workspace & submissions (Phase 4)

set search_path = public, extensions;

-- ─────────────────────────────── Shared validation ───────────────────
-- Every rule a creator-side submission must satisfy. Returns the canonical URL. Raises stable error codes.
create or replace function public.check_submission(
  p_campaign_id uuid, p_creator uuid, p_platform public.platform, p_post_url text,
  p_published_at timestamptz, p_screenshot_path text
) returns text
language plpgsql stable security definer set search_path = public, extensions as $$
declare c public.campaigns; m public.campaign_creators; v_norm text := public.normalize_post_url(p_post_url); v_detected public.platform;
begin
  select * into c from public.campaigns where id = p_campaign_id;
  if not found then raise exception 'campaign_not_found'; end if;
  select * into m from public.campaign_creators where campaign_id = c.id and creator_id = p_creator;
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
  if not exists (select 1 from public.creator_platforms where creator_id = p_creator and platform = p_platform) then
    raise exception 'platform_account_not_linked';
  end if;

  if p_published_at is null or p_published_at > now() + interval '5 minutes' then raise exception 'invalid_published_at'; end if;
  if p_published_at < m.joined_at - make_interval(mins => public.setting_int('publish_grace_minutes')::int)
     or (c.starts_at is not null and p_published_at < c.starts_at) then
    raise exception 'published_before_join';
  end if;
  if p_screenshot_path is not null and split_part(p_screenshot_path, '/', 1) <> p_creator::text then
    raise exception 'invalid_screenshot_path';
  end if;
  return v_norm;
end $$;

-- ─────────────────────────────── Submit (idempotent) ─────────────────
-- A retried request (e.g. the response was lost on a flaky connection) returns the existing pending row
-- instead of a duplicate error.
create or replace function public.submit_content(
  p_campaign_id uuid, p_platform public.platform, p_post_url text, p_published_at timestamptz,
  p_caption text default null, p_screenshot_path text default null
) returns public.submissions
language plpgsql security definer set search_path = public, extensions as $$
declare v_uid uuid := public.assert_active_creator(); v_norm text; r public.submissions; m public.campaign_creators;
begin
  v_norm := public.check_submission(p_campaign_id, v_uid, p_platform, p_post_url, p_published_at, p_screenshot_path);

  select * into r from public.submissions where normalized_url = v_norm for update;
  if found then
    if r.creator_id = v_uid and r.campaign_id = p_campaign_id and r.status = 'pending_review' then return r; end if;
    if r.creator_id = v_uid and r.campaign_id = p_campaign_id and r.status = 'needs_changes' then
      update public.submissions set platform = p_platform, post_url = btrim(p_post_url), published_at = p_published_at,
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

  select * into m from public.campaign_creators where campaign_id = p_campaign_id and creator_id = v_uid;
  begin
    insert into public.submissions (campaign_id, creator_id, membership_id, platform, post_url, normalized_url,
                                    published_at, caption, screenshot_path)
    values (p_campaign_id, v_uid, m.id, p_platform, btrim(p_post_url), v_norm, p_published_at,
            nullif(btrim(p_caption), ''), p_screenshot_path)
    returning * into r;
  exception when unique_violation then raise exception 'duplicate_submission';
  end;
  return r;
end $$;

-- ─────────────────────────────── Resubmit after "needs changes" ──────
-- The creator may fix the same post or replace it with a new one (new URL).
create or replace function public.resubmit_content(
  p_submission_id uuid, p_platform public.platform, p_post_url text, p_published_at timestamptz,
  p_caption text default null, p_screenshot_path text default null
) returns public.submissions
language plpgsql security definer set search_path = public, extensions as $$
declare v_uid uuid := public.assert_active_creator(); s public.submissions; r public.submissions; v_norm text;
begin
  select * into s from public.submissions where id = p_submission_id and creator_id = v_uid for update;
  if not found then raise exception 'submission_not_found'; end if;
  if s.status <> 'needs_changes' then raise exception 'submission_not_editable'; end if;
  v_norm := public.check_submission(s.campaign_id, v_uid, p_platform, p_post_url, p_published_at, p_screenshot_path);
  begin
    update public.submissions set platform = p_platform, post_url = btrim(p_post_url), normalized_url = v_norm,
      published_at = p_published_at, caption = nullif(btrim(p_caption), ''),
      screenshot_path = coalesce(p_screenshot_path, screenshot_path),
      status = 'pending_review', review_reason = null, reviewed_by = null, reviewed_at = null
    where id = s.id returning * into r;
  exception when unique_violation then raise exception 'duplicate_submission';
  end;
  perform public.write_audit('submission.resubmit', 'submission', s.id,
    jsonb_build_object('post_url', s.post_url, 'review_reason', s.review_reason), jsonb_build_object('post_url', r.post_url));
  return r;
end $$;

-- ─────────────────────────────── Withdraw ────────────────────────────
-- Only before review has produced anything; tracked submissions are never deleted.
create or replace function public.withdraw_submission(p_submission_id uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare v_uid uuid := auth.uid(); s public.submissions;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select * into s from public.submissions where id = p_submission_id and creator_id = v_uid for update;
  if not found then raise exception 'submission_not_found'; end if;
  if s.status not in ('pending_review','needs_changes') then raise exception 'submission_not_editable'; end if;
  if exists (select 1 from public.content_metrics where submission_id = s.id) then raise exception 'submission_not_editable'; end if;
  perform public.write_audit('submission.withdraw', 'submission', s.id, to_jsonb(s), null);
  delete from public.submissions where id = s.id;
end $$;

-- ─────────────────────────────── Read model ──────────────────────────
create or replace view public.my_submissions with (security_invoker = true) as
select s.id, s.campaign_id, c.title as campaign_title, b.name as brand_name, c.status as campaign_status,
  s.platform, s.post_url, s.published_at, s.caption, s.screenshot_path, s.status, s.review_reason, s.reviewed_at,
  s.content_state, s.qualified_views, s.earned, s.last_metrics_at, s.created_at, s.updated_at,
  lm.views as raw_views, lm.likes, lm.comments, lm.shares, lm.saves
from public.submissions s
join public.campaigns c on c.id = s.campaign_id
left join public.brands b on b.id = c.brand_id
left join lateral (
  select views, likes, comments, shares, saves from public.content_metrics
  where submission_id = s.id order by captured_at desc limit 1
) lm on true
where s.creator_id = auth.uid();
grant select on public.my_submissions to authenticated;


revoke execute on function public.check_submission(uuid, uuid, public.platform, text, timestamptz, text) from public, anon, authenticated;
revoke execute on function public.resubmit_content(uuid, public.platform, text, timestamptz, text, text),
  public.withdraw_submission(uuid) from public, anon;
grant execute on function public.resubmit_content(uuid, public.platform, text, timestamptz, text, text),
  public.withdraw_submission(uuid), public.submit_content(uuid, public.platform, text, timestamptz, text, text) to authenticated;
