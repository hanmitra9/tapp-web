-- TAPP · 0030 · Automatic view filtering ("penyaringan otomatis").
-- Every 30 minutes, tracking clips with newly recorded views are qualified automatically at their latest raw
-- views when nothing looks off. Anything suspicious is held for an admin with the reason, exactly the signals
-- Admin → Performa already shows:
--   • engagement < min_engagement (default 0.5%) once a clip has ≥ 5,000 views
--   • views jumped ≥ max_jump× (default 10×) within jump_hours (24h) of the previous snapshot
--   • views went down vs the previous snapshot, or the post isn't live
--   • views > max_views_per_follower× (default 50×) the account's followers
--   • the creator's account for that platform isn't verified, or the creator isn't active
-- The reward math is the same code admins use (private.qualify_views, shared with admin_qualify_views): minimum
-- views, per-clip cap and budget cap all apply. Auto decisions are snapshots with computed_by = null and an
-- audit entry marked auto. Switch off with app_settings.auto_qualify.enabled = false.

set search_path = public, extensions;

insert into public.app_settings (key, value) values ('auto_qualify',
  '{"enabled": true, "min_engagement": 0.005, "engagement_min_views": 5000, "max_jump": 10, "jump_hours": 24, "max_views_per_follower": 50, "require_verified_account": true}'::jsonb)
on conflict (key) do nothing;

alter table public.submissions add column if not exists auto_hold_reason text;
alter table public.submissions add column if not exists auto_hold_metric_id uuid references public.content_metrics(id);
alter table public.submissions add column if not exists auto_hold_at timestamptz;
create index if not exists submissions_auto_hold_metric_idx on public.submissions(auto_hold_metric_id);

-- Shared qualification core (moved out of admin_qualify_views unchanged, plus: actor may be null = automatic,
-- and a successful qualification clears any auto-hold).
create or replace function private.qualify_views(
  p_submission_id uuid, p_metric_id uuid, p_qualified_views bigint,
  p_note text, p_allow_decrease boolean, p_actor uuid
) returns public.performance_snapshots
language plpgsql security definer set search_path = public, extensions as $$
declare
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
  values (s.id, mt.id, mt.views, p_qualified_views, s.qualified_views, v_capped, p_note, p_actor)
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

  update public.submissions set qualified_views = p_qualified_views, earned = earned + v_delta, auto_hold_reason = null, auto_hold_metric_id = null where id = s.id;
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
    jsonb_build_object('snapshot_id', snap.id, 'budget_capped', v_capped, 'note', p_note, 'auto', p_actor is null));
  return snap;
end $$;
revoke execute on function private.qualify_views(uuid, uuid, bigint, text, boolean, uuid) from public, anon, authenticated;

create or replace function public.admin_qualify_views(
  p_submission_id uuid, p_metric_id uuid, p_qualified_views bigint,
  p_note text default null, p_allow_decrease boolean default false
) returns public.performance_snapshots
language plpgsql security definer set search_path = public, extensions as $$
begin
  return private.qualify_views(p_submission_id, p_metric_id, p_qualified_views, p_note, p_allow_decrease, public.assert_admin());
end $$;

-- Why a clip can't be auto-qualified right now (null = clean). Same thresholds as admin/src/lib/engine.ts.
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
  return nullif(array_to_string(out, '; '), '');
end $$;
revoke execute on function private.auto_qualify_hold(public.submissions, public.content_metrics) from public, anon, authenticated;

-- One pass over clips whose latest metric hasn't been decided yet. Returns (qualified, held).
create or replace function public.auto_qualify_sweep(p_limit integer default 500, out qualified integer, out held integer)
language plpgsql security definer set search_path = public, extensions as $$
declare r record; v_reason text;
begin
  qualified := 0; held := 0;
  if not coalesce((select (value->>'enabled')::boolean from public.app_settings where key = 'auto_qualify'), false) then return; end if;
  for r in
    select s.id as sid, m.id as mid
    from public.submissions s
    cross join lateral (select * from public.content_metrics x where x.submission_id = s.id order by x.captured_at desc, x.created_at desc limit 1) m
    where s.status = 'tracking'
      and not exists (select 1 from public.performance_snapshots p where p.submission_id = s.id and p.metric_id = m.id)
      and s.auto_hold_metric_id is distinct from m.id
    order by m.captured_at
    limit p_limit
  loop
    declare s public.submissions; m public.content_metrics;
    begin
      select * into s from public.submissions where id = r.sid;
      select * into m from public.content_metrics where id = r.mid;
      v_reason := private.auto_qualify_hold(s, m);
      if v_reason is null then
        perform private.qualify_views(s.id, m.id, m.views, 'Otomatis: lolos semua pengecekan', false, null);
        qualified := qualified + 1;
      else
        update public.submissions set auto_hold_reason = v_reason, auto_hold_metric_id = m.id, auto_hold_at = now() where id = s.id;
        held := held + 1;
      end if;
    exception when others then
      update public.submissions set auto_hold_reason = 'gagal diproses otomatis: ' || sqlerrm, auto_hold_metric_id = r.mid, auto_hold_at = now() where id = r.sid;
      held := held + 1;
    end;
  end loop;
end $$;
revoke execute on function public.auto_qualify_sweep(integer) from public, anon, authenticated;

-- Admin views gain the hold reason / count (columns appended; CREATE OR REPLACE keeps grants).
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
  (select count(*) from public.content_metrics m where m.submission_id = s.id) as metric_count,
  s.auto_hold_reason, s.auto_hold_at
from public.submissions s
join public.campaigns c on c.id = s.campaign_id
left join public.brands b on b.id = c.brand_id
left join public.profiles p on p.id = s.creator_id
left join public.creator_profiles cp on cp.user_id = s.creator_id
left join lateral (
  select id, views, likes, comments, shares, saves, captured_at from public.content_metrics
  where submission_id = s.id order by captured_at desc, created_at desc limit 1
) lm on true;

create or replace view public.admin_queue_counts with (security_invoker = true) as
select
  (select count(*) from public.submissions where status = 'pending_review')                                   as pending_review,
  (select count(*) from public.submissions where status = 'flagged')                                          as flagged,
  (select count(*) from public.submissions where status = 'approved')                                         as awaiting_first_metrics,
  (select count(*) from public.submissions where status = 'tracking'
     and (last_metrics_at is null or last_metrics_at < now() - interval '24 hours'))                          as stale_metrics,
  (select count(*) from public.creator_profiles where status = 'verified')                                    as creators_to_review,
  (select count(*) from public.payout_requests where status in ('requested','reviewing','approved','processing')) as payouts_open,
  (select count(*) from public.disputes where status in ('open','under_review'))                              as disputes_open,
  (select count(*) from public.support_tickets where status in ('open','pending'))                            as tickets_open,
  (select count(*) from public.campaigns where status = 'pending_approval')                                   as campaigns_pending,
  (select count(*) from public.submissions where status = 'tracking' and auto_hold_reason is not null) as auto_held;

do $$
begin
  if to_regclass('cron.job') is null then return; end if;
  execute $cmd$ select cron.unschedule(jobid) from cron.job where jobname = 'auto-qualify-sweep' $cmd$;
  execute $cmd$ select cron.schedule('auto-qualify-sweep', '*/30 * * * *', 'select public.auto_qualify_sweep()') $cmd$;
end $$;

-- Admin: status (on/off, held now, auto decisions in the last 24h) and the switch.
create or replace function public.admin_auto_qualify_status() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform public.assert_admin();
  return jsonb_build_object(
    'enabled', coalesce((select (value->>'enabled')::boolean from public.app_settings where key = 'auto_qualify'), false),
    'held', (select count(*) from public.submissions where status = 'tracking' and auto_hold_reason is not null),
    'auto_24h', (select count(*) from public.performance_snapshots where computed_by is null and created_at > now() - interval '24 hours'),
    'manual_24h', (select count(*) from public.performance_snapshots where computed_by is not null and created_at > now() - interval '24 hours'),
    'config', (select value from public.app_settings where key = 'auto_qualify'));
end $$;

create or replace function public.admin_set_auto_qualify(p_enabled boolean) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare v_old jsonb;
begin
  perform public.assert_admin();
  select value into v_old from public.app_settings where key = 'auto_qualify';
  update public.app_settings set value = jsonb_set(coalesce(value, '{}'::jsonb), '{enabled}', to_jsonb(coalesce(p_enabled, false))), updated_at = now()
  where key = 'auto_qualify';
  perform public.write_audit('settings.auto_qualify', 'app_setting', null, v_old, jsonb_build_object('enabled', p_enabled));
end $$;

revoke execute on function public.admin_auto_qualify_status(), public.admin_set_auto_qualify(boolean) from public, anon;
grant execute on function public.admin_auto_qualify_status(), public.admin_set_auto_qualify(boolean) to authenticated;
