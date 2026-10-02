// fetch-metrics — records views for approved submissions:
//   YouTube: public YouTube Data API (YOUTUBE_API_KEY function secret).
//   TikTok:  the creator's own connected account (tiktok-oauth), Display API video/query
//            (TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET for refreshing tokens).
//   Instagram: the creator's own connected professional account (instagram-oauth), media insights; the
//            60-day token is refreshed here before it lapses.
// Invoked by the fetch-metrics-sweep cron (every 3h). Auth: x-dispatch-secret header, checked against
// Supabase Vault via a service-role-only RPC.
// Writes raw metrics only (record_api_metrics); the auto-qualify sweep / an admin turns them into qualified views.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

type Due = { submission_id: string; video_id: string; last_views: number | null };
type TtDue = Due & { connection_id: string };
type TtVideo = { id: string; view_count?: number; like_count?: number; comment_count?: number; share_count?: number };
type Token = { access_token: string | null; refresh_token: string | null; expires_at: string | null };
type Sb = SupabaseClient;
type IgDue = { submission_id: string; connection_id: string; shortcode: string; last_views: number | null };
type IgMedia = { id: string; permalink?: string; like_count?: number; comments_count?: number };
type Video = { id: string; statistics?: { viewCount?: string; likeCount?: string; commentCount?: string }; status?: { privacyStatus?: string } };

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const num = (v: string | undefined) => (v ? Number(v) : 0);

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

  const { data: ok } = await sb.rpc('verify_fetch_metrics_secret', { p_secret: req.headers.get('x-dispatch-secret') ?? '' });
  if (ok !== true) return json(401, { error: 'unauthorized' });

  const [youtube, tiktok, instagram] = await Promise.all([runYoutube(sb), runTiktok(sb), runInstagram(sb)]);
  return json(200, { youtube, tiktok, instagram });
});

async function runYoutube(sb: Sb) {
  const key = Deno.env.get('YOUTUBE_API_KEY');
  if (!key) return { skipped: 'no_api_key' };

  const { data, error } = await sb.rpc('due_for_youtube_metrics', { p_min_interval_minutes: 170, p_limit: 500 });
  if (error) return { error: error.message };
  const due = (data ?? []) as Due[];
  if (!due.length) return { checked: 0 };
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
  return { checked: due.length, recorded, hidden, failures: failures.slice(0, 20) };
}

// TikTok only returns stats for the connected user's own videos, so work is grouped per connection.
async function runTiktok(sb: Sb) {
  const key = Deno.env.get('TIKTOK_CLIENT_KEY'), secret = Deno.env.get('TIKTOK_CLIENT_SECRET');
  if (!key || !secret) return { skipped: 'not_configured' };
  const { data, error } = await sb.rpc('due_for_tiktok_metrics', { p_min_interval_minutes: 170, p_limit: 500 });
  if (error) return { error: error.message };
  const due = (data ?? []) as TtDue[];
  if (!due.length) return { checked: 0 };

  const byConn = new Map<string, TtDue[]>();
  for (const d of due) byConn.set(d.connection_id, [...(byConn.get(d.connection_id) ?? []), d]);
  let recorded = 0, hidden = 0;
  const failures: string[] = [];

  for (const [connId, items] of byConn) {
    const access = await tiktokToken(sb, connId, key, secret);
    if (!access) { failures.push(`${connId}: token`); continue; }
    // video/query takes up to 20 ids per call.
    for (let i = 0; i < items.length; i += 20) {
      const chunk = items.slice(i, i + 20);
      const res = await fetch('https://open.tiktokapis.com/v2/video/query/?fields=id,view_count,like_count,comment_count,share_count', {
        method: 'POST',
        headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ filters: { video_ids: [...new Set(chunk.map((d) => d.video_id))] } }),
      });
      if (res.status === 401) { await sb.rpc('mark_platform_connection_error', { p_connection_id: connId, p_error: 'tiktok_401' }); break; }
      if (!res.ok) { failures.push(`tiktok_${res.status}`); continue; }
      const body = (await res.json()) as { data?: { videos?: TtVideo[] } };
      const byId = new Map((body.data?.videos ?? []).map((v) => [String(v.id), v]));
      for (const d of chunk) {
        // Not returned: deleted, made private, or no longer on this account. Keep the last known views and let
        // record_api_metrics flag it for a check.
        const v = byId.get(d.video_id);
        const r = await sb.rpc('record_api_metrics', {
          p_submission_id: d.submission_id,
          p_views: v ? v.view_count ?? 0 : (d.last_views ?? 0),
          p_likes: v?.like_count ?? 0, p_comments: v?.comment_count ?? 0, p_shares: v?.share_count ?? 0,
          p_content_state: v ? 'live' : 'deleted',
          p_raw: { source: 'tiktok_display_api_v2', video_id: d.video_id, found: !!v },
        });
        if (r.error) failures.push(`${d.submission_id}: ${r.error.message}`);
        else if (v) recorded++; else hidden++;
      }
    }
  }
  return { checked: due.length, recorded, hidden, failures: failures.slice(0, 20) };
}

// Access token for a connection, refreshed first when it expires within 5 minutes. null = reconnect needed
// (the connection is marked and the creator notified).
async function tiktokToken(sb: Sb, connId: string, key: string, secret: string): Promise<string | null> {
  const { data } = await sb.rpc('get_platform_token', { p_connection_id: connId });
  const t = ((data ?? []) as Token[])[0];
  if (!t?.access_token) return null;
  if (t.expires_at && new Date(t.expires_at).getTime() > Date.now() + 5 * 60_000) return t.access_token;
  if (!t.refresh_token) { await sb.rpc('mark_platform_connection_error', { p_connection_id: connId, p_error: 'no_refresh_token' }); return null; }
  const res = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_key: key, client_secret: secret, grant_type: 'refresh_token', refresh_token: t.refresh_token }),
  });
  const tok = (await res.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string; expires_in?: number; error?: string };
  if (!tok.access_token) {
    await sb.rpc('mark_platform_connection_error', { p_connection_id: connId, p_error: `tiktok_refresh: ${tok.error ?? res.status}` });
    return null;
  }
  await sb.rpc('update_platform_token', {
    p_connection_id: connId, p_access_token: tok.access_token, p_refresh_token: tok.refresh_token ?? null, p_expires_in_seconds: tok.expires_in ?? 86400,
  });
  return tok.access_token;
}

// ── Instagram ──
const GRAPH = 'https://graph.instagram.com';
const shortcodeOf = (permalink?: string) => permalink?.match(/instagram\.com\/(?:[^/]+\/)?(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/)?.[1];

async function runInstagram(sb: Sb) {
  if (!Deno.env.get('INSTAGRAM_APP_ID') || !Deno.env.get('INSTAGRAM_APP_SECRET')) return { skipped: 'not_configured' };
  const { data, error } = await sb.rpc('due_for_instagram_metrics', { p_min_interval_minutes: 170, p_limit: 500 });
  if (error) return { error: error.message };
  const due = (data ?? []) as IgDue[];
  if (!due.length) return { checked: 0 };

  const byConn = new Map<string, IgDue[]>();
  for (const d of due) byConn.set(d.connection_id, [...(byConn.get(d.connection_id) ?? []), d]);
  let recorded = 0, hidden = 0;
  const failures: string[] = [];

  for (const [connId, items] of byConn) {
    const token = await instagramToken(sb, connId);
    if (!token) { failures.push(`${connId}: token`); continue; }
    // The account's recent media (newest first), matched to submissions by shortcode. Up to 5 pages × 100.
    const media = new Map<string, IgMedia>();
    let next: string | null = `${GRAPH}/me/media?` + new URLSearchParams({ fields: 'id,permalink,like_count,comments_count', limit: '100', access_token: token });
    for (let page = 0; next && page < 5 && items.some((d) => !media.has(d.shortcode)); page++) {
      const res: Response = await fetch(next);
      if (!res.ok) {
        // OAuthException 190 = token expired or consent withdrawn: the creator must reconnect.
        const e = (await res.json().catch(() => ({}))) as { error?: { code?: number } };
        if (res.status === 401 || e.error?.code === 190) await sb.rpc('mark_platform_connection_error', { p_connection_id: connId, p_error: 'instagram_token_invalid' });
        else failures.push(`instagram_media_${res.status}`);
        next = null; break;
      }
      const body = (await res.json()) as { data?: IgMedia[]; paging?: { next?: string } };
      for (const m of body.data ?? []) { const sc = shortcodeOf(m.permalink); if (sc) media.set(sc, m); }
      next = body.paging?.next ?? null;
    }
    for (const d of items) {
      const m = media.get(d.shortcode);
      let views = d.last_views ?? 0, likes = 0, comments = 0, shares = 0, saves = 0;
      if (m) {
        const ins = await fetch(`${GRAPH}/${m.id}/insights?` + new URLSearchParams({ metric: 'views,likes,comments,shares,saved', access_token: token }));
        if (!ins.ok) { failures.push(`${d.submission_id}: insights_${ins.status}`); continue; }
        const body = (await ins.json()) as { data?: { name: string; values?: { value: number }[]; total_value?: { value: number } }[] };
        const val = (n: string) => { const x = body.data?.find((i) => i.name === n); return Number(x?.total_value?.value ?? x?.values?.[0]?.value ?? 0); };
        views = val('views'); likes = val('likes') || (m.like_count ?? 0); comments = val('comments') || (m.comments_count ?? 0);
        shares = val('shares'); saves = val('saved');
      }
      // Not on the account (deleted, archived, or someone else's post): keep the last known views and flag it.
      const r = await sb.rpc('record_api_metrics', {
        p_submission_id: d.submission_id, p_views: views, p_likes: likes, p_comments: comments, p_shares: shares, p_saves: saves,
        p_content_state: m ? 'live' : 'deleted', p_raw: { source: 'instagram_graph', media_id: m?.id ?? null, shortcode: d.shortcode, found: !!m },
      });
      if (r.error) failures.push(`${d.submission_id}: ${r.error.message}`);
      else if (m) recorded++; else hidden++;
    }
  }
  return { checked: due.length, recorded, hidden, failures: failures.slice(0, 20) };
}

// Long-lived token, refreshed when it has under 7 days left (Instagram allows refresh once it is 24h old).
async function instagramToken(sb: Sb, connId: string): Promise<string | null> {
  const { data } = await sb.rpc('get_platform_token', { p_connection_id: connId });
  const t = ((data ?? []) as Token[])[0];
  if (!t?.access_token) return null;
  const left = t.expires_at ? new Date(t.expires_at).getTime() - Date.now() : 0;
  if (left > 7 * 86400_000) return t.access_token;
  const res = await fetch(`${GRAPH}/refresh_access_token?` + new URLSearchParams({ grant_type: 'ig_refresh_token', access_token: t.access_token }));
  const tok = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number };
  if (tok.access_token) {
    await sb.rpc('update_platform_token', { p_connection_id: connId, p_access_token: tok.access_token, p_refresh_token: null, p_expires_in_seconds: tok.expires_in ?? 5184000 });
    return tok.access_token;
  }
  if (left > 0) return t.access_token;   // refresh refused but still valid: use it, try again next sweep
  await sb.rpc('mark_platform_connection_error', { p_connection_id: connId, p_error: `instagram_refresh: ${res.status}` });
  return null;
}
