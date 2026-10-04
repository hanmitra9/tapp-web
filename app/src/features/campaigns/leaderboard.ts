import { supabase } from '@/lib/supabase';

// Weekly top creators of a campaign (0048 campaign_leaderboard): qualified views credited in the last 7 days.
export type LeaderRow = { rank: number; name: string; views: number; is_me: boolean };
export async function fetchLeaderboard(campaignId: string): Promise<LeaderRow[]> {
  const { data, error } = await supabase.rpc('campaign_leaderboard', { p_campaign: campaignId, p_limit: 10 });
  if (error) throw error;
  return ((data ?? []) as LeaderRow[]).map((r) => ({ ...r, rank: Number(r.rank), views: Number(r.views) }));
}
