// submission-check — open a submitted post right after the creator submits and record what is publicly visible:
// the post exists, it was posted by the creator's linked account, and its counters (views/likes/comments/shares).
//   POST { submission_id } with the session JWT of that submission's creator (or an admin).
//   POST { sweep: true } with x-dispatch-secret (cron every 20 min): re-checks open clips every 6 hours for 30 days.
//   → { status: 'ok' | 'not_owner' | 'not_found' | 'unreadable', views, author, … } and a row in submission_checks.
// Nothing is approved or rejected here: the admin sees the result in review and decides.
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

type Result = { status: 'ok' | 'not_owner' | 'not_found' | 'unreadable'; author?: string | null; views?: number | null; likes?: number | null; comments?: number | null; shares?: number | null; note?: string };

async function page(url: string) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'id,en;q=0.8' }, redirect: 'follow', signal: AbortSignal.timeout(12_000) });
    if (r.status === 404) return { notFound: true as const };
    return r.ok ? { html: await r.text() } : null;
  } catch { return null; }
}
const num = (src: string, key: string) => { const m = src.match(new RegExp(`"${key}"\\s*:\\s*"?(\\d+)"?`)); return m ? Number(m[1]) : null; };
const same = (a?: string | null, b?: string | null) => !!a && !!b && a.replace(/^@/, '').toLowerCase() === b.replace(/^@/, '').toLowerCase();

async function tiktok(url: string, handle: string | null): Promise<Result> {
  const p = await page(url);
  if (!p) return { status: 'unreadable', note: 'TikTok tidak bisa dibaca otomatis' };
  if ('notFound' in p) return { status: 'not_found', note: 'Video tidak ditemukan' };
  const html = p.html;
  const code = html.match(/"statusCode":(\d+)/)?.[1];
  const item = html.match(/"itemStruct":\{"id":"(\d+)"/)?.[1];
  if (!item) return code && code !== '0' ? { status: 'not_found', note: 'Video tidak ditemukan, dihapus, atau diprivat' } : { status: 'unreadable', note: 'Halaman TikTok tidak berisi data video' };
  const author = html.match(/"author":\{[^{}]*?"uniqueId":"([^"]+)"/)?.[1] ?? null;
  const stats = html.match(/"stats"\s*:\s*\{[^{}]*"playCount"[^{}]*\}/)?.[0] ?? '';
  const c = { author, views: num(stats, 'playCount'), likes: num(stats, 'diggCount'), comments: num(stats, 'commentCount'), shares: num(stats, 'shareCount') };
  if (handle && author && !same(author, handle)) return { status: 'not_owner', ...c, note: `Diposting oleh @${author}, bukan @${handle}` };
  return { status: c.views == null ? 'unreadable' : 'ok', ...c };
}

function youtubeId(url: string) {
  return url.match(/(?:youtu\.be\/|[?&]v=|\/shorts\/|\/live\/|\/embed\/)([A-Za-z0-9_-]{11})/)?.[1] ?? null;
}
async function youtube(url: string, handle: string | null): Promise<Result> {
  const id = youtubeId(url);
  if (!id) return { status: 'not_found', note: 'Link YouTube tidak dikenali' };
  const p = await page(`https://www.youtube.com/watch?v=${id}`);
  if (!p) return { status: 'unreadable', note: 'YouTube tidak bisa dibaca otomatis' };
  if ('notFound' in p) return { status: 'not_found', note: 'Video tidak ditemukan' };
  const html = p.html;
  if (/"playabilityStatus":\{"status":"(ERROR|LOGIN_REQUIRED|UNPLAYABLE)"/.test(html) && !/"videoDetails"/.test(html)) return { status: 'not_found', note: 'Video tidak tersedia atau diprivat' };
  const block = html.match(/"videoDetails"\s*:\s*\{[\s\S]*?"viewCount"\s*:\s*"\d+"/)?.[0] ?? '';
  const views = num(block, 'viewCount');
  const author = html.match(/"ownerProfileUrl":"https?:\/\/www\.youtube\.com\/@([^"]+)"/)?.[1] ?? null;
  if (views == null) return { status: 'unreadable', author, note: 'Views YouTube tidak terbaca' };
  if (handle && author && !same(author, handle)) return { status: 'not_owner', author, views, note: `Diposting oleh @${author}, bukan @${handle}` };
  return { status: 'ok', author, views, likes: null, comments: null, shares: null };
}

async function instagram(url: string, handle: string | null): Promise<Result> {
  const code = url.match(/instagram\.com\/(?:[^/]+\/)?(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/)?.[1];
  if (!code) return { status: 'not_found', note: 'Link Instagram tidak dikenali' };
  if (!handle) return { status: 'unreadable', note: 'Akun Instagram belum terhubung' };
  try {
    const r = await fetch(`https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(handle)}`,
      { headers: { 'User-Agent': UA, 'x-ig-app-id': '936619743392459', 'Accept-Language': 'id,en;q=0.8' }, signal: AbortSignal.timeout(12_000) });
    if (!r.ok) return { status: 'unreadable', note: 'Instagram tidak bisa dibaca otomatis' };
    const u = (await r.json())?.data?.user;
    const edges = [...(u?.edge_owner_to_timeline_media?.edges ?? []), ...(u?.edge_felix_video_timeline?.edges ?? [])];
    // deno-lint-ignore no-explicit-any
    const n = edges.map((e: { node: Record<string, any> }) => e.node).find((x: Record<string, any>) => x?.shortcode === code);
    if (!n) return { status: 'unreadable', note: `Postingan tidak ada di 12 postingan terbaru @${handle}; dicek manual` };
    const v = n.video_view_count ?? n.video_play_count ?? null;
    return { status: 'ok', author: handle, views: typeof v === 'number' ? v : null, likes: n.edge_liked_by?.count ?? n.edge_media_preview_like?.count ?? null, comments: n.edge_media_to_comment?.count ?? null, shares: null };
  } catch { return { status: 'unreadable', note: 'Instagram tidak bisa dibaca otomatis' }; }
}

// deno-lint-ignore no-explicit-any
type Sb = any;
type Sub = { id: string; creator_id: string; platform: string; post_url: string };

// Check one submission, save the latest result and append the counters to the views history (0042).
async function check(sb: Sb, s: Sub) {
  const { data: acc } = await sb.from('creator_platforms').select('handle').eq('creator_id', s.creator_id).eq('platform', s.platform).limit(1).maybeSingle();
  const handle = acc?.handle ? String(acc.handle).replace(/^@/, '') : null;
  const r: Result = s.platform === 'tiktok' ? await tiktok(s.post_url, handle)
    : s.platform === 'youtube' ? await youtube(s.post_url, handle)
    : s.platform === 'instagram' ? await instagram(s.post_url, handle)
    : { status: 'unreadable', note: 'Platform ini dicek manual' };
  const row = { submission_id: s.id, status: r.status, author: r.author ?? null, views: r.views ?? null, likes: r.likes ?? null,
    comments: r.comments ?? null, shares: r.shares ?? null, note: r.note ?? null, checked_at: new Date().toISOString() };
  const { error } = await sb.from('submission_checks').upsert(row);
  if (error) return null;
  if (row.views != null || row.status === 'not_found') {
    await sb.from('submission_check_log').insert({ submission_id: s.id, status: row.status, views: row.views, likes: row.likes,
      comments: row.comments, shares: row.shares, checked_at: row.checked_at });
  }
  // A clean reading also counts as the clip's raw views in the brand report (0044); qualified views stay admin-paid.
  if (row.status === 'ok' && row.views != null) {
    await sb.rpc('record_check_metrics', { p_submission_id: s.id, p_views: row.views, p_likes: row.likes, p_comments: row.comments, p_shares: row.shares });
  }
  return row;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const body = await req.json().catch(() => ({}));

  // Scheduled sweep (cron, every 20 minutes, 8 per run): re-check open clips whose last check is 6+ hours old.
  const secret = req.headers.get('x-dispatch-secret');
  if (secret) {
    const { data: ok } = await sb.rpc('verify_fetch_metrics_secret', { p_secret: secret });
    if (ok !== true) return json(401, { error: 'unauthorized' });
    const { data: ids } = await sb.rpc('due_submission_checks', { p_limit: 8 });
    const list = ((ids ?? []) as (string | { due_submission_checks: string })[]).map((x) => typeof x === 'string' ? x : x.due_submission_checks);
    let done = 0;
    for (const id of list) {
      const { data: s } = await sb.from('submissions').select('id, creator_id, platform, post_url').eq('id', id).maybeSingle();
      if (s && await check(sb, s)) done++;
      await new Promise((r) => setTimeout(r, 800));   // be gentle with the platforms
    }
    return json(200, { swept: done, due: list.length });
  }

  // Creator (own submission) or admin.
  const { data: u } = await sb.auth.getUser((req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, ''));
  if (!u?.user) return json(401, { error: 'unauthorized' });
  const { submission_id } = body as { submission_id?: unknown };
  if (typeof submission_id !== 'string') return json(400, { error: 'submission_id_required' });
  const { data: s } = await sb.from('submissions').select('id, creator_id, platform, post_url').eq('id', submission_id).maybeSingle();
  if (!s) return json(404, { error: 'submission_not_found' });
  if (s.creator_id !== u.user.id) {
    const { data: me } = await sb.from('profiles').select('role').eq('id', u.user.id).maybeSingle();
    if (me?.role !== 'admin') return json(403, { error: 'forbidden' });
  }
  // One check per 30 seconds per submission.
  const { data: prev } = await sb.from('submission_checks').select('*').eq('submission_id', s.id).maybeSingle();
  if (prev && Date.now() - new Date(prev.checked_at).getTime() < 30_000) return json(200, prev);
  const row = await check(sb, s);
  return row ? json(200, row) : json(500, { error: 'save_failed' });
});
