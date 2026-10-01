const nf = new Intl.NumberFormat('id-ID');
export const idr = (n: number) => `Rp${nf.format(n)}`;
export const num = (n: number | null | undefined) => (n == null ? '—' : nf.format(n));
export const pct = (x: number) => `${(x * 100).toFixed(x < 0.01 ? 2 : 1)}%`;
export const dt = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
export const ago = (iso: string | null | undefined) => {
  if (!iso) return '—';
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 60) return `${m} mnt lalu`;
  if (m < 1440) return `${Math.round(m / 60)} jam lalu`;
  return `${Math.round(m / 1440)} hari lalu`;
};
// datetime-local <input> value in local time
export const toLocalInput = (d = new Date()) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
