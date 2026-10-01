-- TAPP · 0028 · Brand meeting booking from the website (/meeting), handled in Admin → Meeting.
-- Visitors pick a 30-minute slot (Mon–Fri, 10:00–16:30 WIB) and leave their contact details. The table is
-- closed to everyone except admins; signed-out visitors only reach it through two narrow RPCs:
--   meeting_slots_taken()  which slots are gone (times only, no personal data)
--   request_meeting()      validated insert, one slot per request, spam brakes
-- Emails (confirmation, admin alert, scheduled invite) go through send_app_email → mailer once it's live.

set search_path = public, extensions;

create type public.meeting_status as enum ('new', 'scheduled', 'done', 'cancelled');

create table public.meeting_requests (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (char_length(name) between 2 and 80),
  company      text not null check (char_length(company) between 2 and 120),
  email        text not null check (char_length(email) <= 160 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  whatsapp     text check (whatsapp is null or whatsapp ~ '^\+?[0-9][0-9 -]{7,19}$'),
  goal         text check (goal is null or char_length(goal) <= 1000),
  budget_range text check (budget_range is null or budget_range in ('<10jt', '10-50jt', '50-100jt', '>100jt')),
  slot         timestamptz not null,
  status       public.meeting_status not null default 'new',
  meet_link    text check (meet_link is null or meet_link ~ '^https://'),
  admin_note   text,
  handled_by   uuid references public.profiles(id),
  handled_at   timestamptz,
  created_at   timestamptz not null default now()
);
-- A slot can be held by one open request at a time.
create unique index meeting_requests_slot_open_key on public.meeting_requests(slot) where status in ('new', 'scheduled');
create index meeting_requests_status_idx on public.meeting_requests(status, slot);
create index meeting_requests_email_idx on public.meeting_requests(lower(email), created_at desc);
create index meeting_requests_handled_by_idx on public.meeting_requests(handled_by);

alter table public.meeting_requests enable row level security;
revoke all on public.meeting_requests from public, anon, authenticated;
grant select on public.meeting_requests to authenticated;
create policy meeting_requests_admin_read on public.meeting_requests for select to authenticated using ((select public.is_admin()));

-- Bookable slots: weekdays, 10:00–16:30 Jakarta time, on the hour or half hour, 12 hours to 45 days ahead.
create or replace function public.meeting_slot_ok(p_slot timestamptz) returns boolean
language sql stable set search_path = public, extensions as $$
  select extract(isodow from p_slot at time zone 'Asia/Jakarta') between 1 and 5
     and (p_slot at time zone 'Asia/Jakarta')::time between time '10:00' and time '16:30'
     and extract(minute from p_slot at time zone 'Asia/Jakarta') in (0, 30)
     and extract(second from p_slot) = 0
$$;
revoke execute on function public.meeting_slot_ok(timestamptz) from public, anon, authenticated;

create or replace function public.meeting_slots_taken(p_days integer default 45) returns setof timestamptz
language sql stable security definer set search_path = public, extensions as $$
  select slot from public.meeting_requests
  where status in ('new', 'scheduled') and slot >= now() and slot < now() + make_interval(days => least(greatest(p_days, 1), 60))
  order by slot
$$;
revoke execute on function public.meeting_slots_taken(integer) from public;
grant execute on function public.meeting_slots_taken(integer) to anon, authenticated;

create or replace function public.request_meeting(
  p_name text, p_company text, p_email text, p_slot timestamptz,
  p_whatsapp text default null, p_goal text default null, p_budget_range text default null
) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare r public.meeting_requests; v_email text := lower(trim(p_email)); v_admin text;
begin
  if not public.meeting_slot_ok(p_slot) then raise exception 'meeting_slot_invalid'; end if;
  if p_slot < now() + interval '12 hours' or p_slot > now() + interval '45 days' then raise exception 'meeting_slot_out_of_range'; end if;
  -- spam brakes: two open requests per email, 30 new requests per hour overall
  if (select count(*) from public.meeting_requests where lower(email) = v_email and status = 'new') >= 2 then raise exception 'meeting_too_many_open'; end if;
  if (select count(*) from public.meeting_requests where created_at > now() - interval '1 hour') >= 30 then raise exception 'meeting_rate_limited'; end if;

  begin
    insert into public.meeting_requests (name, company, email, whatsapp, goal, budget_range, slot)
    values (trim(p_name), trim(p_company), v_email, nullif(trim(p_whatsapp), ''), nullif(trim(p_goal), ''), nullif(p_budget_range, ''), p_slot)
    returning * into r;
  exception when unique_violation then raise exception 'meeting_slot_taken';
  end;

  perform public.write_audit('meeting.requested', 'meeting_request', r.id, null, jsonb_build_object('company', r.company, 'slot', r.slot));
  -- Emails are best effort: a booking never fails because the mailer is down or not configured yet.
  begin
    perform public.send_app_email('meeting_received', r.email, jsonb_build_object('name', r.name, 'slot', r.slot), 'meeting_received:' || r.id);
    for v_admin in select x from public.app_settings s, jsonb_array_elements_text(s.value) x where s.key = 'admin_emails' loop
      perform public.send_app_email('meeting_admin_alert', v_admin,
        jsonb_build_object('name', r.name, 'company', r.company, 'email', r.email, 'whatsapp', r.whatsapp, 'goal', r.goal, 'budget_range', r.budget_range, 'slot', r.slot),
        'meeting_admin_alert:' || r.id || ':' || v_admin);
    end loop;
  exception when others then null;
  end;
  return jsonb_build_object('id', r.id, 'slot', r.slot);
end $$;
revoke execute on function public.request_meeting(text, text, text, timestamptz, text, text, text) from public;
grant execute on function public.request_meeting(text, text, text, timestamptz, text, text, text) to anon, authenticated;

create or replace function public.admin_update_meeting(p_id uuid, p_status public.meeting_status, p_meet_link text default null, p_note text default null)
returns public.meeting_requests
language plpgsql security definer set search_path = public, extensions as $$
declare v_admin uuid := public.assert_admin(); r public.meeting_requests; o public.meeting_requests;
begin
  select * into o from public.meeting_requests where id = p_id for update;
  if not found then raise exception 'meeting_not_found'; end if;
  if p_status = 'scheduled' and coalesce(nullif(trim(p_meet_link), ''), o.meet_link) is null then raise exception 'meeting_link_required'; end if;
  update public.meeting_requests set status = p_status, meet_link = coalesce(nullif(trim(p_meet_link), ''), meet_link),
    admin_note = coalesce(nullif(trim(p_note), ''), admin_note), handled_by = v_admin, handled_at = now()
  where id = p_id returning * into r;
  perform public.write_audit('meeting.' || p_status, 'meeting_request', r.id,
    jsonb_build_object('status', o.status, 'meet_link', o.meet_link), jsonb_build_object('status', r.status, 'meet_link', r.meet_link));
  if p_status = 'scheduled' and (o.status <> 'scheduled' or o.meet_link is distinct from r.meet_link) then
    begin
      perform public.send_app_email('meeting_scheduled', r.email, jsonb_build_object('name', r.name, 'slot', r.slot, 'meet_link', r.meet_link),
        'meeting_scheduled:' || r.id || ':' || md5(r.meet_link));
    exception when others then null;
    end;
  end if;
  return r;
end $$;
revoke execute on function public.admin_update_meeting(uuid, public.meeting_status, text, text) from public, anon;
grant execute on function public.admin_update_meeting(uuid, public.meeting_status, text, text) to authenticated;
