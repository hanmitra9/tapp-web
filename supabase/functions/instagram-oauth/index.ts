// instagram-oauth — "Hubungkan dengan Instagram" (Instagram API with Instagram Login), entirely server-side.
//   POST (Authorization: the creator's session JWT) → { url } to send the browser to Instagram
//   GET  ?code&state (Instagram's redirect)           → exchanges the code, swaps it for a 60-day token, reads the
//        account, calls oauth_complete_instagram() (verifies the account, token to Vault), redirects back.
// Same contract as tiktok-oauth: verify_jwt = false, POST checks the user, GET is bound to a one-time state.
// Secrets: INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET, SITE_URL. Off unless platform_oauth_config.instagram.enabled.
import { createClient } from 'npm:@supabase/supabase-js@2';

const SITE = (Deno.env.get('SITE_URL') ?? '').replace(/\/+$/, '');
const APP_ID = Deno.env.get('INSTAGRAM_APP_ID') ?? '';
const SECRET = Deno.env.get('INSTAGRAM_APP_SECRET') ?? '';
const GRAPH = 'https://graph.instagram.com';
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const back = (q: Record<string, string>) => Response.redirect(`${SITE}/profile/socials?${new URLSearchParams(q)}`, 302);

type Config = { enabled?: boolean; scopes?: string[]; redirect_uri?: string };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const { data: setting } = await sb.from('app_settings').select('value').eq('key', 'platform_oauth_config').maybeSingle();
  const cfg = ((setting?.value as Record<string, Config> | null)?.instagram ?? {}) as Config;
  const configured = cfg.enabled === true && !!APP_ID && !!SECRET && !!cfg.redirect_uri && !!SITE;

  if (req.method === 'POST') {
    if (!configured) return json(503, { error: 'not_configured' });
    const jwt = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
    const { data: u } = await sb.auth.getUser(jwt);
    if (!u?.user) return json(401, { error: 'unauthorized' });
    const state = crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', '');
    const { error } = await sb.from('oauth_states').insert({ state, user_id: u.user.id, platform: 'instagram' });
    if (error) return json(500, { error: 'state_failed' });
    const url = 'https://www.instagram.com/oauth/authorize?' + new URLSearchParams({
      client_id: APP_ID, redirect_uri: cfg.redirect_uri!, response_type: 'code', state,
      scope: (cfg.scopes ?? ['instagram_business_basic']).join(','),
    });
    return json(200, { url });
  }

  if (req.method !== 'GET') return json(405, { error: 'method_not_allowed' });
  if (!SITE) return json(503, { error: 'not_configured' });
  const p = new URL(req.url).searchParams;
  const state = p.get('state') ?? '';
  const { data: row } = state
    ? await sb.from('oauth_states').delete().eq('state', state).eq('platform', 'instagram').select('user_id, created_at').maybeSingle()
    : { data: null };
  if (!row || Date.now() - new Date(row.created_at).getTime() > 10 * 60_000) return back({ instagram: 'error', reason: 'expired' });
  if (p.get('error') || !p.get('code')) return back({ instagram: 'error', reason: p.get('error') === 'access_denied' ? 'cancelled' : 'denied' });
  if (!configured) return back({ instagram: 'error', reason: 'not_configured' });

  try {
    // 1. code → short-lived token (the response is either flat or wrapped in data[0])
    const res = await fetch('https://api.instagram.com/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: APP_ID, client_secret: SECRET, grant_type: 'authorization_code', redirect_uri: cfg.redirect_uri!, code: p.get('code')!.replace(/#_$/, '') }),
    });
    const raw = await res.json() as { access_token?: string; user_id?: string | number; permissions?: string | string[]; data?: { access_token?: string; user_id?: string | number; permissions?: string | string[] }[] };
    const short = raw.data?.[0] ?? raw;
    if (!short.access_token) return back({ instagram: 'error', reason: 'token' });

    // 2. short-lived → long-lived (60 days)
    const llRes = await fetch(`${GRAPH}/access_token?` + new URLSearchParams({ grant_type: 'ig_exchange_token', client_secret: SECRET, access_token: short.access_token }));
    const ll = await llRes.json() as { access_token?: string; expires_in?: number };
    const token = ll.access_token ?? short.access_token;

    // 3. the account
    const meRes = await fetch(`${GRAPH}/me?` + new URLSearchParams({ fields: 'user_id,username,followers_count,account_type', access_token: token }));
    const me = await meRes.json() as { user_id?: string | number; id?: string; username?: string; followers_count?: number };
    if (!me.username) return back({ instagram: 'error', reason: 'profile' });
    const perms = Array.isArray(short.permissions) ? short.permissions : String(short.permissions ?? '').split(',').filter(Boolean);

    const { error } = await sb.rpc('oauth_complete_instagram', {
      p_creator: row.user_id, p_ig_user_id: String(me.user_id ?? short.user_id ?? me.id), p_username: me.username,
      p_followers: typeof me.followers_count === 'number' ? me.followers_count : null,
      p_access_token: token, p_expires_in: ll.expires_in ?? 3600, p_scopes: perms,
    });
    if (error) {
      const reason = /instagram_account_taken/.test(error.message) ? 'taken' : /creator_profile_not_found/.test(error.message) ? 'no_profile' : 'save';
      return back({ instagram: 'error', reason });
    }
    return back({ instagram: 'connected', handle: me.username });
  } catch {
    return back({ instagram: 'error', reason: 'network' });
  }
});
