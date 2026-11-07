import { supabase } from '@/lib/supabase';

// Weekly streak (0075): consecutive weeks with at least one accepted clip. A badge only.
export type Streak = { current: number; best: number; this_week: boolean };
const toStreak = (x: unknown): Streak => { const d = (x ?? {}) as Record<string, unknown>;
  return { current: Number(d.current ?? 0), best: Number(d.best ?? 0), this_week: d.this_week === true }; };
export async function fetchStreak(): Promise<Streak> {
  const { data, error } = await supabase.rpc('my_streak');
  if (error) throw error;
  return toStreak(data);
}
export type StreakWeek = { week: string; clips: number };
export async function fetchStreakWeeks(weeks = 26): Promise<StreakWeek[]> {
  const { data, error } = await supabase.rpc('my_streak_weeks', { p_weeks: weeks });
  if (error) throw error;
  return ((data ?? []) as StreakWeek[]).map((w) => ({ week: String(w.week), clips: Number(w.clips ?? 0) }));
}
// Next badge and how many weeks to it; null at the top.
export function nextBadge(weeks: number): { name: string; at: number } | null {
  for (const [at, name] of [[2, 'Mulai panas'], [4, 'Konsisten'], [8, 'Rajin'], [12, 'Legenda']] as const) if (weeks < at) return { name, at };
  return null;
}
// Badge name by weeks in a row; null below 2 weeks.
export function streakBadge(weeks: number): string | null {
  return weeks >= 12 ? 'Legenda' : weeks >= 8 ? 'Rajin' : weeks >= 4 ? 'Konsisten' : weeks >= 2 ? 'Mulai panas' : null;
}

// A creator's month (0071 my_monthly_recap): views, accepted clips, campaigns, best clip, standing. No money.
export type Recap = { month: string; views: number; clips: number; campaigns: number; best_views: number | null; tier: string;
  name: string | null; top_pct: number | null; creators: number; streak: Streak };
export async function fetchRecap(month?: string): Promise<Recap> {
  const { data, error } = await supabase.rpc('my_monthly_recap', month ? { p_month: month } : {});
  if (error) throw error;
  const d = (data ?? {}) as Record<string, unknown>;
  const n = (x: unknown) => Number(x ?? 0);
  return { month: String(d.month), views: n(d.views), clips: n(d.clips), campaigns: n(d.campaigns), best_views: d.best_views == null ? null : n(d.best_views),
    tier: String(d.tier ?? 'new'), name: (d.name as string) ?? null, top_pct: d.top_pct == null ? null : n(d.top_pct), creators: n(d.creators),
    streak: toStreak(d.streak) };
}
