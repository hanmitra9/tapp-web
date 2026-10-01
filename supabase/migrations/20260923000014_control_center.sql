-- TAPP · 0014 · Admin control center: campaigns, brands, disputes, support, audit (Phase 8)

set search_path = public, extensions;

-- ─────────────────────────────── Campaign authoring ──────────────────
-- Atomic create/update of a DRAFT campaign with its platforms and rules. Admin or brand member.
-- p: {brand_id, title, objective, description, category, content_type, cpm, budget, max_earning_per_submission,
--     min_views_to_qualify, starts_at, ends_at, submission_deadline, guidelines_do[], guidelines_dont[], terms,
--     platforms[], rules:[{kind, body}]}
create or replace function public.upsert_campaign_draft(p_id uuid, p jsonb) returns public.campaigns
language plpgsql security definer set search_path = public, extensions as $$
declare c public.campaigns; r public.campaigns; v_brand uuid := (p->>'brand_id')::uuid; v_plats public.platform[];
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if p_id is not null then
    select * into c from public.campaigns where id = p_id for update;
    if not found then raise exception 'campaign_not_found'; end if;
    if c.status <> 'draft' then raise exception 'terms_locked_after_draft'; end if;
    v_brand := c.brand_id;
  end if;
  if v_brand is null or not exists (select 1 from public.brands where id = v_brand) then raise exception 'brand_required'; end if;
  if not (public.is_admin() or public.is_brand_member(v_brand)) then raise exception 'forbidden'; end if;

  v_plats := coalesce(array(select jsonb_array_elements_text(p->'platforms'))::public.platform[], '{}');
  if coalesce(nullif(btrim(p->>'title'), ''), '') = '' then raise exception 'title_required'; end if;
  if coalesce((p->>'cpm')::bigint, 0) <= 0 then raise exception 'cpm_required'; end if;
  if coalesce((p->>'budget')::bigint, 0) <= 0 then raise exception 'budget_required'; end if;

  if p_id is null then
    insert into public.campaigns (brand_id, title, category, cpm, budget, created_by)
    values (v_brand, btrim(p->>'title'), coalesce(nullif(p->>'category', ''), 'other'), (p->>'cpm')::bigint, (p->>'budget')::bigint, auth.uid())
    returning * into c;
  end if;

  update public.campaigns set
    title = btrim(p->>'title'), objective = nullif(btrim(p->>'objective'), ''), description = nullif(btrim(p->>'description'), ''),
    category = coalesce(nullif(p->>'category', ''), category), content_type = coalesce(nullif(p->>'content_type', ''), content_type),
    cpm = (p->>'cpm')::bigint, budget = (p->>'budget')::bigint,
    max_earning_per_submission = nullif(p->>'max_earning_per_submission', '')::bigint,
    min_views_to_qualify = coalesce(nullif(p->>'min_views_to_qualify', '')::int, 0),
    starts_at = nullif(p->>'starts_at', '')::timestamptz, ends_at = nullif(p->>'ends_at', '')::timestamptz,
    submission_deadline = nullif(p->>'submission_deadline', '')::timestamptz,
    guidelines_do = coalesce(array(select btrim(x) from jsonb_array_elements_text(p->'guidelines_do') x where btrim(x) <> ''), '{}'),
    guidelines_dont = coalesce(array(select btrim(x) from jsonb_array_elements_text(p->'guidelines_dont') x where btrim(x) <> ''), '{}'),
    terms = nullif(btrim(p->>'terms'), '')
  where id = c.id returning * into r;

  delete from public.campaign_platforms where campaign_id = c.id;
  insert into public.campaign_platforms (campaign_id, platform) select c.id, x from unnest(v_plats) x on conflict do nothing;

  if p ? 'rules' then
    delete from public.campaign_rules where campaign_id = c.id;
    insert into public.campaign_rules (campaign_id, kind, body, sort)
    select c.id, e->>'kind', btrim(e->>'body'), ord::int from jsonb_array_elements(p->'rules') with ordinality t(e, ord)
    where btrim(coalesce(e->>'body', '')) <> '';
  end if;

  perform public.write_audit(case when p_id is null then 'campaign.create' else 'campaign.edit' end, 'campaign', c.id,
    case when p_id is null then null else to_jsonb(c) end, to_jsonb(r));
  return r;
end $$;

-- Post-draft copy edits (never commercial terms — those are locked by trigger and budget has its own RPC).
create or replace function public.admin_update_campaign_copy(p_id uuid, p jsonb) returns public.campaigns
language plpgsql security definer set search_path = public, extensions as $$
declare v_admin uuid := public.assert_admin(); c public.campaigns; r public.campaigns;
begin
  select * into c from public.campaigns where id = p_id for update;
  if not found then raise exception 'campaign_not_found'; end if;
  update public.campaigns set
    title = coalesce(nullif(btrim(p->>'title'), ''), title),
    objective = case when p ? 'objective' then nullif(btrim(p->>'objective'), '') else objective end,
    description = case when p ? 'description' then nullif(btrim(p->>'description'), '') else description end,
    guidelines_do = case when p ? 'guidelines_do' then array(select btrim(x) from jsonb_array_elements_text(p->'guidelines_do') x where btrim(x) <> '') else guidelines_do end,
    guidelines_dont = case when p ? 'guidelines_dont' then array(select btrim(x) from jsonb_array_elements_text(p->'guidelines_dont') x where btrim(x) <> '') else guidelines_dont end,
    terms = case when p ? 'terms' then nullif(btrim(p->>'terms'), '') else terms end,
    submission_deadline = case when p ? 'submission_deadline' then nullif(p->>'submission_deadline', '')::timestamptz else submission_deadline end,
    ends_at = case when p ? 'ends_at' then nullif(p->>'ends_at', '')::timestamptz else ends_at end
  where id = c.id returning * into r;
  perform public.write_audit('campaign.edit_copy', 'campaign', c.id, to_jsonb(c), to_jsonb(r));
  return r;
end $$;

create or replace view public.admin_campaigns with (security_invoker = true) as
select c.id, c.brand_id, b.name as brand_name, c.title, c.category, c.content_type, c.status, c.status_reason,
  c.cpm, c.budget, c.earned, c.paid, c.budget_override, greatest(c.budget - c.earned, 0) as remaining,
  c.min_views_to_qualify, c.max_earning_per_submission, c.starts_at, c.ends_at, c.submission_deadline, c.created_at, c.approved_at,
  array(select k.platform::text from public.campaign_platforms k where k.campaign_id = c.id order by 1) as platforms,
  (select count(*) from public.campaign_creators m where m.campaign_id = c.id and m.status = 'joined') as creators_joined,
  (select count(*) from public.submissions s where s.campaign_id = c.id) as submissions,
  (select count(*) from public.submissions s where s.campaign_id = c.id and s.status in ('approved','tracking','completed')) as approved,
  (select count(*) from public.submissions s where s.campaign_id = c.id and s.status = 'pending_review') as pending_review,
  (select coalesce(sum(s.qualified_views), 0) from public.submissions s where s.campaign_id = c.id) as qualified_views,
  (select count(*) from public.campaign_assets a where a.campaign_id = c.id) as assets
from public.campaigns c left join public.brands b on b.id = c.brand_id;
grant select on public.admin_campaigns to authenticated;

-- Brand report: platform breakdown.
create or replace function public.campaign_platform_breakdown(p_campaign_id uuid)
returns table (platform public.platform, submissions bigint, approved bigint, qualified_views bigint, earned bigint)
language sql stable security invoker set search_path = public, extensions as $$
  select s.platform, count(*), count(*) filter (where s.status in ('approved','tracking','completed')),
    coalesce(sum(s.qualified_views), 0)::bigint, coalesce(sum(s.earned), 0)::bigint
  from public.submissions s where s.campaign_id = p_campaign_id group by s.platform order by 4 desc
$$;

-- ─────────────────────────────── Disputes ────────────────────────────
-- One open objection per submission / payout.
create unique index if not exists disputes_one_open_submission on public.disputes(submission_id)
  where submission_id is not null and status in ('open','under_review');
create unique index if not exists disputes_one_open_payout on public.disputes(payout_request_id)
  where payout_request_id is not null and status in ('open','under_review');
create index if not exists disputes_raised_by_idx on public.disputes(raised_by);

create or replace function public.admin_resolve_dispute(p_id uuid, p_status public.dispute_status, p_resolution text) returns public.disputes
language plpgsql security definer set search_path = public, extensions as $$
declare v_admin uuid := public.assert_admin(); d public.disputes; r public.disputes;
begin
  select * into d from public.disputes where id = p_id for update;
  if not found then raise exception 'dispute_not_found'; end if;
  if not ((d.status = 'open' and p_status in ('under_review','resolved','rejected'))
       or (d.status = 'under_review' and p_status in ('resolved','rejected'))) then
    raise exception 'invalid_transition:%->%', d.status, p_status;
  end if;
  if p_status in ('resolved','rejected') and nullif(btrim(p_resolution), '') is null then raise exception 'reason_required'; end if;
  update public.disputes set status = p_status, resolution = coalesce(nullif(btrim(p_resolution), ''), resolution),
    resolved_by = case when p_status in ('resolved','rejected') then v_admin end,
    resolved_at = case when p_status in ('resolved','rejected') then now() end
  where id = d.id returning * into r;
  perform public.notify(d.raised_by, 'dispute_update',
    case p_status when 'under_review' then 'Keberatan sedang ditinjau' when 'resolved' then 'Keberatan diterima' else 'Keberatan ditolak' end,
    coalesce(nullif(btrim(p_resolution), ''), 'Tim TAPP sedang meninjau keberatanmu.'),
    jsonb_build_object('dispute_id', d.id, 'submission_id', d.submission_id, 'payout_id', d.payout_request_id));
  perform public.write_audit('dispute.' || p_status, 'dispute', d.id, jsonb_build_object('status', d.status),
    jsonb_build_object('status', p_status, 'resolution', p_resolution));
  return r;
end $$;

create or replace view public.admin_disputes with (security_invoker = true) as
select d.*, pr.full_name as raiser_name, pr.username as raiser_username,
  s.post_url, s.status as submission_status, s.review_reason as submission_reason, sc.title as submission_campaign,
  p.amount as payout_amount, p.status as payout_status, p.review_reason as payout_reason
from public.disputes d
left join public.profiles pr on pr.id = d.raised_by
left join public.submissions s on s.id = d.submission_id
left join public.campaigns sc on sc.id = s.campaign_id
left join public.payout_requests p on p.id = d.payout_request_id;
grant select on public.admin_disputes to authenticated;

-- ─────────────────────────────── Support ─────────────────────────────
alter table public.support_tickets add column if not exists admin_reply text, add column if not exists replied_at timestamptz;

create or replace function public.admin_reply_ticket(p_id uuid, p_reply text, p_status public.ticket_status) returns public.support_tickets
language plpgsql security definer set search_path = public, extensions as $$
declare v_admin uuid := public.assert_admin(); t public.support_tickets; r public.support_tickets;
begin
  select * into t from public.support_tickets where id = p_id for update;
  if not found then raise exception 'ticket_not_found'; end if;
  if nullif(btrim(p_reply), '') is null and p_status = t.status then raise exception 'reason_required'; end if;
  update public.support_tickets set status = p_status, assigned_to = coalesce(assigned_to, v_admin),
    admin_reply = coalesce(nullif(btrim(p_reply), ''), admin_reply),
    replied_at = case when nullif(btrim(p_reply), '') is not null then now() else replied_at end
  where id = t.id returning * into r;
  if nullif(btrim(p_reply), '') is not null then
    perform public.notify(t.user_id, 'support_reply', 'Balasan dari tim TAPP', left(btrim(p_reply), 240), jsonb_build_object('ticket_id', t.id));
  end if;
  perform public.write_audit('ticket.reply', 'support_ticket', t.id, jsonb_build_object('status', t.status),
    jsonb_build_object('status', p_status, 'reply', p_reply));
  return r;
end $$;

create or replace view public.admin_tickets with (security_invoker = true) as
select t.*, pr.full_name as user_name, pr.username as user_username
from public.support_tickets t left join public.profiles pr on pr.id = t.user_id;
grant select on public.admin_tickets to authenticated;

-- Creators may raise at most 5 tickets per day (spam guard at the row level).
create or replace function public.guard_ticket_rate() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  if (select count(*) from public.support_tickets where user_id = new.user_id and created_at > now() - interval '24 hours') >= 5 then
    raise exception 'ticket_rate_limited';
  end if;
  return new;
end $$;
drop trigger if exists support_tickets_rate on public.support_tickets;
create trigger support_tickets_rate before insert on public.support_tickets for each row execute function public.guard_ticket_rate();

-- ─────────────────────────────── Audit ───────────────────────────────
create or replace view public.admin_audit_logs with (security_invoker = true) as
select a.*, pr.username as actor_username, pr.full_name as actor_name
from public.audit_logs a left join public.profiles pr on pr.id = a.actor_id;
grant select on public.admin_audit_logs to authenticated;

-- Queue counts gain disputes + tickets.
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
  (select count(*) from public.campaigns where status = 'pending_approval')                                   as campaigns_pending;
grant select on public.admin_queue_counts to authenticated;

revoke execute on function public.upsert_campaign_draft(uuid, jsonb), public.admin_update_campaign_copy(uuid, jsonb),
  public.campaign_platform_breakdown(uuid), public.admin_resolve_dispute(uuid, public.dispute_status, text),
  public.admin_reply_ticket(uuid, text, public.ticket_status) from public, anon;
grant execute on function public.upsert_campaign_draft(uuid, jsonb), public.admin_update_campaign_copy(uuid, jsonb),
  public.campaign_platform_breakdown(uuid), public.admin_resolve_dispute(uuid, public.dispute_status, text),
  public.admin_reply_ticket(uuid, text, public.ticket_status) to authenticated;
revoke execute on function public.guard_ticket_rate() from public, anon, authenticated;
