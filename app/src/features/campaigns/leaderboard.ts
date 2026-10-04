import { supabase } from '@/lib/supabase';

// Weekly top creators of a campaign (0048 campaign_leaderboard): qualified views credited in the last 7 days.
export type LeaderRow = { rank: number; name: string; views: number; is_me: boolean };
export async function fetchLeaderboard(campaignId: string): Promise<LeaderRow[]> {
  const { data, error } = await supabase.rpc('campaign_leaderboard', { p_campaign: campaignId, p_limit: 10 });
  if (error) throw error;
  return ((data ?? []) as LeaderRow[]).map((r) => ({ ...r, rank: Number(r.rank), views: Number(r.views) }));
}

// TAPP-wide weekly boards (0050): creators (with city) and cities.
export type CreatorRow = { rank: number; name: string; city: string | null; views: number; is_me: boolean };
export type CityRow = { rank: number; city: string; views: number; creators: number; is_mine: boolean };
export async function fetchWeeklyBoard(): Promise<CreatorRow[]> {
  const { data, error } = await supabase.rpc('weekly_leaderboard', { p_limit: 20 });
  if (error) throw error;
  return ((data ?? []) as CreatorRow[]).map((r) => ({ ...r, rank: Number(r.rank), views: Number(r.views) }));
}
export async function fetchCityBoard(): Promise<CityRow[]> {
  const { data, error } = await supabase.rpc('city_leaderboard', { p_limit: 10 });
  if (error) throw error;
  return ((data ?? []) as CityRow[]).map((r) => ({ ...r, rank: Number(r.rank), views: Number(r.views), creators: Number(r.creators) }));
}
