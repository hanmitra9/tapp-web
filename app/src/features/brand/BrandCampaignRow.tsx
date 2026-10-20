import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBadge } from '@/components/StatusBadge';
import { compact, idr } from '@/lib/format';
import { web } from '@/theme/web';
import { color, radius, space, type, card } from '@/theme/tokens';
import { BRAND_STATUS, type BrandCampaign } from './api';

// Campaign card: price, results, and how much budget is left.
export function BrandCampaignRow({ c }: { c: BrandCampaign }) {
  const used = c.budget ? Math.min(1, c.spent / c.budget) : 0;
  const st = BRAND_STATUS[c.status];
  return (
    <Pressable onPress={() => router.push({ pathname: '/brand-campaign/[id]', params: { id: c.id } })} accessibilityRole="button"
      style={({ pressed }) => [styles.card, pressed && { backgroundColor: color.surfaceRaised }]}>
      <View style={styles.top}>
        <View style={styles.initial}><Text style={styles.initialText}>{c.title.trim().charAt(0).toUpperCase()}</Text></View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.title} numberOfLines={1}>{c.title}</Text>
          <Text style={styles.caption}>{idr(c.cpm)} / 1K views</Text>
        </View>
        <StatusBadge label={st.label} tone={st.tone} />
      </View>
      <View style={styles.metrics}>
        <Metric icon="eye" value={compact(c.qualified_views)} label="Views" />
        <Metric icon="film" value={compact(c.submissions)} label="Video" />
        <Metric icon="users" value={compact(c.creators_joined)} label="Kreator" />
      </View>
      <View style={styles.track} {...web('track')}><View style={[styles.fill, { width: `${Math.max(used * 100, 1)}%` }]} {...web(used >= 0.9 ? 'seg-p' : 'seg-q')} /></View>
      <View style={styles.budget}>
        <Text style={styles.caption}>{idr(c.spent)} / {idr(c.budget)}</Text>
        <Text style={styles.left}>Sisa {Math.round((1 - used) * 100)}%</Text>
      </View>
    </Pressable>
  );
}
function Metric({ icon, value, label }: { icon: 'eye' | 'film' | 'users'; value: string; label: string }) {
  return (
    <View style={styles.metric}>
      <Feather name={icon} size={13} color={color.textMuted} />
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.caption}>{label}</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  card: { ...card, borderRadius: radius.lg, padding: space.lg, gap: space.md },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  initial: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: color.accentSoft,
    borderWidth: 1, borderColor: 'rgba(117,178,244,0.25)' },
  initialText: { ...type.heading, color: color.link },
  title: { ...type.label, fontSize: 15, color: color.text },
  metrics: { flexDirection: 'row', gap: space.lg },
  metric: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  value: { ...type.label, color: color.text, fontVariant: ['tabular-nums'] },
  caption: { ...type.caption, color: color.textMuted, fontVariant: ['tabular-nums'] },
  left: { ...type.caption, color: color.text, fontVariant: ['tabular-nums'] },
  track: { height: 6, borderRadius: 3, backgroundColor: color.surfaceRaised, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3, backgroundColor: color.blue },
  budget: { flexDirection: 'row', justifyContent: 'space-between' },
});
