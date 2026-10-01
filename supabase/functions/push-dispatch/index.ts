// push-dispatch — sends queued TAPP notifications as Expo push messages.
// Invoked by the notifications INSERT trigger (pg_net) and a cron sweep. Auth: x-dispatch-secret header,
// checked against Supabase Vault via a service-role-only RPC. The function never trusts the request body.
import { createClient } from 'npm:@supabase/supabase-js@2';

type Notification = { id: string; user_id: string; type: string; title: string; body: string; data: Record<string, unknown> };
type Ticket = { status: 'ok' | 'error'; id?: string; message?: string; details?: { error?: string } };

const EXPO_URL = 'https://exp.host/--/api/v2/push/send';
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

  const { data: ok } = await sb.rpc('verify_push_secret', { p_secret: req.headers.get('x-dispatch-secret') ?? '' });
  if (ok !== true) return json(401, { error: 'unauthorized' });

  const { data: batch, error } = await sb.rpc('claim_push_batch', { p_limit: 200 });
  if (error) return json(500, { error: error.message });
  const notes = (batch ?? []) as Notification[];
  if (!notes.length) return json(200, { sent: 0 });

  const userIds = [...new Set(notes.map((n) => n.user_id))];
  const { data: tokens, error: tErr } = await sb.from('push_tokens').select('token, user_id').in('user_id', userIds);
  if (tErr) {
    await sb.from('notifications').update({ push_error: `tokens: ${tErr.message}` }).in('id', notes.map((n) => n.id));
    return json(500, { error: tErr.message });
  }
  const byUser = new Map<string, string[]>();
  for (const t of tokens ?? []) byUser.set(t.user_id, [...(byUser.get(t.user_id) ?? []), t.token]);

  const messages: { to: string; title: string; body: string; data: Record<string, unknown>; sound: 'default'; channelId: string; noteId: string }[] = [];
  const noDevice: string[] = [];
  for (const n of notes) {
    const list = byUser.get(n.user_id);
    if (!list?.length) { noDevice.push(n.id); continue; }
    for (const to of list) messages.push({ to, title: n.title, body: n.body, data: { ...n.data, type: n.type, notification_id: n.id }, sound: 'default', channelId: 'default', noteId: n.id });
  }
  if (noDevice.length) await sb.from('notifications').update({ push_error: 'no_device' }).in('id', noDevice);

  const deadTokens: string[] = [];
  const failed = new Map<string, string>();   // permanent (Expo rejected the message)
  const retry = new Set<string>();             // transient (network / Expo outage): unclaim for the next sweep
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    try {
      const res = await fetch(EXPO_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(chunk.map(({ noteId: _n, ...m }) => m)),
      });
      const out = await res.json() as { data?: Ticket[]; errors?: { message: string }[] };
      if (!res.ok || !out.data) { chunk.forEach((m) => retry.add(m.noteId)); continue; }
      out.data.forEach((t, j) => {
        const m = chunk[j]!;
        if (t.status === 'error') {
          if (t.details?.error === 'DeviceNotRegistered') deadTokens.push(m.to);
          else failed.set(m.noteId, t.details?.error ?? t.message ?? 'expo_error');
        }
      });
    } catch { chunk.forEach((m) => retry.add(m.noteId)); }
  }
  if (deadTokens.length) await sb.from('push_tokens').delete().in('token', deadTokens);
  for (const [id, msg] of failed) await sb.from('notifications').update({ push_error: msg.slice(0, 300) }).eq('id', id);
  const retryIds = [...retry].filter((id) => !failed.has(id));
  if (retryIds.length) await sb.from('notifications').update({ push_sent_at: null }).in('id', retryIds);

  return json(200, { notifications: notes.length, messages: messages.length, no_device: noDevice.length, failed: failed.size, retry: retryIds.length, removed_tokens: deadTokens.length });
});
