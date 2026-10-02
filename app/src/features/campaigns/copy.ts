import { CONTENT_CATEGORIES, labelOf, NICHES, platformLabel, type Platform } from '@/features/creator/options';
import type { CampaignDetail } from './api';

// Campaign types (admin picks one). Older campaigns may carry a niche slug, so fall back to the niche label.
const CAMPAIGN_TYPES: Record<string, string> = {
  entertainment: 'Entertainment', brand: 'Brand', music: 'Music', podcast: 'Podcast', gaming: 'Gaming',
  sports: 'Sports', lifestyle: 'Lifestyle', education: 'Education', other: 'Lainnya',
};
export const categoryLabel = (c: string) => CAMPAIGN_TYPES[c] ?? labelOf(NICHES, c);
export const CAMPAIGN_TYPE_OPTIONS = Object.entries(CAMPAIGN_TYPES).map(([value, label]) => ({ value, label }));
export const contentTypeLabel = (c: string) => labelOf(CONTENT_CATEGORIES, c);
export const platformsLabel = (ps: Platform[]) => ps.map(platformLabel).join(' · ');

export const CAMPAIGN_STATUS: Record<CampaignDetail['status'], string> = {
  draft: 'Draf', pending_approval: 'Menunggu persetujuan', active: 'Aktif', paused: 'Dijeda',
  ending: 'Segera berakhir', completed: 'Selesai', archived: 'Diarsipkan', cancelled: 'Dibatalkan',
};

// join_block codes from get_campaign → what the CTA says and what it does.
export function joinBlockCopy(code: string | null): { label: string; note: string | null; action?: 'socials' } | null {
  if (!code) return null;
  if (code === 'already_joined') return null;
  if (code.startsWith('creator_not_eligible')) {
    const s = code.split(':')[1];
    return s === 'verified'
      ? { label: 'Menunggu persetujuan akun', note: 'Kamu bisa bergabung setelah tim TAPP menyetujui akunmu.' }
      : s === 'suspended' || s === 'banned'
        ? { label: 'Tidak bisa bergabung', note: 'Akunmu sedang tidak aktif.' }
        : { label: 'Lengkapi profil dulu', note: 'Selesaikan onboarding untuk bisa bergabung.' };
  }
  const map: Record<string, { label: string; note: string | null; action?: 'socials' }> = {
    platform_not_eligible: { label: 'Hubungkan akun', note: 'Campaign ini butuh akun di salah satu platformnya.', action: 'socials' },
    campaign_budget_exhausted: { label: 'Budget habis', note: 'Campaign ini sudah mencapai budget-nya.' },
    campaign_closed: { label: 'Pendaftaran ditutup', note: 'Batas waktu campaign sudah lewat.' },
    campaign_not_started: { label: 'Belum dimulai', note: null },
    campaign_not_active: { label: 'Campaign tidak aktif', note: null },
    membership_removed: { label: 'Tidak bisa bergabung', note: 'Kamu telah dikeluarkan dari campaign ini.' },
  };
  return map[code] ?? { label: 'Tidak bisa bergabung', note: null };
}
