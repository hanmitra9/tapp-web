import { supabase } from '@/lib/supabase';

export type TicketCategory = 'account' | 'campaign' | 'submission' | 'earnings' | 'payout' | 'other';
export type Ticket = { id: string; category: TicketCategory; subject: string; body: string; status: 'open' | 'pending' | 'resolved' | 'closed';
  admin_reply: string | null; replied_at: string | null; created_at: string };
export type Dispute = { id: string; submission_id: string | null; payout_request_id: string | null; reason: string;
  status: 'open' | 'under_review' | 'resolved' | 'rejected'; resolution: string | null; created_at: string };

export const CATEGORIES: { value: TicketCategory; label: string }[] = [
  { value: 'account', label: 'Akun' }, { value: 'campaign', label: 'Campaign' }, { value: 'submission', label: 'Submission' },
  { value: 'earnings', label: 'Penghasilan' }, { value: 'payout', label: 'Pencairan' }, { value: 'other', label: 'Lainnya' },
];
export const TICKET_STATUS = { open: 'Terkirim', pending: 'Menunggu balasanmu', resolved: 'Selesai', closed: 'Ditutup' } as const;
export const DISPUTE_STATUS = { open: 'Terkirim', under_review: 'Ditinjau', resolved: 'Diterima', rejected: 'Ditolak' } as const;

export async function fetchHelp(): Promise<{ tickets: Ticket[]; disputes: Dispute[] }> {
  const [t, d] = await Promise.all([
    supabase.from('support_tickets').select('id, category, subject, body, status, admin_reply, replied_at, created_at').order('created_at', { ascending: false }).limit(50),
    supabase.from('disputes').select('id, submission_id, payout_request_id, reason, status, resolution, created_at').order('created_at', { ascending: false }).limit(50),
  ]);
  if (t.error) throw t.error;
  if (d.error) throw d.error;
  return { tickets: t.data as Ticket[], disputes: d.data as Dispute[] };
}

export async function createTicket(uid: string, v: { category: TicketCategory; subject: string; body: string }) {
  const { error } = await supabase.from('support_tickets').insert({ user_id: uid, category: v.category, subject: v.subject.trim(), body: v.body.trim() });
  if (error) throw error;
}

export async function createDispute(uid: string, target: { submissionId?: string; payoutId?: string }, reason: string) {
  const { error } = await supabase.from('disputes').insert({
    raised_by: uid, submission_id: target.submissionId ?? null, payout_request_id: target.payoutId ?? null, reason: reason.trim(),
  });
  if (error) throw error;
}
