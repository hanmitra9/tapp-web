import { supabase } from '@/lib/supabase';

export type DailyPoint = { day: string; qualified_gain: number; earned: number };
export type CampaignPerf = {
  campaign_id: string; title: string; brand_name: string | null; campaign_status: string; cpm: number;
  posts: number; approved_posts: number; raw_views: number; qualified_views: number; earned: number;
  engagements: number; gain_7d: number; gain_prev_7d: number; last_metrics_at: string | null;
};
export type Totals = {
  rawViews: number; qualifiedViews: number; posts: number; approvedPosts: number; campaigns: number;
  engagements: number; earned: number; engagementRate: number | null; qualificationRate: number | null;
};

const tz = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Jakarta'; } catch { return 'Asia/Jakarta'; } };
const n = (x: unknown) => Number(x ?? 0);

export async function fetchDaily(days: number): Promise<DailyPoint[]> {
  const { data, error } = await supabase.rpc('my_daily_performance', { p_days: days, p_tz: tz() });
  if (error) throw error;
  return (data as DailyPoint[]).map((d) => ({ day: d.day, qualified_gain: n(d.qualified_gain), earned: n(d.earned) }));
}

export async function fetchCampaignPerf(): Promise<CampaignPerf[]> {
  const { data, error } = await supabase.rpc('my_campaign_performance');
  if (error) throw error;
  return (data as CampaignPerf[]).map((r) => ({
    ...r, cpm: n(r.cpm), posts: n(r.posts), approved_posts: n(r.approved_posts), raw_views: n(r.raw_views),
    qualified_views: n(r.qualified_views), earned: n(r.earned), engagements: n(r.engagements), gain_7d: n(r.gain_7d), gain_prev_7d: n(r.gain_prev_7d),
  }));
}

export function totals(rows: CampaignPerf[]): Totals {
  const t = rows.reduce((a, r) => ({
    rawViews: a.rawViews + r.raw_views, qualifiedViews: a.qualifiedViews + r.qualified_views, posts: a.posts + r.posts,
    approvedPosts: a.approvedPosts + r.approved_posts, engagements: a.engagements + r.engagements, earned: a.earned + r.earned,
  }), { rawViews: 0, qualifiedViews: 0, posts: 0, approvedPosts: 0, engagements: 0, earned: 0 });
  return {
    ...t, campaigns: rows.length,
    engagementRate: t.rawViews > 0 ? t.engagements / t.rawViews : null,
    qualificationRate: t.rawViews > 0 ? t.qualifiedViews / t.rawViews : null,
  };
}

// "+24%", "Baru", "Stabil", "−10%". Null when there's nothing to compare.
export function trendLabel(now: number, prev: number): { text: string; tone: 'up' | 'down' | 'flat' } | null {
  if (now === 0 && prev === 0) return null;
  if (prev === 0) return { text: 'Baru naik minggu ini', tone: 'up' };
  const pct = Math.round(((now - prev) / prev) * 100);
  if (Math.abs(pct) < 5) return { text: 'Stabil vs minggu lalu', tone: 'flat' };
  return { text: `${pct > 0 ? '+' : '−'}${Math.abs(pct)}% vs minggu lalu`, tone: pct > 0 ? 'up' : 'down' };
}
