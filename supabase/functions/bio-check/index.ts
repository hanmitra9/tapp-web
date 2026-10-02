// bio-check — "Cek bio": is the creator's TAPP code in the bio of their TikTok / Instagram account?
//   POST { platform_id } with the creator's session JWT.
// Reads the public profile (no login): TikTok profile page, Instagram web profile API with a page fallback.
// found → bio_code_result('found') verifies the account · page read but no code → 'missing' (creator retries)
// · profile not readable (blocked, private, login wall) → 'unreadable' (goes to the admin queue for a manual check).
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

async function get(url: string, headers: Record<string, string> = {}) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'id,en;q=0.8', ...headers }, redirect: 'follow', signal: AbortSignal.timeout(10_000) });
    return { ok: r.ok, status: r.status, text: r.ok ? await r.text() : '' };
  } catch { return { ok: false, status: 0, text: '' }; }
}
// Bio text is JSON-escaped inside the pages; compare on letters and digits only.
const norm = (s: string) => s.toUpperCase().replace(/\\u002d|\\u2010|\\u2011|\\u2012|\\u2013/gi, '-').replace(/[^A-Z0-9]/g, '');

// Returns the bio-ish text we could read, or null when the profile can't be read at all.
async function readTikTok(handle: string): Promise<string | null> {
  const r = await get(`https://www.tiktok.com/@${encodeURIComponent(handle)}`);
  if (!r.ok) return null;
  const m = r.text.match(/"signature":"((?:\\.|[^"\\])*)"/);
  if (m) return m[1];
  return /"uniqueId":"/.test(r.text) ? '' : null;     // page loaded with the user but an empty bio
}
async function readInstagram(handle: string): Promise<string | null> {
  const api = await get(`https://i.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(handle)}`, { 'x-ig-app-id': '936619743392459' });
  if (api.ok) {
    try { const j = JSON.parse(api.text); if (j?.data?.user) return String(j.data.user.biography ?? ''); } catch { /* fall through */ }
  }
  const page = await get(`https://www.instagram.com/${encodeURIComponent(handle)}/`);
  if (!page.ok) return null;
  const m = page.text.match(/"biography":"((?:\\.|[^"\\])*)"/) ?? page.text.match(/<meta property="og:description" content="([^"]*)"/);
  return m ? m[1] : null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const jwt = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: u } = await sb.auth.getUser(jwt);
  if (!u?.user) return json(401, { error: 'unauthorized' });
  const { platform_id } = await req.json().catch(() => ({}));
  if (typeof platform_id !== 'string') return json(400, { error: 'platform_id_required' });

  const { data: row } = await sb.from('creator_platforms').select('id, creator_id, platform, handle, bio_code, bio_checked_at, verified_at').eq('id', platform_id).maybeSingle();
  if (!row || row.creator_id !== u.user.id) return json(404, { error: 'platform_not_found' });
  if (row.verified_at) return json(200, { status: 'verified' });
  if (!row.bio_code) return json(400, { error: 'bio_code_missing' });
  if (row.bio_checked_at && Date.now() - new Date(row.bio_checked_at).getTime() < 20_000) return json(429, { error: 'too_fast' });

  const bio = row.platform === 'tiktok' ? await readTikTok(row.handle) : row.platform === 'instagram' ? await readInstagram(row.handle) : null;
  const result = bio === null ? 'unreadable' : norm(bio).includes(norm(row.bio_code)) ? 'found' : 'missing';
  const note = result === 'unreadable' ? 'Profil tidak bisa dibaca otomatis' : result === 'missing' ? 'Kode belum ada di bio' : null;
  const { data: status, error } = await sb.rpc('bio_code_result', { p_platform_id: row.id, p_result: result, p_note: note });
  if (error) return json(500, { error: 'save_failed' });
  return json(200, { status });
});
