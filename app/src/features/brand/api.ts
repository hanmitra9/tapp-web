import { supabase } from '@/lib/supabase';

export type BrandCampaign = {
  id: string; brand_id: string; brand_name: string; title: string; category: string;
  status: 'pending_approval' | 'active' | 'paused' | 'ending' | 'completed' | 'archived' | 'cancelled';
  cpm: number; budget: number; spent: number; remaining: number; starts_at: string | null; ends_at: string | null;
  submission_deadline: string | null; platforms: string[]; creators_joined: number; submissions: number; approved: number;
  qualified_views: number; raw_views: number;
  pending_views: number; excluded_views: number; fee_pct: number; platform_fee: number; total_cost: number; effective_cpm: number | null;
  last_metrics_at: string | null; last_qualified_at: string | null;
};
export type Daily = { day: string; qualified_gain: number; spend: number };
export type Clip = { submission_id: string; creator_username: string | null; platform: string; post_url: string; status: string;
  published_at: string; raw_views: number; qualified_views: number; spend: number; pending_views: number; last_metrics_at: string | null };
export type MyBrand = { id: string; name: string; logo_url: string | null; role: 'owner' | 'member' | 'viewer'; daily_report: boolean };

const n = (x: unknown) => Number(x ?? 0);
const tz = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Jakarta'; } catch { return 'Asia/Jakarta'; } };

export async function fetchMyBrands(): Promise<MyBrand[]> {
  const { data, error } = await supabase.rpc('my_brands');
  if (error) throw error;
  return data as MyBrand[];
}
export async function fetchBrandCampaigns(): Promise<BrandCampaign[]> {
  const { data, error } = await supabase.rpc('brand_campaigns');
  if (error) throw error;
  return (data as BrandCampaign[]).map((c) => ({
    ...c, cpm: n(c.cpm), budget: n(c.budget), spent: n(c.spent), remaining: n(c.remaining), creators_joined: n(c.creators_joined),
    submissions: n(c.submissions), approved: n(c.approved), qualified_views: n(c.qualified_views), raw_views: n(c.raw_views),
    pending_views: n(c.pending_views), excluded_views: n(c.excluded_views), fee_pct: n(c.fee_pct ?? 15), platform_fee: n(c.platform_fee),
    total_cost: n(c.total_cost ?? c.spent), effective_cpm: c.effective_cpm == null ? null : n(c.effective_cpm),
  }));
}
export async function fetchBrandDaily(campaignId: string | null, days: number): Promise<Daily[]> {
  const { data, error } = await supabase.rpc('brand_daily', { p_campaign_id: campaignId, p_days: days, p_tz: tz() });
  if (error) throw error;
  return (data as Daily[]).map((d) => ({ day: d.day, qualified_gain: n(d.qualified_gain), spend: n(d.spend) }));
}
export async function fetchTopClips(campaignId: string): Promise<Clip[]> {
  const { data, error } = await supabase.rpc('brand_top_clips', { p_campaign_id: campaignId, p_limit: 20 });
  if (error) throw error;
  return (data as Clip[]).map((c) => ({ ...c, raw_views: n(c.raw_views), qualified_views: n(c.qualified_views), spend: n(c.spend), pending_views: n(c.pending_views) }));
}
// Every clip in a campaign, any status, newest first (Submission tab + CSV export).
export async function fetchBrandSubmissions(campaignId: string): Promise<Clip[]> {
  const { data, error } = await supabase.rpc('brand_submissions', { p_campaign_id: campaignId });
  if (error) throw error;
  return (data as Clip[]).map((c) => ({ ...c, raw_views: n(c.raw_views), qualified_views: n(c.qualified_views), spend: n(c.spend), pending_views: n(c.pending_views) }));
}
export const CLIP_STATUS: Record<string, { label: string; tone: 'neutral' | 'blue' | 'success' | 'warning' | 'danger'; group: 'review' | 'ok' | 'no' }> = {
  pending_review: { label: 'Direview', tone: 'warning', group: 'review' }, needs_changes: { label: 'Revisi', tone: 'warning', group: 'review' },
  approved: { label: 'Disetujui', tone: 'success', group: 'ok' }, tracking: { label: 'Disetujui', tone: 'success', group: 'ok' },
  completed: { label: 'Selesai', tone: 'blue', group: 'ok' }, rejected: { label: 'Ditolak', tone: 'danger', group: 'no' },
  flagged: { label: 'Tidak wajar', tone: 'danger', group: 'no' },
};

// Budget and new campaigns are arranged privately with the account manager on WhatsApp.
export const BRAND_WA = 'https://wa.me/6282329160953';


export async function setDailyReport(brandId: string, on: boolean) {
  const { error } = await supabase.rpc('set_brand_daily_report', { p_brand_id: brandId, p_on: on });
  if (error) throw error;
}
export async function fetchPlatformBreakdown(campaignId: string) {
  const { data, error } = await supabase.rpc('campaign_platform_breakdown', { p_campaign_id: campaignId });
  if (error) throw error;
  return (data as { platform: string; submissions: number; approved: number; qualified_views: number; earned: number }[])
    .map((r) => ({ ...r, submissions: n(r.submissions), approved: n(r.approved), qualified_views: n(r.qualified_views), earned: n(r.earned) }));
}

export type Totals = { active: number; creators: number; approved: number; qualified: number; raw: number; spent: number; budget: number; remaining: number; cpv: number | null;
  pending: number; excluded: number; fee: number; totalCost: number; effectiveCpm: number | null; lastMetricsAt: string | null; lastQualifiedAt: string | null };
const latest = (a: string | null, b: string | null) => (!a ? b : !b ? a : a > b ? a : b);
export function totals(cs: BrandCampaign[]): Totals {
  const t = cs.reduce((a, c) => ({
    active: a.active + (c.status === 'active' || c.status === 'ending' ? 1 : 0), creators: a.creators + c.creators_joined,
    approved: a.approved + c.approved, qualified: a.qualified + c.qualified_views, raw: a.raw + c.raw_views,
    spent: a.spent + c.spent, budget: a.budget + c.budget, remaining: a.remaining + c.remaining,
    pending: a.pending + c.pending_views, excluded: a.excluded + c.excluded_views, fee: a.fee + c.platform_fee, totalCost: a.totalCost + c.total_cost,
    lastMetricsAt: latest(a.lastMetricsAt, c.last_metrics_at), lastQualifiedAt: latest(a.lastQualifiedAt, c.last_qualified_at),
  }), { active: 0, creators: 0, approved: 0, qualified: 0, raw: 0, spent: 0, budget: 0, remaining: 0, pending: 0, excluded: 0, fee: 0, totalCost: 0,
        lastMetricsAt: null as string | null, lastQualifiedAt: null as string | null });
  return { ...t, cpv: t.qualified > 0 ? t.spent / t.qualified : null, effectiveCpm: t.raw > 0 ? Math.round((t.spent * 1000) / t.raw) : null };
}

export const BRAND_STATUS: Record<BrandCampaign['status'], { label: string; tone: 'neutral' | 'blue' | 'success' | 'warning' | 'danger' }> = {
  pending_approval: { label: 'Menunggu persetujuan', tone: 'warning' }, active: { label: 'Aktif', tone: 'success' },
  paused: { label: 'Dijeda', tone: 'warning' }, ending: { label: 'Segera berakhir', tone: 'warning' },
  completed: { label: 'Selesai', tone: 'blue' }, archived: { label: 'Diarsipkan', tone: 'neutral' }, cancelled: { label: 'Dibatalkan', tone: 'danger' },
};
export const cpvLabel = (v: number | null) => (v == null ? '—' : `Rp${v.toLocaleString('id-ID', { maximumFractionDigits: 2 })}`);

// Campaign hashtag reach on TikTok (migration 0043): one row per reading, oldest first.
export type HashtagStat = { hashtag: string; platform: string; video_count: number; view_count: number; captured_at: string };
// Latest hashtag reading per campaign, summed: total TikTok views/videos on the brand's campaign hashtags.
export async function fetchHashtagTotals(): Promise<{ views: number; videos: number; tags: string[] } | null> {
  const { data } = await supabase.from('campaign_hashtag_stats').select('campaign_id, hashtag, video_count, view_count, captured_at')
    .order('captured_at', { ascending: false }).limit(1000);
  const seen = new Set<string>(), out = { views: 0, videos: 0, tags: [] as string[] };
  for (const r of (data ?? []) as (HashtagStat & { campaign_id: string })[]) {
    if (seen.has(r.campaign_id)) continue;
    seen.add(r.campaign_id); out.views += n(r.view_count); out.videos += n(r.video_count);
    if (!out.tags.includes(r.hashtag)) out.tags.push(r.hashtag);
  }
  return seen.size ? out : null;
}
export async function fetchHashtagStats(campaignId: string): Promise<HashtagStat[]> {
  const { data } = await supabase.from('campaign_hashtag_stats').select('hashtag, platform, video_count, view_count, captured_at').eq('campaign_id', campaignId).order('captured_at');
  return ((data ?? []) as HashtagStat[]).map((r) => ({ ...r, video_count: Number(r.video_count), view_count: Number(r.view_count) }));
}

// Monthly subscription (0069): guaranteed views per 30-day period, next bill date.
export type BrandSubscription = { id: string; campaign_id: string; campaign_title: string; plan_name: string; monthly_price: number; price_per_1k: number;
  status: 'pending' | 'active' | 'past_due'; next_bill_at: string | null;
  progress: { delivered: number; target_total: number; period_start: string | null; period_end: string | null; period_target: number | null; period_delivered: number; bonus_pct?: number } };
export async function fetchSubscriptions(): Promise<BrandSubscription[]> {
  const { data, error } = await supabase.rpc('brand_subscriptions_summary');
  if (error) throw error;
  return ((data ?? []) as Record<string, any>[]).map((r) => ({
    ...r, monthly_price: n(r.monthly_price), price_per_1k: n(r.price_per_1k),
    progress: { ...r.progress, delivered: n(r.progress?.delivered), target_total: n(r.progress?.target_total),
      period_target: r.progress?.period_target == null ? null : n(r.progress.period_target), period_delivered: n(r.progress?.period_delivered), bonus_pct: n(r.progress?.bonus_pct) },
  })) as BrandSubscription[];
}

// Plans a brand can subscribe to (0069/0070): guaranteed views include the plan's bonus.
export type SubscriptionPlan = { id: string; name: string; monthly_price: number; price_per_1k: number; bonus_pct: number; views: number };
export async function fetchPlans(): Promise<SubscriptionPlan[]> {
  const { data, error } = await supabase.from('subscription_plans').select('id, name, monthly_price, price_per_1k, bonus_pct').eq('active', true).order('sort');
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map((p) => {
    const price = n(p.monthly_price), per1k = n(p.price_per_1k), bonus = n(p.bonus_pct);
    return { id: String(p.id), name: String(p.name), monthly_price: price, price_per_1k: per1k, bonus_pct: bonus, views: Math.floor(price * 1000 * (100 + bonus) / (per1k * 100)) };
  });
}
