import type { SubmissionStatus } from './api';

type Tone = 'neutral' | 'blue' | 'success' | 'warning' | 'danger';
export const SUBMISSION_STATUS: Record<SubmissionStatus, { label: string; tone: Tone; note: string }> = {
  pending_review: { label: 'Menunggu review', tone: 'neutral', note: 'Tim TAPP sedang memeriksa postinganmu.' },
  needs_changes: { label: 'Perlu revisi', tone: 'warning', note: 'Perbaiki sesuai catatan, lalu kirim ulang.' },
  approved: { label: 'Disetujui', tone: 'blue', note: 'Views akan mulai dilacak.' },
  tracking: { label: 'Dilacak', tone: 'blue', note: 'Views sedang dilacak dan dihitung.' },
  flagged: { label: 'Ditandai', tone: 'warning', note: 'Sedang diperiksa ulang oleh tim TAPP.' },
  rejected: { label: 'Ditolak', tone: 'danger', note: 'Submission ini tidak dihitung.' },
  completed: { label: 'Selesai', tone: 'success', note: 'Pelacakan selesai.' },
};
