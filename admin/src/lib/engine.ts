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
