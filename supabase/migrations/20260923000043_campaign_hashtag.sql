-- TAPP · 0043 · Campaign hashtag reach for the brand report.
--
-- Each campaign can carry its own hashtag (e.g. TAPPKopiSenja, stored without "#"). Every 6 hours the
-- hashtag-stats Edge Function reads TikTok's public hashtag counters (videos using the tag, total views of those
-- videos) and appends them here. The brand report shows the latest totals and the growth since the first reading.
-- These are TikTok's own numbers for the whole hashtag — they include every video using it, also outside TAPP,
-- so a unique hashtag per campaign keeps them meaningful. Instagram/YouTube do not expose hashtag views publicly.

set search_path = public, extensions;

alter table public.campaigns add column if not exists hashtag text;
alter table public.campaigns drop constraint if exists campaigns_hashtag_format;
alter table public.campaigns add constraint campaigns_hashtag_format check (hashtag is null or hashtag ~ '^[A-Za-z0-9_]{2,100}$');

create table if not exists public.campaign_hashtag_stats (
  id          bigserial primary key,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  hashtag     text not null,
  platform    text not null default 'tiktok',
  video_count bigint check (video_count >= 0),
  view_count  bigint check (view_count >= 0),
  captured_at timestamptz not null default now()
);
create index if not exists campaign_hashtag_stats_idx on public.campaign_hashtag_stats(campaign_id, captured_at);
alter table public.campaign_hashtag_stats enable row level security;
drop policy if exists campaign_hashtag_stats_read on public.campaign_hashtag_stats;
create policy campaign_hashtag_stats_read on public.campaign_hashtag_stats for select to authenticated using (
  public.is_admin() or campaign_id in (select private.my_brand_campaign_ids())
);
revoke insert, update, delete on public.campaign_hashtag_stats from anon, authenticated;
grant select on public.campaign_hashtag_stats to authenticated;

-- Admin: set or clear a campaign's hashtag ("#" and spaces are stripped).
create or replace function public.admin_set_campaign_hashtag(p_campaign_id uuid, p_hashtag text) returns public.campaigns
language plpgsql security definer set search_path = public, extensions as $$
declare v_admin uuid := public.assert_admin(); c public.campaigns; r public.campaigns; v text;
begin
  select * into c from public.campaigns where id = p_campaign_id for update;
  if not found then raise exception 'campaign_not_found'; end if;
  v := nullif(regexp_replace(coalesce(p_hashtag, ''), '[#\s]', '', 'g'), '');
  if v is not null and v !~ '^[A-Za-z0-9_]{2,100}$' then raise exception 'invalid_hashtag'; end if;
  update public.campaigns set hashtag = v where id = c.id returning * into r;
  perform public.write_audit('campaign.hashtag', 'campaign', c.id, jsonb_build_object('hashtag', c.hashtag), jsonb_build_object('hashtag', v));
  return r;
end $$;
revoke execute on function public.admin_set_campaign_hashtag(uuid, text) from public, anon;
grant execute on function public.admin_set_campaign_hashtag(uuid, text) to authenticated;

-- Campaigns whose hashtag should be read now (open campaigns, last reading 6+ hours ago).
create or replace function public.due_hashtag_campaigns() returns table (campaign_id uuid, hashtag text)
language sql stable security definer set search_path = public, extensions as $$
  select c.id, c.hashtag from public.campaigns c
  where c.hashtag is not null and c.status in ('active', 'ending', 'paused')
    and not exists (select 1 from public.campaign_hashtag_stats h where h.campaign_id = c.id and h.captured_at > now() - interval '6 hours')
  limit 20
$$;
revoke execute on function public.due_hashtag_campaigns() from public, anon, authenticated;
grant execute on function public.due_hashtag_campaigns() to service_role;

insert into public.app_settings (key, value)
values ('hashtag_stats_url', to_jsonb('https://njffqsbddzztfxxbavpp.supabase.co/functions/v1/hashtag-stats'::text))
on conflict (key) do nothing;

do $$
begin
  if to_regclass('cron.job') is null then return; end if;
  perform cron.unschedule(jobid) from cron.job where jobname = 'hashtag-stats-sweep';
  execute $cmd$ select cron.schedule('hashtag-stats-sweep', '41 * * * *', $job$
    select net.http_post(
      url := (select value #>> '{}' from public.app_settings where key = 'hashtag_stats_url'),
      body := '{}'::jsonb,
      headers := jsonb_build_object('Content-Type', 'application/json',
        'x-dispatch-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'fetch_metrics_secret')),
      timeout_milliseconds := 120000)
  $job$) $cmd$;
end $$;
