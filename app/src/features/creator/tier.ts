import { supabase } from '@/lib/supabase';

// Progress to the next level (0022 my_tier_progress) with each level's withdrawal bonus (0037 tier_bonus_pct).
export const TIERS = ['new', 'rising', 'verified', 'proven', 'elite'] as const;
export type Tier = (typeof TIERS)[number];
export type TierProgress = {
  tier: Tier; views: number; bonusPct: number;
  next: Tier | null; nextBonusPct: number | null; toNext: number | null;
  from: number; to: number | null;          // thresholds of the current and next level
};

export async function fetchTierProgress(): Promise<TierProgress> {
  const [p, s] = await Promise.all([
    supabase.rpc('my_tier_progress'),
    supabase.from('app_settings').select('value').eq('key', 'tier_bonus_pct').maybeSingle(),
  ]);
  if (p.error) throw p.error;
  const d = p.data as { tier: Tier; lifetime_qualified_views: number; next_tier: Tier | null; views_to_next: number | null; thresholds: Record<string, number> };
  const bonus = (s.data?.value ?? {}) as Record<string, number>;
  const th = (t: Tier | null) => (t ? Number(d.thresholds?.[t] ?? 0) : null);
  return {
    tier: d.tier, views: Number(d.lifetime_qualified_views ?? 0), bonusPct: Number(bonus[d.tier] ?? 0),
    next: d.next_tier, nextBonusPct: d.next_tier ? Number(bonus[d.next_tier] ?? 0) : null,
    toNext: d.views_to_next == null ? null : Number(d.views_to_next),
    from: th(d.tier) ?? 0, to: th(d.next_tier),
  };
}
