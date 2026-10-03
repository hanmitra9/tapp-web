// hashtag-stats — read TikTok's public counters for each campaign hashtag (videos using it, total views) and
// append them to campaign_hashtag_stats for the brand report (0043).
//   POST with x-dispatch-secret (hourly cron; each campaign is read at most every 6 hours)
//   POST { campaign_id } with an admin's session JWT: read that campaign now ("Perbarui sekarang" in admin).
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-dispatch-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

async function tiktokTag(tag: string): Promise<{ videos: number; views: number } | null> {
  try {
    const r = await fetch(`https://www.tiktok.com/api/challenge/detail/?challengeName=${encodeURIComponent(tag)}&aid=1988`,
      { headers: { 'User-Agent': UA, Referer: `https://www.tiktok.com/tag/${encodeURIComponent(tag)}`, 'Accept-Language': 'id,en;q=0.8' }, signal: AbortSignal.timeout(12_000) });
    if (!r.ok) return null;
    const d = await r.json();
    const s2 = d?.challengeInfo?.statsV2, s = d?.challengeInfo?.challenge?.stats;
    if (!s2 && !s) return { videos: 0, views: 0 };          // hashtag not used yet
    return { videos: Number(s2?.videoCount ?? s?.videoCount ?? 0), views: Number(s2?.viewCount ?? s?.viewCount ?? 0) };
  } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

  let jobs: { campaign_id: string; hashtag: string }[] = [];
  const secret = req.headers.get('x-dispatch-secret');
  if (secret) {
    const { data: ok } = await sb.rpc('verify_fetch_metrics_secret', { p_secret: secret });
    if (ok !== true) return json(401, { error: 'unauthorized' });
    const { data } = await sb.rpc('due_hashtag_campaigns');
    jobs = (data ?? []) as typeof jobs;
  } else {
    const { data: u } = await sb.auth.getUser((req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, ''));
    if (!u?.user) return json(401, { error: 'unauthorized' });
    const { data: me } = await sb.from('profiles').select('role').eq('id', u.user.id).maybeSingle();
    if (me?.role !== 'admin') return json(403, { error: 'forbidden' });
    const { campaign_id } = await req.json().catch(() => ({}));
    const { data: c } = await sb.from('campaigns').select('id, hashtag').eq('id', campaign_id ?? '').maybeSingle();
    if (!c?.hashtag) return json(400, { error: 'no_hashtag' });
    jobs = [{ campaign_id: c.id, hashtag: c.hashtag }];
  }

  const out = [];
  for (const j of jobs) {
    const s = await tiktokTag(j.hashtag);
    if (s) {
      const row = { campaign_id: j.campaign_id, hashtag: j.hashtag, platform: 'tiktok', video_count: s.videos, view_count: s.views };
      await sb.from('campaign_hashtag_stats').insert(row);
      out.push(row);
    }
    await new Promise((r) => setTimeout(r, 800));
  }
  return json(200, { read: out.length, due: jobs.length, rows: secret ? undefined : out });
});
