// web-push — deliver an in-app notification to the user's browsers (Web Push, VAPID).
//   POST { notification_id } with x-dispatch-secret (= Vault "web_push_secret"), sent by the notifications INSERT trigger (0048).
//   → { sent, removed }. Subscriptions the push service reports as gone (404/410) are deleted.
// Deployed with verify_jwt = false: the shared secret is the auth.
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

// Where tapping the notification opens, by type.
function target(type: string, data: Record<string, unknown>): string {
  const campaign = typeof data.campaign_id === 'string' ? data.campaign_id : null;
  switch (type) {
    case 'earnings_update': case 'payout_update': case 'referral': return '/dashboard/earnings';
    case 'campaign_deadline': return campaign ? `/workspace/${campaign}` : '/dashboard/activity';
    case 'submission_approved': case 'submission_rejected': case 'submission_needs_changes': return '/dashboard/activity';
    default: return '/notifications';
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const { data: ok } = await sb.rpc('verify_web_push_secret', { p_secret: req.headers.get('x-dispatch-secret') });
  if (ok !== true) return json(401, { error: 'unauthorized' });

  const body = await req.json().catch(() => ({}));
  const id = typeof body.notification_id === 'string' ? body.notification_id : null;
  if (!id) return json(400, { error: 'notification_id_required' });

  const { data: n } = await sb.from('notifications').select('id, user_id, type, title, body, data').eq('id', id).maybeSingle();
  if (!n) return json(404, { error: 'not_found' });
  const { data: subs } = await sb.from('push_subscriptions').select('id, endpoint, p256dh, auth').eq('user_id', n.user_id);
  if (!subs?.length) return json(200, { sent: 0, removed: 0 });

  const { data: keys } = await sb.rpc('private_vapid_keys');
  if (!keys?.public || !keys?.private) return json(500, { error: 'vapid_not_configured' });
  webpush.setVapidDetails('mailto:tappcreators@gmail.com', keys.public, keys.private);

  const payload = JSON.stringify({ title: n.title, body: n.body, url: target(n.type, (n.data ?? {}) as Record<string, unknown>), tag: n.type, id: n.id });
  let sent = 0; const gone: string[] = [];
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 60 * 60 * 24, urgency: 'normal' });
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) gone.push(s.id);
    }
  }));
  if (gone.length) await sb.from('push_subscriptions').delete().in('id', gone);
  return json(200, { sent, removed: gone.length });
});
