import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';
import { color, gradient, radius, space, type, card } from '@/theme/tokens';
import type { TierProgress } from '@/features/creator/tier';

const LABEL: Record<string, string> = { new: 'New', rising: 'Rising', verified: 'Verified', proven: 'Proven', elite: 'Elite' };
const views = (n: number) => new Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 }).format(n);

// Level card: current level + bonus, a bar to the next level, and what reaching it is worth.
export function LevelProgress({ p }: { p: TierProgress }) {
  const done = p.next == null || p.to == null;
  const ratio = done ? 1 : Math.min(1, Math.max(0, (p.views - p.from) / Math.max(1, p.to! - p.from)));
  return (
    <View style={styles.wrap} accessibilityRole="summary"
      accessibilityLabel={done ? `Level ${LABEL[p.tier]}, level tertinggi` : `Level ${LABEL[p.tier]}, ${views(p.toNext ?? 0)} qualified views lagi ke ${LABEL[p.next!]}`}>
      <View style={styles.head}>
        <Text style={styles.level}>Level {LABEL[p.tier]}</Text>
        <Text style={styles.bonus}>{p.bonusPct ? `Bonus +${p.bonusPct}%` : 'Belum ada bonus'}</Text>
      </View>
      <View style={styles.track}>
        <LinearGradient colors={gradient.card} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.fill, { width: `${Math.max(ratio * 100, 3)}%` }]} />
      </View>
      <Text style={styles.note}>
        {done ? 'Level tertinggi.' : `${views(p.toNext ?? 0)} views lagi ke ${LABEL[p.next!]} (+${p.nextBonusPct}%)`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: space.lg, gap: space.sm, borderRadius: radius.md, ...card },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  level: { ...type.label, color: color.text },
  bonus: { ...type.caption, color: color.link, fontVariant: ['tabular-nums'] },
  track: { height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.07)', overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  note: { ...type.caption, color: color.textSecondary, lineHeight: 18 },
});
