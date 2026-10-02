import type { SubmissionStatus } from './api';

type Tone = 'neutral' | 'blue' | 'success' | 'warning' | 'danger';
export const SUBMISSION_STATUS: Record<SubmissionStatus, { label: string; tone: Tone; note: string }> = {
  pending_review: { label: 'Menunggu review', tone: 'neutral', note: 'Tim TAPP sedang memeriksa postinganmu.' },
  needs_changes: { label: 'Perlu revisi', tone: 'warning', note: 'Perbaiki sesuai catatan, lalu kirim ulang.' },
  approved: { label: 'Diterima', tone: 'blue', note: 'Klipmu diterima. Tim TAPP akan mentransfer bayaranmu.' },
  tracking: { label: 'Diterima', tone: 'blue', note: 'Klipmu diterima. Tim TAPP akan mentransfer bayaranmu.' },
  flagged: { label: 'Ditandai', tone: 'warning', note: 'Sedang diperiksa ulang oleh tim TAPP.' },
  rejected: { label: 'Ditolak', tone: 'danger', note: 'Submission ini tidak dihitung.' },
  completed: { label: 'Dibayar', tone: 'success', note: 'Bayaran klip ini sudah ditransfer ke rekeningmu.' },
};
