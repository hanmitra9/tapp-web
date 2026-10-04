// my-videos — videos for the "Ambil Campaign" wizard, read from public pages (no platform login).
//   POST { platform_id } with the creator's session JWT → { videos: Video[], supported } — latest posts of that linked account
//     (Instagram: 12 latest via the web profile API · YouTube: the Shorts tab · TikTok: not listable without login → supported=false).
//   POST { url } → { video } — preview of one pasted link (thumbnail, author, views, posted_at) so the creator sees what they submit.
// Nothing is written. Thumbnails from Instagram / TikTok CDNs are inlined as data: URIs (their CDNs refuse hotlinking / expire).
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const HDR = { 'User-Agent': UA, 'Accept-Language': 'id,en;q=0.8' };

type Video = {
  platform: 'tiktok' | 'instagram' | 'youtube'; url: string; thumb: string | null; caption: string | null;
  author: string | null; views: number | null; likes: number | null; comments: number | null; posted_at: string | null;
};

async function get(url: string, headers: Record<string, string> = HDR) {
  try {
    const r = await fetch(url, { headers, redirect: 'follow', signal: AbortSignal.timeout(12_000) });
    return r.ok ? r : null;
  } catch { return null; }
}
async function inline(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  const r = await get(url, { 'User-Agent': UA });
  if (!r) return null;
  const type = r.headers.get('content-type') ?? 'image/jpeg';
  const buf = new Uint8Array(await r.arrayBuffer());
  if (!type.startsWith('image/') || buf.length > 400_000) return null;
  let s = '';
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return `data:${type};base64,${btoa(s)}`;
}
const num = (src: string, key: string) => { const m = src.match(new RegExp(`"${key}"\\s*:\\s*"?(\\d+)"?`)); return m ? Number(m[1]) : null; };
const iso = (sec: number | null | undefined) => (sec ? new Date(sec * 1000).toISOString() : null);

// ---------- Instagram ----------
// deno-lint-ignore no-explicit-any
type Node = Record<string, any>;
async function igProfile(handle: string): Promise<Node[] | null> {
  const r = await get(`https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(handle)}`, { ...HDR, 'x-ig-app-id': '936619743392459' });
  if (!r) return null;
  const u = (await r.json().catch(() => null))?.data?.user;
  if (!u) return null;
  const seen = new Set<string>();
  return [...(u.edge_owner_to_timeline_media?.edges ?? []), ...(u.edge_felix_video_timeline?.edges ?? [])]
    .map((e: { node: Node }) => e.node).filter((n: Node) => n?.shortcode && !seen.has(n.shortcode) && seen.add(n.shortcode));
}
async function igVideo(n: Node, handle: string): Promise<Video> {
  const small = (n.thumbnail_resources as { src: string; config_width: number }[] | undefined)?.find((t) => t.config_width >= 240)?.src;
  const v = n.video_view_count ?? n.video_play_count ?? null;
  return {
    platform: 'instagram', url: `https://www.instagram.com/${n.is_video ? 'reel' : 'p'}/${n.shortcode}/`,
    thumb: await inline(small ?? n.thumbnail_src ?? n.display_url), caption: n.edge_media_to_caption?.edges?.[0]?.node?.text?.slice(0, 140) ?? null,
    author: handle, views: typeof v === 'number' ? v : null, likes: n.edge_liked_by?.count ?? n.edge_media_preview_like?.count ?? null,
    comments: n.edge_media_to_comment?.count ?? null, posted_at: iso(n.taken_at_timestamp),
  };
}

// ---------- YouTube ----------
function ytViews(text: string | undefined): number | null {
  if (!text) return null;
  const m = text.replace(/\s/g, ' ').match(/([\d.,]+)\s*(rb|ribu|k|jt|juta|m|mil|miliar|b)?/i);
  if (!m) return null;
  const base = Number(m[1]!.replace(/\.(?=\d{3}\b)/g, '').replace(',', '.'));
  const mult: Record<string, number> = { rb: 1e3, ribu: 1e3, k: 1e3, jt: 1e6, juta: 1e6, m: 1e6, mil: 1e9, miliar: 1e9, b: 1e9 };
  return Number.isFinite(base) ? Math.round(base * (mult[(m[2] ?? '').toLowerCase()] ?? 1)) : null;
}
async function ytShorts(handle: string): Promise<Video[] | null> {
  const r = await get(`https://www.youtube.com/@${encodeURIComponent(handle)}/shorts`);
  if (!r) return null;
  const html = await r.text();
  const out: Video[] = [];
  const seen = new Set<string>();
  for (const m of html.matchAll(/"shortsLockupViewModel":\{"entityId":"[^"]*","accessibilityText":"((?:[^"\\]|\\.)*)"[\s\S]{0,900}?"videoId":"([A-Za-z0-9_-]{11})"/g)) {
    const id = m[2]!;
    if (seen.has(id)) continue;
    seen.add(id);
    const acc = m[1]!.replace(/\\u0026/g, '&').replace(/\\"/g, '"');
    const [title, viewsText] = [acc.replace(/,\s*[^,]*$/, ''), acc.match(/,\s*([^,]*?)\s*(x ditonton|views|kali ditonton)/i)?.[1]];
    out.push({ platform: 'youtube', url: `https://www.youtube.com/shorts/${id}`, thumb: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      caption: title.slice(0, 140), author: handle, views: ytViews(viewsText), likes: null, comments: null, posted_at: null });
    if (out.length >= 12) break;
  }
  return out;
}
async function ytOne(url: string): Promise<Video | null> {
  const id = url.match(/(?:youtu\.be\/|[?&]v=|\/shorts\/|\/live\/|\/embed\/)([A-Za-z0-9_-]{11})/)?.[1];
  if (!id) return null;
  const [r, o] = await Promise.all([get(`https://www.youtube.com/watch?v=${id}`), get(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}`)]);
  const oe = o ? await o.json().catch(() => null) : null;
  if (!r && !oe) return null;
  const html = r ? await r.text() : '';
  const block = html.match(/"videoDetails"\s*:\s*\{[\s\S]*?"viewCount"\s*:\s*"\d+"/)?.[0] ?? '';
  const title = block.match(/"title":"((?:[^"\\]|\\.)*)"/)?.[1]?.replace(/\\u0026/g, '&').replace(/\\"/g, '"') ?? null;
  const date = html.match(/"(?:publishDate|uploadDate)":"([^"]+)"/)?.[1] ?? null;
  return { platform: 'youtube', url: /\/shorts\//.test(url) ? `https://www.youtube.com/shorts/${id}` : `https://www.youtube.com/watch?v=${id}`,
    thumb: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`, caption: (title ?? oe?.title ?? null)?.slice(0, 140) ?? null,
    author: html.match(/"ownerProfileUrl":"https?:\/\/www\.youtube\.com\/@([^"]+)"/)?.[1] ?? oe?.author_url?.match(/@([^/?]+)/)?.[1] ?? null,
    views: num(block, 'viewCount'), likes: null, comments: null, posted_at: date ? new Date(date).toISOString() : null };
}

// ---------- TikTok ----------
async function ttOne(url: string): Promise<Video | null> {
  const [o, p] = await Promise.all([get(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`), get(url)]);
  const oe = o ? await o.json().catch(() => null) : null;
  const html = p ? await p.text() : '';
  const stats = html.match(/"stats"\s*:\s*\{[^{}]*"playCount"[^{}]*\}/)?.[0] ?? '';
  const created = num(html.match(/"itemStruct":\{"id":"\d+"[\s\S]{0,400}?"createTime":"?\d+/)?.[0] ?? '', 'createTime');
  if (!oe && !stats) return null;
  return { platform: 'tiktok', url, thumb: await inline(oe?.thumbnail_url), caption: oe?.title?.slice(0, 140) ?? null,
    author: oe?.author_unique_id ?? html.match(/"author":\{[^{}]*?"uniqueId":"([^"]+)"/)?.[1] ?? null,
    views: num(stats, 'playCount'), likes: num(stats, 'diggCount'), comments: num(stats, 'commentCount'), posted_at: iso(created) };
}

async function igOne(url: string, sb: ReturnType<typeof createClient>, uid: string): Promise<Video | null> {
  const code = url.match(/instagram\.com\/(?:[^/]+\/)?(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/)?.[1];
  if (!code) return null;
  // Post pages sit behind the login wall: look for it among the latest posts of the creator's Instagram accounts.
  const { data } = await sb.from('creator_platforms').select('handle').eq('creator_id', uid).eq('platform', 'instagram');
  for (const a of data ?? []) {
    const nodes = await igProfile(String(a.handle).replace(/^@/, ''));
    const n = nodes?.find((x) => x.shortcode === code);
    if (n) return igVideo(n, String(a.handle).replace(/^@/, ''));
  }
  return { platform: 'instagram', url, thumb: null, caption: null, author: null, views: null, likes: null, comments: null, posted_at: null };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const body = await req.json().catch(() => ({})) as { platform_id?: unknown; url?: unknown; platform?: unknown; handle?: unknown };

  // Ops check with the dispatch secret: list any public handle ({ platform, handle }) to confirm the readers still work.
  const secret = req.headers.get('x-dispatch-secret');
  if (secret) {
    const { data: ok } = await sb.rpc('verify_fetch_metrics_secret', { p_secret: secret });
    if (ok !== true) return json(401, { error: 'unauthorized' });
    const h = String(body.handle ?? '').replace(/^@/, '');
    if (body.platform === 'instagram') return json(200, { videos: await Promise.all(((await igProfile(h)) ?? []).slice(0, 3).map((n) => igVideo(n, h))) });
    if (body.platform === 'youtube') return json(200, { videos: (await ytShorts(h)) ?? [] });
    if (typeof body.url === 'string') return json(200, { video: /tiktok\.com/.test(body.url) ? await ttOne(body.url) : await ytOne(body.url) });
    return json(400, { error: 'bad_request' });
  }

  const { data: u } = await sb.auth.getUser((req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, ''));
  if (!u?.user) return json(401, { error: 'unauthorized' });

  if (typeof body.url === 'string') {
    const url = body.url.trim().slice(0, 500);
    if (!/^https:\/\//i.test(url)) return json(400, { error: 'invalid_url' });
    const host = url.match(/^https:\/\/([^/?#]+)/i)?.[1]?.toLowerCase().replace(/^(www\.|m\.)/, '') ?? '';
    const video = host === 'tiktok.com' ? await ttOne(url)
      : host === 'youtube.com' || host === 'youtu.be' ? await ytOne(url)
      : host === 'instagram.com' ? await igOne(url, sb, u.user.id)
      : null;
    return json(200, { video });
  }

  if (typeof body.platform_id !== 'string') return json(400, { error: 'platform_id_required' });
  const { data: acc } = await sb.from('creator_platforms').select('platform, handle, creator_id').eq('id', body.platform_id).maybeSingle();
  if (!acc || acc.creator_id !== u.user.id) return json(404, { error: 'not_found' });
  const handle = String(acc.handle).replace(/^@/, '');
  if (acc.platform === 'instagram') {
    const nodes = await igProfile(handle);
    if (!nodes) return json(200, { supported: true, videos: [], unreadable: true });
    return json(200, { supported: true, videos: await Promise.all(nodes.slice(0, 12).map((n) => igVideo(n, handle))) });
  }
  if (acc.platform === 'youtube') {
    const v = await ytShorts(handle);
    return json(200, { supported: true, videos: v ?? [], unreadable: !v });
  }
  return json(200, { supported: false, videos: [] });
});
