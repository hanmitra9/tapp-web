import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBadge } from '@/components/StatusBadge';
import { compact, idr } from '@/lib/format';
import { color, radius, space, type } from '@/theme/tokens';
import { BRAND_STATUS, type BrandCampaign } from './api';

// Campaign card with budget burn — the brand's primary question is "how far did my budget go?"
export function BrandCampaignRow({ c }: { c: BrandCampaign }) {
  const used = c.budget ? Math.min(1, c.spent / c.budget) : 0;
  const st = BRAND_STATUS[c.status];
  return (
    <Pressable onPress={() => router.push({ pathname: '/brand-campaign/[id]', params: { id: c.id } })} accessibilityRole="button"
      style={({ pressed }) => [styles.card, pressed && { backgroundColor: color.surfaceRaised }]}>
      <View style={styles.top}>
        <Text style={styles.title} numberOfLines={1}>{c.title}</Text>
        <StatusBadge label={st.label} tone={st.tone} />
      </View>
      <View style={styles.metrics}>
        <Metric label="Qualified views" value={compact(c.qualified_views)} />
        <Metric label="Klip disetujui" value={String(c.approved)} />
        <Metric label="Kreator" value={String(c.creators_joined)} />
      </View>
      <View style={styles.track}><View style={[styles.fill, { width: `${Math.max(used * 100, 1)}%` }, used >= 0.9 && { backgroundColor: color.warning }]} /></View>
      <View style={styles.budget}>
        <Text style={styles.caption}>{idr(c.spent)} dari {idr(c.budget)}</Text>
        <Text style={styles.caption}>{Math.round(used * 100)}% terpakai</Text>
      </View>
    </Pressable>
  );
}
function Metric({ label, value }: { label: string; value: string }) {
  return <View style={{ flex: 1, gap: 2 }}><Text style={styles.value}>{value}</Text><Text style={styles.caption}>{label}</Text></View>;
}
const styles = StyleSheet.create({
  card: { backgroundColor: color.surface, borderRadius: radius.lg, padding: space.lg, gap: space.md },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.md },
  title: { ...type.heading, color: color.text, flex: 1 },
  metrics: { flexDirection: 'row' },
  value: { ...type.heading, color: color.text, fontVariant: ['tabular-nums'] },
  caption: { ...type.caption, color: color.textMuted, fontVariant: ['tabular-nums'] },
  track: { height: 6, borderRadius: 3, backgroundColor: color.surfaceRaised, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3, backgroundColor: color.blue },
  budget: { flexDirection: 'row', justifyContent: 'space-between' },
});
