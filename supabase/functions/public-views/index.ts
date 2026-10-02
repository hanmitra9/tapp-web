// public-views — read a submitted post's public counters (no platform login), for the admin pay form.
//   POST { submission_id } with an admin's session JWT → { views, likes, comments, shares, source } or { error }.
// TikTok: video page JSON (stats.playCount …) · YouTube: watch page (videoDetails.viewCount) ·
// Instagram: page JSON when it isn't behind the login wall (often it is → 'unreadable').
// Nothing is written: the admin confirms the number and admin_pay_submission records it.
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

async function page(url: string) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'id,en;q=0.8' }, redirect: 'follow', signal: AbortSignal.timeout(12_000) });
    return r.ok ? await r.text() : null;
  } catch { return null; }
}
const num = (html: string, ...keys: string[]) => {
  for (const k of keys) {
    const m = html.match(new RegExp(`"${k}"\\s*:\\s*"?(\\d+)"?`));
    if (m) return Number(m[1]);
  }
  return null;
};
type Counts = { views: number; likes: number | null; comments: number | null; shares: number | null };

async function tiktok(url: string): Promise<Counts | null> {
  const html = await page(url);
  if (!html) return null;
  // Prefer the stats block of the video itself (the page also embeds author stats).
  const block = html.match(/"stats"\s*:\s*\{[^{}]*"playCount"[^{}]*\}/)?.[0] ?? html;
  const views = num(block, 'playCount');
  return views == null ? null : { views, likes: num(block, 'diggCount'), comments: num(block, 'commentCount'), shares: num(block, 'shareCount') };
}
async function youtube(url: string): Promise<Counts | null> {
  const html = await page(url);
  if (!html) return null;
  const block = html.match(/"videoDetails"\s*:\s*\{[\s\S]*?"viewCount"\s*:\s*"\d+"/)?.[0] ?? html;
  const views = num(block, 'viewCount');
  return views == null ? null : { views, likes: null, comments: null, shares: null };
}
async function instagram(url: string): Promise<Counts | null> {
  const html = await page(url);
  if (!html) return null;
  const views = num(html, 'video_play_count', 'play_count', 'video_view_count', 'view_count');
  return views == null ? null : { views, likes: num(html, 'like_count'), comments: num(html, 'comment_count'), shares: null };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const { data: u } = await sb.auth.getUser((req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, ''));
  if (!u?.user) return json(401, { error: 'unauthorized' });
  const { data: me } = await sb.from('profiles').select('role').eq('id', u.user.id).maybeSingle();
  if (me?.role !== 'admin') return json(403, { error: 'forbidden' });
  const { submission_id } = await req.json().catch(() => ({}));
  if (typeof submission_id !== 'string') return json(400, { error: 'submission_id_required' });
  const { data: s } = await sb.from('submissions').select('platform, post_url').eq('id', submission_id).maybeSingle();
  if (!s) return json(404, { error: 'submission_not_found' });

  const read = s.platform === 'tiktok' ? tiktok : s.platform === 'youtube' ? youtube : s.platform === 'instagram' ? instagram : null;
  const counts = read ? await read(s.post_url) : null;
  if (!counts) return json(200, { error: 'unreadable', platform: s.platform });
  return json(200, { ...counts, platform: s.platform, read_at: new Date().toISOString() });
});
