import type { BrandCampaign, Clip, Daily } from './api';

// Campaign report exports for the brand's own reporting. CSV for spreadsheets; "PDF" is a clean printable page
// (the browser's Save as PDF), so no PDF library ships in the bundle.
type Report = { c: BrandCampaign; daily: Daily[]; clips: Clip[]; platforms: { platform: string; approved: number; qualified_views: number; earned: number }[] };

const cell = (v: unknown) => { const s = String(v ?? ''); return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const line = (xs: unknown[]) => xs.map(cell).join(',');
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'campaign';
const today = () => new Date().toISOString().slice(0, 10);
const PLAT: Record<string, string> = { tiktok: 'TikTok', instagram: 'Instagram', youtube: 'YouTube', x: 'X', facebook: 'Facebook', other: 'Lainnya' };
const plat = (p: string) => PLAT[p] ?? p;

export function reportCsv({ c, daily, clips, platforms }: Report): string {
  return [
    line(['Laporan campaign TAPP', c.title]), line(['Brand', c.brand_name]), line(['Dibuat', new Date().toLocaleString('id-ID')]), '',
    line(['Metrik', 'Nilai']),
    line(['Views mentah', c.raw_views]), line(['Qualified views (dibayar)', c.qualified_views]), line(['Menunggu verifikasi', c.pending_views]),
    line(['Tidak dihitung', c.excluded_views]), line(['CPM campaign (Rp per 1.000 qualified views)', c.cpm]),
    line(['Effective CPM (Rp reward per 1.000 views mentah)', c.effective_cpm ?? '']), line(['Reward creator (Rp)', c.spent]),
    line([`Fee platform ${c.fee_pct}% (Rp)`, c.platform_fee]), line(['Total biaya (Rp)', c.total_cost]), line(['Budget (Rp)', c.budget]),
    line(['Sisa budget (Rp)', c.remaining]), line(['Kreator bergabung', c.creators_joined]), line(['Klip disubmit', c.submissions]),
    line(['Klip disetujui', c.approved]), line(['Views terakhir masuk', c.last_metrics_at ?? '']), line(['Verifikasi terakhir', c.last_qualified_at ?? '']), '',
    line(['Per hari', 'Qualified views baru', 'Reward (Rp)']), ...daily.map((d) => line([d.day, d.qualified_gain, d.spend])), '',
    line(['Platform', 'Klip disetujui', 'Qualified views', 'Reward (Rp)']), ...platforms.map((p) => line([plat(p.platform), p.approved, p.qualified_views, p.earned])), '',
    line(['Klip', 'Platform', 'Tanggal posting', 'Views mentah', 'Qualified views', 'Menunggu verifikasi', 'Reward (Rp)', 'Link']),
    ...clips.map((k) => line([`@${k.creator_username ?? 'kreator'}`, plat(k.platform), k.published_at?.slice(0, 10), k.raw_views, k.qualified_views, k.pending_views, k.spend, k.post_url])),
  ].join('\n');
}

export function downloadCsv(r: Report) {
  if (typeof document === 'undefined') return;
  const blob = new Blob(['﻿' + reportCsv(r)], { type: 'text/csv;charset=utf-8' });   // BOM: Excel reads Rupiah/accents right
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `tapp-${slug(r.c.title)}-${today()}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function printPdf({ c, daily, clips, platforms }: Report) {
  if (typeof window === 'undefined') return;
  const nf = new Intl.NumberFormat('id-ID');
  const rp = (n: number | null) => (n == null ? '—' : `Rp${nf.format(n)}`);
  const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[m]!);
  const tr = (cells: unknown[], th = false) => `<tr>${cells.map((x, i) => `<${th ? 'th' : 'td'}${i ? ' class="n"' : ''}>${esc(x)}</${th ? 'th' : 'td'}>`).join('')}</tr>`;
  const kpi = (l: string, v: string, s = '') => `<div class="k"><span>${esc(l)}</span><b>${esc(v)}</b>${s ? `<small>${esc(s)}</small>` : ''}</div>`;
  const gain = daily.filter((d) => d.qualified_gain > 0);
  const html = `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Laporan ${esc(c.title)} — TAPP</title><style>
  *{box-sizing:border-box}body{font:13px/1.5 -apple-system,'Segoe UI',Helvetica,Arial,sans-serif;color:#111;margin:32px}
  h1{font-size:22px;margin:0}h2{font-size:14px;margin:28px 0 8px;text-transform:uppercase;letter-spacing:.06em;color:#4548F5}
  .meta{color:#666;margin:4px 0 20px}.g{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
  .k{border:1px solid #e3e3ea;border-radius:10px;padding:10px 12px;display:flex;flex-direction:column;gap:2px}.k span{color:#666;font-size:11px}.k b{font-size:16px}.k small{color:#888;font-size:10px}
  table{width:100%;border-collapse:collapse}th,td{padding:6px 8px;border-bottom:1px solid #eee;text-align:left}th{font-size:11px;color:#666}.n{text-align:right;font-variant-numeric:tabular-nums}
  .note{color:#666;font-size:11px;margin-top:6px}@media print{body{margin:16mm}}</style></head><body>
  <h1>${esc(c.title)}</h1><div class="meta">${esc(c.brand_name)} · Laporan TAPP · dibuat ${esc(new Date().toLocaleString('id-ID'))}${c.last_metrics_at ? ` · views terakhir masuk ${esc(new Date(c.last_metrics_at).toLocaleString('id-ID'))}` : ''}</div>
  <h2>Ringkasan</h2><div class="g">
  ${kpi('Views mentah', nf.format(c.raw_views))}${kpi('Qualified views', nf.format(c.qualified_views), 'dibayar')}${kpi('Menunggu verifikasi', nf.format(c.pending_views))}${kpi('Tidak dihitung', nf.format(c.excluded_views))}
  ${kpi('Total biaya', rp(c.total_cost), `reward ${rp(c.spent)} + fee ${c.fee_pct}% ${rp(c.platform_fee)}`)}${kpi('Effective CPM', rp(c.effective_cpm), 'reward per 1.000 views mentah')}${kpi('CPM campaign', rp(c.cpm), 'per 1.000 qualified views')}${kpi('Sisa budget', rp(c.remaining), `dari ${rp(c.budget)}`)}
  </div><div class="note">Views mentah = qualified + menunggu verifikasi + tidak dihitung (di bawah minimum, di atas batas per klip, klip ditolak, atau aktivitas tidak wajar).</div>
  <h2>Per platform</h2><table>${tr(['Platform', 'Klip disetujui', 'Qualified views', 'Reward'], true)}${platforms.map((p) => tr([plat(p.platform), nf.format(p.approved), nf.format(p.qualified_views), rp(p.earned)])).join('')}</table>
  <h2>Klip</h2><table>${tr(['Kreator', 'Platform', 'Views mentah', 'Qualified', 'Menunggu', 'Reward'], true)}${clips.map((k) => tr([`@${k.creator_username ?? 'kreator'}`, plat(k.platform), nf.format(k.raw_views), nf.format(k.qualified_views), nf.format(k.pending_views), rp(k.spend)])).join('')}</table>
  ${gain.length ? `<h2>Qualified views per hari</h2><table>${tr(['Tanggal', 'Qualified views baru', 'Reward'], true)}${gain.map((d) => tr([d.day, nf.format(d.qualified_gain), rp(d.spend)])).join('')}</table>` : ''}
  <script>window.onload=function(){setTimeout(function(){window.print()},200)}</script></body></html>`;
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.open(); w.document.write(html); w.document.close();
}
