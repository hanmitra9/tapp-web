import { supabase } from '@/lib/supabase';

export type EarningsSummary = { pending: number; available: number; in_payout: number; paid: number };
export type EarningRow = {
  id: string; amount: number; status: 'pending' | 'available' | 'paid' | 'reversed'; qualified_views_delta: number;
  available_at: string; created_at: string; payout_request_id: string | null; campaign: { title: string } | null;
};

export async function fetchEarnings(uid: string): Promise<{ summary: EarningsSummary; rows: EarningRow[]; minPayout: number; holdDays: number }> {
  const [s, r, m] = await Promise.all([
    supabase.from('my_earnings_summary').select('pending, available, in_payout, paid').eq('creator_id', uid).maybeSingle(),
    supabase.from('earnings').select('id, amount, status, qualified_views_delta, available_at, created_at, payout_request_id, campaign:campaigns(title)')
      .order('created_at', { ascending: false }).limit(100),
    supabase.from('app_settings').select('key, value').in('key', ['min_payout_idr', 'earnings_hold_days']),
  ]);
  if (s.error) throw s.error;
  if (r.error) throw r.error;
  const n = (x: unknown) => Number(x ?? 0);
  return {
    summary: { pending: n(s.data?.pending), available: n(s.data?.available), in_payout: n(s.data?.in_payout), paid: n(s.data?.paid) },
    rows: (r.data as unknown as EarningRow[]).map((e) => ({ ...e, amount: n(e.amount), qualified_views_delta: n(e.qualified_views_delta) })),
    minPayout: n(m.data?.find((x) => x.key === 'min_payout_idr')?.value ?? 50000),
    holdDays: n(m.data?.find((x) => x.key === 'earnings_hold_days')?.value ?? 7),
  };
}

// Next date on which held earnings become payable, and how much.
export function nextMaturity(rows: EarningRow[]): { at: string; amount: number } | null {
  const now = Date.now();
  const pending = rows.filter((r) => r.status === 'pending' && r.amount > 0 && new Date(r.available_at).getTime() > now)
    .sort((a, b) => a.available_at.localeCompare(b.available_at));
  const first = pending[0];
  if (!first) return null;
  const day = first.available_at.slice(0, 10);
  return { at: first.available_at, amount: pending.filter((r) => r.available_at.slice(0, 10) === day).reduce((a, r) => a + r.amount, 0) };
}

// Lightweight read for the home balance card.
export async function fetchAvailable(): Promise<number> {
  const { data, error } = await supabase.from('my_earnings_summary').select('available').maybeSingle();
  if (error) throw error;
  return Math.max(Number(data?.available ?? 0), 0);
}
