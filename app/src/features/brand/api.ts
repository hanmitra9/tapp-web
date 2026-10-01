import { supabase } from '@/lib/supabase';

export type BrandCampaign = {
  id: string; brand_id: string; brand_name: string; title: string; category: string;
  status: 'pending_approval' | 'active' | 'paused' | 'ending' | 'completed' | 'archived' | 'cancelled';
  cpm: number; budget: number; spent: number; remaining: number; starts_at: string | null; ends_at: string | null;
  submission_deadline: string | null; platforms: string[]; creators_joined: number; submissions: number; approved: number;
  qualified_views: number; raw_views: number;
};
export type Daily = { day: string; qualified_gain: number; spend: number };
export type Clip = { submission_id: string; creator_username: string | null; platform: string; post_url: string; status: string;
  published_at: string; raw_views: number; qualified_views: number; spend: number };
export type MyBrand = { id: string; name: string; logo_url: string | null; role: 'owner' | 'member' | 'viewer' };

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
  return (data as Clip[]).map((c) => ({ ...c, raw_views: n(c.raw_views), qualified_views: n(c.qualified_views), spend: n(c.spend) }));
}
export async function fetchPlatformBreakdown(campaignId: string) {
  const { data, error } = await supabase.rpc('campaign_platform_breakdown', { p_campaign_id: campaignId });
  if (error) throw error;
  return (data as { platform: string; submissions: number; approved: number; qualified_views: number; earned: number }[])
    .map((r) => ({ ...r, submissions: n(r.submissions), approved: n(r.approved), qualified_views: n(r.qualified_views), earned: n(r.earned) }));
}

export type Totals = { active: number; creators: number; approved: number; qualified: number; raw: number; spent: number; budget: number; remaining: number; cpv: number | null };
export function totals(cs: BrandCampaign[]): Totals {
  const t = cs.reduce((a, c) => ({
    active: a.active + (c.status === 'active' || c.status === 'ending' ? 1 : 0), creators: a.creators + c.creators_joined,
    approved: a.approved + c.approved, qualified: a.qualified + c.qualified_views, raw: a.raw + c.raw_views,
    spent: a.spent + c.spent, budget: a.budget + c.budget, remaining: a.remaining + c.remaining,
  }), { active: 0, creators: 0, approved: 0, qualified: 0, raw: 0, spent: 0, budget: 0, remaining: 0 });
  return { ...t, cpv: t.qualified > 0 ? t.spent / t.qualified : null };
}

export const BRAND_STATUS: Record<BrandCampaign['status'], { label: string; tone: 'neutral' | 'blue' | 'success' | 'warning' | 'danger' }> = {
  pending_approval: { label: 'Menunggu persetujuan', tone: 'warning' }, active: { label: 'Aktif', tone: 'success' },
  paused: { label: 'Dijeda', tone: 'warning' }, ending: { label: 'Segera berakhir', tone: 'warning' },
  completed: { label: 'Selesai', tone: 'blue' }, archived: { label: 'Diarsipkan', tone: 'neutral' }, cancelled: { label: 'Dibatalkan', tone: 'danger' },
};
export const cpvLabel = (v: number | null) => (v == null ? '—' : `Rp${v.toLocaleString('id-ID', { maximumFractionDigits: 2 })}`);
