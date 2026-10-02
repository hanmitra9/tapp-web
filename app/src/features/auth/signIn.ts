import { createClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

type Result = { ok: true; needsCode: boolean } | { ok: false; error: unknown };

// Is email verification required at every sign-in? (switch lives in app_settings.require_login_otp)
async function loginNeedsCode(): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('login_policy');
    if (error) return false;
    return !!(data as { require_login_otp?: boolean } | null)?.require_login_otp;
  } catch { return false; }
}

// Two-step sign-in: check the password on a throwaway client (its session is discarded, the app never sees it),
// then email a one-time code. Only the session created from that code is accepted by the API.
export async function signIn(email: string, password: string): Promise<Result> {
  if (!(await loginNeedsCode())) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? { ok: false, error } : { ok: true, needsCode: false };
  }
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL!, key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
  const probe = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'tapp-probe' } });
  const { error } = await probe.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error };
  await probe.auth.signOut({ scope: 'local' }).catch(() => {});
  const sent = await sendLoginCode(email);
  return sent ? { ok: false, error: sent } : { ok: true, needsCode: true };
}

export async function sendLoginCode(email: string): Promise<unknown | null> {
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
  return error ?? null;
}
