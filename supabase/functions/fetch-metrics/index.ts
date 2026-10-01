// fetch-metrics — records views for approved YouTube submissions from the public YouTube Data API.
// Invoked by the fetch-metrics-sweep cron (every 3h). Auth: x-dispatch-secret header, checked against
// Supabase Vault via a service-role-only RPC. Needs the YOUTUBE_API_KEY function secret.
// Writes raw metrics only (record_api_metrics); turning views into qualified views stays with an admin.
import { createClient } from 'npm:@supabase/supabase-js@2';

type Due = { submission_id: string; video_id: string; last_views: number | null };
type Video = { id: string; statistics?: { viewCount?: string; likeCount?: string; commentCount?: string }; status?: { privacyStatus?: string } };

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const num = (v: string | undefined) => (v ? Number(v) : 0);

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

  const { data: ok } = await sb.rpc('verify_fetch_metrics_secret', { p_secret: req.headers.get('x-dispatch-secret') ?? '' });
  if (ok !== true) return json(401, { error: 'unauthorized' });

  const key = Deno.env.get('YOUTUBE_API_KEY');
  if (!key) return json(200, { skipped: 'no_api_key' });

  const { data, error } = await sb.rpc('due_for_youtube_metrics', { p_min_interval_minutes: 170, p_limit: 500 });
  if (error) return json(500, { error: error.message });
  const due = (data ?? []) as Due[];
  if (!due.length) return json(200, { checked: 0 });

  let recorded = 0, hidden = 0;
  const failures: string[] = [];
  // videos.list takes up to 50 ids per call (1 quota unit each call; default quota is 10,000/day).
  for (let i = 0; i < due.length; i += 50) {
    const chunk = due.slice(i, i + 50);
    const ids = [...new Set(chunk.map((d) => d.video_id))].join(',');
    const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics,status&id=${ids}&key=${encodeURIComponent(key)}`);
    if (!res.ok) { failures.push(`youtube_${res.status}`); continue; }
    const body = (await res.json()) as { items?: Video[] };
    const byId = new Map((body.items ?? []).map((v) => [v.id, v]));

    for (const d of chunk) {
      const v = byId.get(d.video_id);
      // Not returned (deleted, or locked) or private: no longer publicly visible. Record the last known views
      // (never invent new ones) and let record_api_metrics flag the submission for an admin to check.
      const visible = !!v && v.status?.privacyStatus !== 'private';
      const state = visible ? 'live' : v ? 'private' : 'deleted';
      const r = await sb.rpc('record_api_metrics', {
        p_submission_id: d.submission_id,
        p_views: visible ? num(v!.statistics?.viewCount) : (d.last_views ?? 0),
        p_likes: visible ? num(v!.statistics?.likeCount) : 0,
        p_comments: visible ? num(v!.statistics?.commentCount) : 0,
        p_content_state: state,
        p_raw: { source: 'youtube_data_api_v3', video_id: d.video_id, found: !!v, privacy: v?.status?.privacyStatus ?? null },
      });
      if (r.error) failures.push(`${d.submission_id}: ${r.error.message}`);
      else if (visible) recorded++; else hidden++;
    }
  }
  return json(200, { checked: due.length, recorded, hidden, failures: failures.slice(0, 20) });
});
