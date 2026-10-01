-- TAPP · 0022 · Five-tier creator system (New → Rising → Verified → Proven → Elite), automatic by
-- lifetime qualified views. Recomputed every time a submission's qualified_views changes (the one place
-- that happens: admin_qualify_views), so no separate job is needed.

set search_path = public, extensions;

-- Old 3-value enum → 5 values. Postgres enums can't reorder/rename safely under concurrent use, so rebuild:
-- new type, swap the column, drop the old type. Existing 'rising' stays 'rising'; 'proven' stays 'proven'
-- (now a mid tier, not the top); nothing currently in creator_profiles is 'new'-only data loss risk since
-- this just relabels, it doesn't change who qualifies — recompute right after runs everyone to their real tier.
create type public.creator_tier_v2 as enum ('new', 'rising', 'verified', 'proven', 'elite');

alter table public.creator_profiles add column tier_v2 public.creator_tier_v2;
update public.creator_profiles set tier_v2 = tier::text::public.creator_tier_v2;   -- 'new'/'rising'/'proven' map 1:1 by name
alter table public.creator_profiles alter column tier_v2 set not null;
alter table public.creator_profiles alter column tier_v2 set default 'new';

-- admin_submissions selects this column (cp.tier), so it must be dropped and recreated around the swap.
drop view public.admin_submissions;
alter table public.creator_profiles drop column tier;
alter table public.creator_profiles rename column tier_v2 to tier;
drop type public.creator_tier;
alter type public.creator_tier_v2 rename to creator_tier;

create or replace view public.admin_submissions with (security_invoker = true) as
select s.id, s.campaign_id, s.creator_id, s.platform, s.post_url, s.normalized_url, s.published_at, s.caption, s.screenshot_path,
  s.status, s.review_reason, s.reviewed_at, s.content_state, s.qualified_views, s.earned, s.last_metrics_at, s.created_at,
  c.title as campaign_title, c.status as campaign_status, c.cpm, c.min_views_to_qualify, c.max_earning_per_submission,
  c.budget, c.earned as campaign_earned, c.budget_override, c.submission_deadline,
  b.name as brand_name,
  p.full_name as creator_name, p.username as creator_username, p.avatar_url as creator_avatar,
  cp.status as creator_status, cp.tier as creator_tier,
  (select x.handle from public.creator_platforms x where x.creator_id = s.creator_id and x.platform = s.platform order by x.created_at limit 1) as account_handle,
  (select x.followers from public.creator_platforms x where x.creator_id = s.creator_id and x.platform = s.platform order by x.created_at limit 1) as account_followers,
  (select count(*) from public.submissions h where h.creator_id = s.creator_id and h.status in ('approved','tracking','completed')) as creator_approved,
  (select count(*) from public.submissions h where h.creator_id = s.creator_id and h.status = 'rejected') as creator_rejected,
  lm.id as latest_metric_id, lm.views, lm.likes, lm.comments, lm.shares, lm.saves, lm.captured_at as metrics_captured_at,
  (select count(*) from public.content_metrics m where m.submission_id = s.id) as metric_count
from public.submissions s
join public.campaigns c on c.id = s.campaign_id
left join public.brands b on b.id = c.brand_id
left join public.profiles p on p.id = s.creator_id
left join public.creator_profiles cp on cp.user_id = s.creator_id
left join lateral (
  select id, views, likes, comments, shares, saves, captured_at from public.content_metrics
  where submission_id = s.id order by captured_at desc, created_at desc limit 1
) lm on true;

-- DROP VIEW wipes grants (unlike CREATE OR REPLACE VIEW, which can't be used here since the column type
-- changed) and RLS is enforced by the underlying tables' own policies (security_invoker), so this grant
-- is what gates read access to the view itself; restore it exactly as migration 007 set it.
grant select on public.admin_submissions to authenticated;

comment on column public.creator_profiles.tier is
  'Automatic from lifetime qualified views (see tier_thresholds in app_settings and public.tier_for_views()). Never written directly by creators or admins.';

-- Thresholds live in app_settings so they can be tuned without a migration. Cumulative qualified views, IDR-free.
insert into public.app_settings (key, value) values (
  'tier_thresholds',
  '{"new": 0, "rising": 50000, "verified": 250000, "proven": 1000000, "elite": 5000000}'::jsonb
) on conflict (key) do update set value = excluded.value;

create or replace function public.tier_for_views(p_views bigint) returns public.creator_tier
language sql stable security definer set search_path = public, extensions as $$
  select coalesce(
    (select t.tier_key from public.app_settings s, jsonb_each_text(s.value) t(tier_key, min_views)
       where s.key = 'tier_thresholds' and p_views >= t.min_views::bigint
       order by t.min_views::bigint desc limit 1)::public.creator_tier,
    'new'
  )
$$;
revoke execute on function public.tier_for_views(bigint) from public, anon, authenticated;

-- Lifetime qualified views = sum across every submission the creator has ever had qualified, not just one
-- campaign. Reads qualified_views directly off submissions (kept in sync by admin_qualify_views), so this
-- is cheap and always current — no separate ledger to maintain.
create or replace function public.lifetime_qualified_views(p_creator uuid) returns bigint
language sql stable security definer set search_path = public, extensions as $$
  select coalesce(sum(qualified_views), 0)::bigint from public.submissions where creator_id = p_creator
$$;
revoke execute on function public.lifetime_qualified_views(uuid) from public, anon, authenticated;

-- Recomputes one creator's tier; notifies them on promotion. Called from admin_qualify_views (below) after
-- qualified_views changes, so a creator's tier is never stale by more than one qualification event.
create or replace function public.recompute_tier(p_creator uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare v_views bigint; v_new public.creator_tier; v_old public.creator_tier;
        v_label constant jsonb := '{"new":"New","rising":"Rising","verified":"Verified","proven":"Proven","elite":"Elite"}'::jsonb;
begin
  select tier into v_old from public.creator_profiles where user_id = p_creator for update;
  if not found then return; end if;
  v_views := public.lifetime_qualified_views(p_creator);
  v_new := public.tier_for_views(v_views);
  if v_new = v_old then return; end if;
  update public.creator_profiles set tier = v_new where user_id = p_creator;
  perform public.write_audit('creator.tier_change', 'creator_profile', p_creator,
    jsonb_build_object('tier', v_old), jsonb_build_object('tier', v_new, 'lifetime_qualified_views', v_views));
  -- enum comparison is by declaration order (new < rising < verified < proven < elite), so this compares rank directly
  if v_new > v_old then
    perform public.notify(p_creator, 'tier_change', 'Naik Tier: ' || (v_label->>v_new::text),
      format('Kerja bagusmu membuahkan hasil. Kamu sekarang tier %s.', v_label->>v_new::text),
      jsonb_build_object('tier', v_new, 'lifetime_qualified_views', v_views));
  end if;
end $$;
revoke execute on function public.recompute_tier(uuid) from public, anon, authenticated;

-- Hook into the one place qualified_views changes.
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
  perform public.recompute_tier(s.creator_id);   -- ← new: keep tier in sync with lifetime qualified views

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

-- Backfill: recompute every existing creator once, so tiers reflect reality immediately after this migration.
do $$
declare r record;
begin
  for r in select user_id from public.creator_profiles loop
    perform public.recompute_tier(r.user_id);
  end loop;
end $$;

-- Read model: progress to the next tier, for the creator's own profile screen.
create or replace function public.my_tier_progress() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare v_uid uuid := auth.uid(); v_views bigint; v_tier public.creator_tier; v_thresholds jsonb; v_order text[] := array['new','rising','verified','proven','elite'];
        v_idx int; v_next text; v_next_at bigint;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select tier into v_tier from public.creator_profiles where user_id = v_uid;
  if not found then raise exception 'creator_profile_not_found'; end if;
  v_views := public.lifetime_qualified_views(v_uid);
  select value into v_thresholds from public.app_settings where key = 'tier_thresholds';
  v_idx := array_position(v_order, v_tier::text);
  v_next := case when v_idx < 5 then v_order[v_idx + 1] end;
  v_next_at := case when v_next is not null then (v_thresholds->>v_next)::bigint end;
  return jsonb_build_object(
    'tier', v_tier, 'lifetime_qualified_views', v_views,
    'next_tier', v_next, 'views_to_next', case when v_next_at is not null then greatest(v_next_at - v_views, 0) end,
    'thresholds', v_thresholds
  );
end $$;
revoke execute on function public.my_tier_progress() from public, anon;
grant execute on function public.my_tier_progress() to authenticated;

-- Admin view picks up the richer tier set automatically (it selects cp.tier); no change needed there.
