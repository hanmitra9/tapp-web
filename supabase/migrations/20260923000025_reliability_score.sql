-- TAPP · 0025 · Reliability score, automatic. Recomputed whenever a submission's review status or post
-- state changes (trigger), so every path — review, flag, resubmit, metrics entry — keeps it current.
--
-- Score (0–100) = share of reviewed clips that were approved AND are still live, smoothed so one clip
-- can't swing it to 0 or 100:   100 × (good + 1) / (reviewed + 2)
--   reviewed = approved/tracking/completed + rejected + flagged
--   good     = approved/tracking/completed whose post isn't deleted/private
-- No reviewed clips yet → 0 (the app shows "belum ada data"). needs_changes / pending_review don't count.

set search_path = public, extensions;

create or replace function public.recompute_reliability(p_creator uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare v_reviewed int; v_good int; v_score numeric(5,2);
begin
  select count(*) filter (where status in ('approved','tracking','completed','rejected','flagged')),
         count(*) filter (where status in ('approved','tracking','completed') and content_state not in ('deleted','private'))
    into v_reviewed, v_good
  from public.submissions where creator_id = p_creator;
  v_score := case when v_reviewed = 0 then 0 else round(100.0 * (v_good + 1) / (v_reviewed + 2), 2) end;
  update public.creator_profiles set reliability_score = v_score
   where user_id = p_creator and reliability_score is distinct from v_score;
end $$;
revoke execute on function public.recompute_reliability(uuid) from public, anon, authenticated;

create or replace function public.tg_submissions_reliability() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public.recompute_reliability(new.creator_id);
  return null;
end $$;
revoke execute on function public.tg_submissions_reliability() from public, anon, authenticated;

drop trigger if exists submissions_reliability on public.submissions;
create trigger submissions_reliability after insert or update of status, content_state on public.submissions
  for each row execute function public.tg_submissions_reliability();

comment on column public.creator_profiles.reliability_score is
  'Automatic: 100 × (approved-and-live + 1) / (reviewed + 2); 0 until the first review. See public.recompute_reliability().';

-- Backfill.
do $$
declare r record;
begin
  for r in select user_id from public.creator_profiles loop
    perform public.recompute_reliability(r.user_id);
  end loop;
end $$;
