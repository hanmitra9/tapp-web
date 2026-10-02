import { supabase } from '@/lib/supabase';
import type { Platform } from '@/features/creator/options';

export type Sort = 'recommended' | 'newest' | 'cpm' | 'deadline';
export type Filters = { platforms: Platform[]; categories: string[]; contentTypes: string[]; minCpm: number | null; endingWithinDays: number | null };
export const EMPTY_FILTERS: Filters = { platforms: [], categories: [], contentTypes: [], minCpm: null, endingWithinDays: null };
export const activeFilterCount = (f: Filters) =>
  (f.platforms.length ? 1 : 0) + (f.categories.length ? 1 : 0) + (f.contentTypes.length ? 1 : 0) + (f.minCpm ? 1 : 0) + (f.endingWithinDays ? 1 : 0);

export type FeedItem = {
  id: string; title: string; category: string; content_type: string; brand_name: string; brand_logo: string | null;
  platforms: Platform[]; cpm: number; budget: number; remaining: number; min_views_to_qualify: number;
  submission_deadline: string | null; ends_at: string | null; created_at: string;
  joined: boolean; match_score: number; match_reasons: string[]; banner_url?: string | null;
  creators_joined?: number; joined_initials?: string[];
};

export type CampaignDetail = {
  id: string; title: string; objective: string | null; description: string | null; category: string; content_type: string;
  status: 'draft' | 'pending_approval' | 'active' | 'paused' | 'ending' | 'completed' | 'archived' | 'cancelled';
  cpm: number; budget: number; remaining: number; min_views_to_qualify: number; max_earning_per_submission: number | null;
  starts_at: string | null; ends_at: string | null; submission_deadline: string | null;
  guidelines_do: string[]; guidelines_dont: string[]; terms: string | null;
  brand: { name: string; logo_url: string | null; website: string | null };
  platforms: Platform[]; rules: { kind: 'requirement' | 'submission' | 'performance'; body: string }[];
  creators_joined: number; membership: { status: 'joined' | 'left' | 'removed'; joined_at: string } | null;
  join_block: string | null; banner_url?: string | null; joined_initials?: string[];
};
export type Asset = { id: string; kind: 'video' | 'audio' | 'image' | 'document' | 'link'; title: string; url: string | null; storage_path: string | null };

export const PAGE = 20;
const num = (x: unknown) => Number(x ?? 0);

export async function fetchFeed(sort: Sort, f: Filters, offset = 0): Promise<FeedItem[]> {
  const { data, error } = await supabase.rpc('campaign_feed', {
    p_platforms: f.platforms.length ? f.platforms : null, p_categories: f.categories.length ? f.categories : null,
    p_content_types: f.contentTypes.length ? f.contentTypes : null, p_min_cpm: f.minCpm, p_ending_within_days: f.endingWithinDays,
    p_sort: sort, p_limit: PAGE, p_offset: offset,
  });
  if (error) throw error;
  const rows = (data ?? []) as FeedItem[];
  const ids = rows.map((r) => r.id);
  const [banners, joined] = await Promise.all([fetchBanners(ids), fetchParticipation(ids)]);
  return rows.map((r) => ({ ...r, cpm: num(r.cpm), budget: num(r.budget), remaining: num(r.remaining), banner_url: banners[r.id] ?? null,
    creators_joined: joined[r.id]?.creators_joined ?? 0, joined_initials: joined[r.id]?.initials ?? [] }));
}

// Banner photos (migration 0036) live on campaigns.banner_url; the feed/detail RPCs predate it.
export async function fetchBanners(ids: string[]): Promise<Record<string, string>> {
  if (!ids.length) return {};
  const { data } = await supabase.from('campaigns').select('id, banner_url').in('id', ids).not('banner_url', 'is', null);
  return Object.fromEntries((data ?? []).map((r) => [r.id as string, r.banner_url as string]));
}

// How many creators joined each campaign + initials of the latest ones (migration 0040), for the avatar stack.
export type Participation = { creators_joined: number; initials: string[] };
export async function fetchParticipation(ids: string[]): Promise<Record<string, Participation>> {
  if (!ids.length) return {};
  const { data } = await supabase.rpc('campaign_participation', { p_ids: ids });
  return Object.fromEntries(((data ?? []) as { campaign_id: string; creators_joined: number; initials: string[] | null }[])
    .map((r) => [r.campaign_id, { creators_joined: num(r.creators_joined), initials: r.initials ?? [] }]));
}

export async function fetchCampaign(id: string): Promise<CampaignDetail> {
  const { data, error } = await supabase.rpc('get_campaign', { p_campaign_id: id });
  if (error) throw error;
  const d = data as CampaignDetail;
  const [banners, joined] = await Promise.all([fetchBanners([d.id]), fetchParticipation([d.id])]);
  return { ...d, banner_url: banners[d.id] ?? null, joined_initials: joined[d.id]?.initials ?? [], cpm: num(d.cpm), budget: num(d.budget), remaining: num(d.remaining), creators_joined: num(d.creators_joined) };
}

// RLS only returns assets once the creator has joined.
export async function fetchAssets(campaignId: string): Promise<Asset[]> {
  const { data, error } = await supabase.from('campaign_assets').select('id, kind, title, url, storage_path')
    .eq('campaign_id', campaignId).order('sort');
  if (error) throw error;
  return data as Asset[];
}
export async function assetLink(a: Asset): Promise<string | null> {
  if (a.url) return a.url;
  if (!a.storage_path) return null;
  const { data, error } = await supabase.storage.from('campaign-assets').createSignedUrl(a.storage_path, 60 * 30);
  if (error) throw error;
  return data.signedUrl;
}

export async function joinCampaign(id: string) {
  const { error } = await supabase.rpc('join_campaign', { p_campaign_id: id });
  if (error) throw error;
}
export async function leaveCampaign(id: string) {
  const { error } = await supabase.rpc('leave_campaign', { p_campaign_id: id });
  if (error) throw error;
}

export type Home = { available: number; active: number; qualified_views: number; total_earned: number };
export async function fetchHome(): Promise<Home> {
  const { data, error } = await supabase.rpc('creator_home');
  if (error) throw error;
  return { available: num(data.available), active: num(data.active), qualified_views: num(data.qualified_views), total_earned: num(data.total_earned) };
}

export type MyCampaign = {
  id: string; status: 'joined' | 'left' | 'removed'; joined_at: string;
  campaign: { id: string; title: string; status: CampaignDetail['status']; cpm: number; submission_deadline: string | null; brand: { name: string } | null } | null;
};
export async function fetchMyCampaigns(): Promise<MyCampaign[]> {
  const { data, error } = await supabase.from('campaign_creators')
    .select('id, status, joined_at, campaign:campaigns(id, title, status, cpm, submission_deadline, brand:brands(name))')
    .order('joined_at', { ascending: false });
  if (error) throw error;
  return data as unknown as MyCampaign[];
}
