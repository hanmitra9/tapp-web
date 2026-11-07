import { supabase } from '@/lib/supabase';

// A creator's month (0071 my_monthly_recap): views, accepted clips, campaigns, best clip, standing. No money.
export type Recap = { month: string; views: number; clips: number; campaigns: number; best_views: number | null; tier: string;
  name: string | null; top_pct: number | null; creators: number };
export async function fetchRecap(month?: string): Promise<Recap> {
  const { data, error } = await supabase.rpc('my_monthly_recap', month ? { p_month: month } : {});
  if (error) throw error;
  const d = (data ?? {}) as Record<string, unknown>;
  const n = (x: unknown) => Number(x ?? 0);
  return { month: String(d.month), views: n(d.views), clips: n(d.clips), campaigns: n(d.campaigns), best_views: d.best_views == null ? null : n(d.best_views),
    tier: String(d.tier ?? 'new'), name: (d.name as string) ?? null, top_pct: d.top_pct == null ? null : n(d.top_pct), creators: n(d.creators) };
}
