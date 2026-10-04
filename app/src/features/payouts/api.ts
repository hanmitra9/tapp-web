import { supabase } from '@/lib/supabase';

export type PayoutStatus = 'requested' | 'reviewing' | 'approved' | 'processing' | 'paid' | 'rejected';
export type Payout = {
  id: string; amount: number; status: PayoutStatus; payout_method: { kind: string; provider: string; account_name: string; account_number: string };
  review_reason: string | null; processed_reference: string | null; paid_at: string | null; created_at: string; updated_at: string;
  fee?: number; fee_pct?: number; net_amount?: number;   // migration 034
  bonus?: number;   // level bonus added at withdrawal (0045)
};
export const OPEN: PayoutStatus[] = ['requested', 'reviewing', 'approved', 'processing'];

export const PAYOUT_STATUS: Record<PayoutStatus, { label: string; tone: 'neutral' | 'blue' | 'success' | 'danger' }> = {
  requested: { label: 'Diajukan', tone: 'neutral' }, reviewing: { label: 'Ditinjau', tone: 'neutral' },
  approved: { label: 'Disetujui', tone: 'blue' }, processing: { label: 'Diproses', tone: 'blue' },
  paid: { label: 'Dibayar', tone: 'success' }, rejected: { label: 'Ditolak', tone: 'danger' },
};
// Linear progress shown to the creator (rejected is terminal and shown separately).
export const STEPS: PayoutStatus[] = ['requested', 'reviewing', 'approved', 'processing', 'paid'];

// Direct payouts (migration 035): one row per paid clip.
export type Payment = { id: string; submission_id: string | null; amount: number; fee: number; bonus: number; net_amount: number; processed_reference: string | null;
  paid_at: string | null; provider: string | null; account_last4: string | null; post_url: string | null; campaign_id: string | null; campaign_title: string | null };
export async function fetchPayments(): Promise<Payment[]> {
  const { data, error } = await supabase.from('my_payments').select('*').order('paid_at', { ascending: false }).limit(100);
  if (error) throw error;
  return (data ?? []).map((p) => ({ ...p, amount: Number(p.amount), fee: Number(p.fee ?? 0), bonus: Number(p.bonus ?? 0), net_amount: Number(p.net_amount ?? p.amount) })) as Payment[];
}
export const paidTotal = (rows: Payment[]) => rows.reduce((a, p) => a + p.net_amount, 0);

export async function fetchPayouts(): Promise<Payout[]> {
  const { data, error } = await supabase.from('payout_requests')
    .select('*')
    .order('created_at', { ascending: false }).limit(50);
  if (error) throw error;
  return (data as Payout[]).map((p) => ({ ...p, amount: Number(p.amount), fee: Number(p.fee ?? 0), bonus: Number(p.bonus ?? 0), net_amount: Number(p.net_amount ?? p.amount) }));
}

// Withdrawal fee for the creator's current level (app_settings.withdrawal_fee_pct, migration 034): higher level, lower fee.
export const TIER_LABEL: Record<string, string> = { new: 'New', rising: 'Rising', verified: 'Verified', proven: 'Proven', elite: 'Elite' };
export async function fetchWithdrawalFee(uid: string): Promise<{ tier: string; pct: number }> {
  const [c, s] = await Promise.all([
    supabase.from('creator_profiles').select('tier').eq('user_id', uid).single(),
    supabase.from('app_settings').select('value').eq('key', 'withdrawal_fee_pct').maybeSingle(),
  ]);
  const tier = (c.data?.tier as string | undefined) ?? 'new';
  const table = (s.data?.value ?? {}) as Record<string, number>;
  return { tier, pct: Number(table[tier] ?? 0) };
}

// Withdrawal terms (0045/0046): platform fee % + flat transfer fee per withdrawal, level bonus on top, minimum balance.
export type WithdrawTerms = { tier: string; bonusPct: number; feePct: number; fee: number; min: number };
export async function fetchWithdrawTerms(uid: string): Promise<WithdrawTerms> {
  const [c, s] = await Promise.all([
    supabase.from('creator_profiles').select('tier').eq('user_id', uid).single(),
    supabase.from('app_settings').select('key, value').in('key', ['tier_bonus_pct', 'withdrawal_fee_idr', 'min_payout_idr', 'creator_fee_pct']),
  ]);
  const tier = (c.data?.tier as string | undefined) ?? 'new';
  const v = (k: string) => s.data?.find((x) => x.key === k)?.value;
  const bonus = (v('tier_bonus_pct') ?? {}) as Record<string, number>;
  return { tier, bonusPct: Number(bonus[tier] ?? 0), feePct: Number(v('creator_fee_pct') ?? 0), fee: Number(v('withdrawal_fee_idr') ?? 10000), min: Number(v('min_payout_idr') ?? 100000) };
}

export async function requestPayout(idempotencyKey: string): Promise<Payout> {
  const { data, error } = await supabase.rpc('request_payout', { p_idempotency_key: idempotencyKey });
  if (error) throw error;
  return { ...(data as Payout), amount: Number((data as Payout).amount) };
}

// RFC4122 v4. Only used as an idempotency key, so Math.random is sufficient.
export const uuid = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
  const r = (Math.random() * 16) | 0; return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
});
