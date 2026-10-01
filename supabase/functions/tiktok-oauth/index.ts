// tiktok-oauth — "Hubungkan dengan TikTok" (Login Kit v2), entirely server-side.
//   POST (Authorization: the creator's session JWT) → { url } to send the browser to TikTok
//   GET  ?code&state (TikTok's redirect)             → exchanges the code, reads the account, calls
//        oauth_complete_tiktok() (verifies the account, stores tokens in Vault), redirects back to the site.
// Deployed with verify_jwt = false because TikTok's redirect carries no JWT; POST checks the user itself and
// GET is bound to a one-time state created by that POST.
// Secrets: TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET, SITE_URL. Off unless app_settings.platform_oauth_config.tiktok.enabled.
import { createClient } from 'npm:@supabase/supabase-js@2';

const SITE = (Deno.env.get('SITE_URL') ?? '').replace(/\/+$/, '');
const KEY = Deno.env.get('TIKTOK_CLIENT_KEY') ?? '';
const SECRET = Deno.env.get('TIKTOK_CLIENT_SECRET') ?? '';
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const back = (q: Record<string, string>) =>
  Response.redirect(`${SITE}/profile/socials?${new URLSearchParams(q)}`, 302);

type Config = { enabled?: boolean; scopes?: string[]; redirect_uri?: string };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const { data: setting } = await sb.from('app_settings').select('value').eq('key', 'platform_oauth_config').maybeSingle();
  const cfg = ((setting?.value as Record<string, Config> | null)?.tiktok ?? {}) as Config;
  const configured = cfg.enabled === true && !!KEY && !!SECRET && !!cfg.redirect_uri && !!SITE;

  if (req.method === 'POST') {
    if (!configured) return json(503, { error: 'not_configured' });
    const jwt = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
    const { data: u } = await sb.auth.getUser(jwt);
    if (!u?.user) return json(401, { error: 'unauthorized' });
    const state = crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', '');
    const { error } = await sb.from('oauth_states').insert({ state, user_id: u.user.id, platform: 'tiktok' });
    if (error) return json(500, { error: 'state_failed' });
    const url = 'https://www.tiktok.com/v2/auth/authorize/?' + new URLSearchParams({
      client_key: KEY, response_type: 'code', scope: (cfg.scopes ?? ['user.info.basic']).join(','),
      redirect_uri: cfg.redirect_uri!, state,
    });
    return json(200, { url });
  }

  if (req.method !== 'GET') return json(405, { error: 'method_not_allowed' });
  if (!SITE) return json(503, { error: 'not_configured' });
  const p = new URL(req.url).searchParams;
  const state = p.get('state') ?? '';
  // One-time: delete as we read, and only accept states younger than 10 minutes.
  const { data: row } = state
    ? await sb.from('oauth_states').delete().eq('state', state).eq('platform', 'tiktok').select('user_id, created_at').maybeSingle()
    : { data: null };
  if (!row || Date.now() - new Date(row.created_at).getTime() > 10 * 60_000) return back({ tiktok: 'error', reason: 'expired' });
  if (p.get('error') || !p.get('code')) return back({ tiktok: 'error', reason: p.get('error') === 'access_denied' ? 'cancelled' : 'denied' });
  if (!configured) return back({ tiktok: 'error', reason: 'not_configured' });

  try {
    const tokRes = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_key: KEY, client_secret: SECRET, code: p.get('code')!, grant_type: 'authorization_code', redirect_uri: cfg.redirect_uri! }),
    });
    const tok = await tokRes.json() as { access_token?: string; refresh_token?: string; expires_in?: number; open_id?: string; scope?: string; error?: string };
    if (!tok.access_token || !tok.open_id) return back({ tiktok: 'error', reason: 'token' });

    const infoRes = await fetch('https://open.tiktokapis.com/v2/user/info/?fields=open_id,username,display_name,follower_count', {
      headers: { Authorization: `Bearer ${tok.access_token}` },
    });
    const info = await infoRes.json() as { data?: { user?: { username?: string; follower_count?: number } } };
    const user = info.data?.user;
    if (!user?.username) return back({ tiktok: 'error', reason: 'profile' });

    const { error } = await sb.rpc('oauth_complete_tiktok', {
      p_creator: row.user_id, p_open_id: tok.open_id, p_username: user.username,
      p_followers: typeof user.follower_count === 'number' ? user.follower_count : null,
      p_access_token: tok.access_token, p_refresh_token: tok.refresh_token ?? null, p_expires_in: tok.expires_in ?? 86400,
      p_scopes: (tok.scope ?? '').split(',').filter(Boolean),
    });
    if (error) {
      const reason = /tiktok_account_taken/.test(error.message) ? 'taken' : /creator_profile_not_found/.test(error.message) ? 'no_profile' : 'save';
      return back({ tiktok: 'error', reason });
    }
    return back({ tiktok: 'connected', handle: user.username });
  } catch {
    return back({ tiktok: 'error', reason: 'network' });
  }
});
