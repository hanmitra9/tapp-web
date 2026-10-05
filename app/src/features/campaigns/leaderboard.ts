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

// All-time board (0055): total credited earnings, masked names, avatar, level.
export type AllTimeRow = { rank: number; name: string; avatar_url: string | null; tier: string | null; payout: number; campaigns: number; is_me: boolean };
export async function fetchAllTimeBoard(limit = 20): Promise<AllTimeRow[]> {
  const { data, error } = await supabase.rpc('alltime_leaderboard', { p_limit: limit });
  if (error) throw error;
  return ((data ?? []) as AllTimeRow[]).map((r) => ({ ...r, rank: Number(r.rank), payout: Number(r.payout), campaigns: Number(r.campaigns ?? 0) }));
}

// Monthly board with prizes (0057): resets on the 1st (WIB). Meta gives prizes + reset time even when the board is empty.
export type MonthlyRow = AllTimeRow & { prize: number };
export type Monthly = { rows: MonthlyRow[]; prizes: number[]; resetsAt: string };
export async function fetchMonthlyBoard(limit = 30): Promise<Monthly> {
  const [b, m] = await Promise.all([supabase.rpc('monthly_leaderboard', { p_limit: limit }), supabase.rpc('leaderboard_meta')]);
  if (b.error) throw b.error;
  if (m.error) throw m.error;
  const meta = (m.data as { prizes: number[]; resets_at: string }[])[0];
  return {
    rows: ((b.data ?? []) as MonthlyRow[]).map((r) => ({ ...r, rank: Number(r.rank), payout: Number(r.payout), campaigns: Number(r.campaigns ?? 0), prize: Number(r.prize ?? 0) })),
    prizes: (meta?.prizes ?? []).map(Number), resetsAt: meta?.resets_at ?? new Date().toISOString(),
  };
}
