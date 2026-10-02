const nf = new Intl.NumberFormat('id-ID');
const cf = new Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 });

export const idr = (n: number) => `Rp${nf.format(n)}`;
export const idrCompact = (n: number) => `Rp${cf.format(n)}`;          // Rp14,4 jt
export const num = (n: number) => nf.format(n);
export const compact = (n: number) => cf.format(n);
export const cpmLabel = (cpm: number) => `${idr(cpm)} / 1.000 views`;

const DAY = 86_400_000;
// "Berakhir hari ini", "3 hari lagi", "12 Okt"
export function deadlineLabel(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  const ms = d.getTime() - Date.now();
  if (ms < 0) return 'Sudah berakhir';
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 24) return hours <= 1 ? 'Berakhir < 1 jam lagi' : `Berakhir ${hours} jam lagi`;
  const days = Math.ceil(ms / DAY);
  if (days <= 14) return `Berakhir ${days} hari lagi`;
  return `Sampai ${d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}`;
}
export const isUrgent = (iso: string | null) => !!iso && new Date(iso).getTime() - Date.now() < 3 * DAY;

/** "baru saja", "12 menit lalu", "3 jam lalu", "2 hari lalu" */
export function ago(iso: string | null): string | null {
  if (!iso) return null;
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 1) return 'baru saja';
  if (m < 60) return `${m} menit lalu`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h} jam lalu` : `${Math.round(h / 24)} hari lalu`;
}
export const dateLabel = (iso: string) => new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

export function greeting(d = new Date()) {
  const h = d.getHours();
  return h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 18 ? 'Selamat sore' : 'Selamat malam';
}
