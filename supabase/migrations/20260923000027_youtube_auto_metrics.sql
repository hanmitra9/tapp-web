-- TAPP · 0027 · Automatic views for YouTube via the public Data API (API key, no creator OAuth).
-- Public video statistics need no per-creator login, so YouTube submissions are tracked as soon as they're
-- approved. The fetch-metrics Edge Function (supabase/functions/fetch-metrics) reads this queue every 3 hours
-- (cron from migration 023) and writes through record_api_metrics — raw views only; qualification stays a
-- human decision in Admin → Performa. Needs the YOUTUBE_API_KEY function secret; without it the function no-ops.

set search_path = public, extensions;

-- Work queue: approved/tracking YouTube submissions not checked in the last p_min_interval_minutes, with the
-- video id and the last recorded views (used when a video stops being publicly visible).
create or replace function public.due_for_youtube_metrics(p_min_interval_minutes integer default 180, p_limit integer default 500)
returns table (submission_id uuid, video_id text, last_views bigint)
language sql stable security definer set search_path = public, extensions as $$
  select s.id, substring(s.normalized_url from '^youtube\.com/watch/([A-Za-z0-9_-]+)$'),
         (select m.views from public.content_metrics m where m.submission_id = s.id order by m.captured_at desc limit 1)
  from public.submissions s
  where s.platform = 'youtube'
    and s.status in ('approved', 'tracking')
    and s.normalized_url ~ '^youtube\.com/watch/[A-Za-z0-9_-]+$'
    and (s.last_metrics_at is null or s.last_metrics_at < now() - make_interval(mins => p_min_interval_minutes))
  order by s.last_metrics_at asc nulls first
  limit p_limit
$$;
revoke execute on function public.due_for_youtube_metrics(integer, integer) from public, anon, authenticated;
grant execute on function public.due_for_youtube_metrics(integer, integer) to service_role;

-- Point the 3-hourly sweep at the function. Harmless before deploy / before the API key is set: the cron
-- request just fails or the function returns {skipped: 'no_api_key'}.
update public.app_settings set value = to_jsonb('https://njffqsbddzztfxxbavpp.supabase.co/functions/v1/fetch-metrics'::text), updated_at = now()
where key = 'fetch_metrics_url';
