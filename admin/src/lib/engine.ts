// Mirrors admin_qualify_views' arithmetic for a live preview. The database recomputes and is authoritative.
export type EngineInput = {
  qualified: number; minViews: number; cpm: number; maxPerSubmission: number | null;
  alreadyEarned: number; budget: number; campaignEarned: number; override: boolean;
};
export function previewEarnings(i: EngineInput) {
  const payable = i.qualified >= i.minViews ? i.qualified : 0;
  let target = Math.floor((payable * i.cpm) / 1000);
  if (i.maxPerSubmission != null) target = Math.min(target, i.maxPerSubmission);
  let delta = target - i.alreadyEarned;
  let capped = false;
  const remaining = Math.max(i.budget - i.campaignEarned, 0);
  if (delta > 0 && !i.override && delta > remaining) { delta = remaining; capped = true; }
  return { payable, target, delta, capped, belowMin: i.qualified > 0 && i.qualified < i.minViews };
}

export type Metric = { id: string; captured_at: string; views: number; likes: number; comments: number; shares: number; saves: number; source: string };

// Heuristic review signals. They inform the reviewer; they never change numbers automatically.
export function signals(m: Metric[], followers: number | null): { level: 'warn' | 'info'; text: string }[] {
  const out: { level: 'warn' | 'info'; text: string }[] = [];
  const [last, prev] = m;
  if (!last) return out;
  const eng = last.views ? (last.likes + last.comments + last.shares) / last.views : 0;
  if (last.views >= 5000 && eng < 0.005) out.push({ level: 'warn', text: `Engagement rendah (${(eng * 100).toFixed(2)}%) untuk ${last.views.toLocaleString('id-ID')} views.` });
  if (prev && prev.views > 0) {
    const hours = (new Date(last.captured_at).getTime() - new Date(prev.captured_at).getTime()) / 3.6e6;
    if (last.views / prev.views >= 10 && hours <= 24) out.push({ level: 'warn', text: `Views naik ${Math.round(last.views / prev.views)}× dalam ${Math.max(1, Math.round(hours))} jam.` });
    if (last.views < prev.views) out.push({ level: 'warn', text: 'Views turun dibanding snapshot sebelumnya — cek apakah data salah input atau views dihapus platform.' });
  }
  if (followers && followers > 0 && last.views / followers > 50) out.push({ level: 'info', text: `Views ${Math.round(last.views / followers)}× jumlah followers (viral atau perlu dicek).` });
  return out;
}

// ── Fairness score (bot-view signals) from the views history recorded by the automatic checks (0042) ──
export type CheckPoint = { checked_at: string; status: string; views: number | null; likes: number | null; comments: number | null; shares: number | null };
export type Fairness = { score: number; label: 'Wajar' | 'Perlu dicek' | 'Mencurigakan' | 'Belum cukup data'; tone: 'success' | 'warning' | 'danger' | ''; reasons: string[] };

const engOf = (p: CheckPoint) => (p.views ? ((p.likes ?? 0) + (p.comments ?? 0) + (p.shares ?? 0)) / p.views : null);

// Typical engagement of a creator: median over their other clips' latest readings with enough views.
export function typicalEngagement(points: CheckPoint[][]): number | null {
  const e = points.map((l) => l.filter((p) => (p.views ?? 0) >= 2000 && p.likes != null).at(-1)).filter(Boolean).map((p) => engOf(p!)!).sort((a, b) => a - b);
  return e.length >= 2 ? e[Math.floor(e.length / 2)]! : null;
}

// Heuristics only: they explain why a clip deserves a closer look; the admin decides. 100 = nothing unusual.
export function fairness(log: CheckPoint[], followers: number | null, creatorTypical: number | null): Fairness {
  const pts = log.filter((p) => p.views != null).sort((a, b) => a.checked_at.localeCompare(b.checked_at));
  const last = pts.at(-1);
  if (!last || (last.views ?? 0) < 1000) return { score: 100, label: 'Belum cukup data', tone: '', reasons: ['Views masih di bawah 1.000 — penilaian dimulai setelah ada data cukup.'] };
  let score = 100; const reasons: string[] = [];
  const v = last.views!;
  const eng = last.likes != null ? engOf(last) : null;
  if (eng != null && v >= 2000) {
    const pct = (eng * 100).toFixed(2).replace('.', ',');
    if (eng < 0.003) { score -= 40; reasons.push(`Engagement sangat rendah (${pct}%) — ciri khas views beli.`); }
    else if (eng < 0.008) { score -= 20; reasons.push(`Engagement rendah (${pct}%).`); }
    else if (eng < 0.015) { score -= 8; reasons.push(`Engagement agak rendah (${pct}%).`); }
    if (creatorTypical != null && creatorTypical >= 0.01 && eng < creatorTypical / 4) { score -= 15; reasons.push(`Jauh di bawah engagement biasa kreator ini (${(creatorTypical * 100).toFixed(1).replace('.', ',')}%).`); }
  }
  if ((last.likes ?? 0) >= 500 && last.comments != null && last.comments / (last.likes || 1) < 0.002) { score -= 10; reasons.push('Banyak likes tapi hampir tidak ada komentar.'); }
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!, b = pts[i]!;
    const hours = Math.max((new Date(b.checked_at).getTime() - new Date(a.checked_at).getTime()) / 3.6e6, 0.1);
    if ((a.views ?? 0) >= 1000 && b.views! / a.views! >= 10 && hours <= 24) { score -= 25; reasons.push(`Lonjakan ${Math.round(b.views! / a.views!)}× dalam ${Math.round(hours)} jam.`); break; }
    if ((a.views ?? 0) >= 1000 && b.views! / a.views! >= 5 && hours <= 6) { score -= 15; reasons.push(`Naik ${Math.round(b.views! / a.views!)}× dalam ${Math.round(hours)} jam.`); break; }
  }
  const peak = Math.max(...pts.map((p) => p.views!));
  if (peak > 0 && v < peak * 0.9) { score -= 30; reasons.push(`Views turun dari ${peak.toLocaleString('id-ID')} ke ${v.toLocaleString('id-ID')} — platform mungkin menghapus views palsu.`); }
  if (followers && followers > 0 && v / followers > 100) { score -= 10; reasons.push(`Views ${Math.round(v / followers)}× jumlah followers — bisa viral, cek polanya.`); }
  if (pts.length < 2) reasons.push('Baru 1 catatan views; pola pertumbuhan terlihat setelah dicek ulang otomatis tiap 6 jam.');
  score = Math.max(0, Math.min(100, score));
  const label = score >= 75 ? 'Wajar' : score >= 50 ? 'Perlu dicek' : 'Mencurigakan';
  return { score, label, tone: score >= 75 ? 'success' : score >= 50 ? 'warning' : 'danger', reasons: reasons.length ? reasons : ['Tidak ada pola janggal.'] };
}
