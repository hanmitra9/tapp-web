import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

// Creator referral (0048). Invite link: <site>/register?ref=CODE. The code is kept in this browser until the new
// account exists, then claimed once (claim_referral ignores codes that can't apply).
const KEY = 'tapp:ref';
const store = () => { try { return Platform.OS === 'web' ? globalThis.localStorage ?? null : null; } catch { return null; } };

// Runs at startup: remember ?ref=CODE from the URL.
export function captureReferral() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  const code = new URLSearchParams(window.location.search).get('ref');
  if (code && /^[A-Za-z0-9]{6,12}$/.test(code)) { try { store()?.setItem(KEY, code.toUpperCase()); } catch { /* storage off */ } }
}

// Runs once a creator account is loaded.
export async function claimPendingReferral() {
  let code: string | null = null;
  try { code = store()?.getItem(KEY) ?? null; } catch { code = null; }
  if (!code) return;
  const { error } = await supabase.rpc('claim_referral', { p_code: code });
  if (!error) { try { store()?.removeItem(KEY); } catch { /* storage off */ } }
}

export type Referral = {
  code: string; bonus: number; invited: number; rewarded: number; available: number; earned: number;
  friends: { name: string; joined_at: string; rewarded: boolean }[];
};
export async function fetchReferral(): Promise<Referral> {
  const { data, error } = await supabase.rpc('my_referral');
  if (error) throw error;
  const d = data as Referral;
  return { ...d, bonus: Number(d.bonus), invited: Number(d.invited), rewarded: Number(d.rewarded), available: Number(d.available), earned: Number(d.earned), friends: d.friends ?? [] };
}

export const inviteLink = (code: string) => {
  const site = (process.env.EXPO_PUBLIC_SITE_URL ?? 'https://tappcreators.com').replace(/\/$/, '');
  return `${site}/register?ref=${code}`;
};
