import { memo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { cpmLabel, deadlineLabel, idrCompact, isUrgent } from '@/lib/format';
import { color, radius, space, type } from '@/theme/tokens';
import type { FeedItem } from './api';
import { categoryLabel, platformsLabel } from './copy';

// Dark card: brand monogram + reward on the right, like a transaction row grown into a card.
export const CampaignCard = memo(function CampaignCard({ item, onPress, showReason = true }: { item: FeedItem; onPress: () => void; showReason?: boolean }) {
  const deadline = deadlineLabel(item.submission_deadline ?? item.ends_at);
  const urgent = isUrgent(item.submission_deadline ?? item.ends_at);
  const initials = item.brand_name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${item.title}, ${item.brand_name}`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      {item.banner_url ? <Image source={{ uri: item.banner_url }} style={styles.banner} resizeMode="cover" accessibilityIgnoresInvertColors /> : null}
      <View style={styles.top}>
        <View style={styles.mono}><Text style={styles.monoText}>{initials}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.brand} numberOfLines={1}>{item.brand_name}</Text>
          <Text style={styles.meta} numberOfLines={1}>{categoryLabel(item.category)} · {platformsLabel(item.platforms)}</Text>
        </View>
        {item.joined ? <Text style={styles.joined}>Bergabung</Text> : null}
      </View>
      <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
      <View style={styles.facts}>
        <View style={{ gap: 2 }}>
          <Text style={styles.factValue}>{cpmLabel(item.cpm)}</Text>
          <Text style={styles.factLabel}>Sisa budget {idrCompact(item.remaining)}</Text>
        </View>
        {deadline ? <Text style={[styles.deadline, urgent && styles.urgent]}>{deadline}</Text> : null}
      </View>
      {showReason && item.match_reasons[0] ? <Text style={styles.reason}>{item.match_reasons[0]}</Text> : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: { backgroundColor: color.surface, borderRadius: radius.lg, padding: space.lg, gap: space.md, overflow: 'hidden' },
  banner: { marginTop: -space.lg, marginHorizontal: -space.lg, aspectRatio: 2, backgroundColor: color.surfaceRaised },
  pressed: { backgroundColor: color.surfaceRaised },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  mono: { width: 40, height: 40, borderRadius: 20, backgroundColor: color.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  monoText: { ...type.label, color: color.text },
  brand: { ...type.label, color: color.text },
  meta: { ...type.caption, color: color.textMuted },
  joined: { ...type.caption, color: color.success, fontFamily: type.label.fontFamily },
  title: { ...type.heading, fontSize: 18, lineHeight: 24, color: color.text },
  facts: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  factValue: { ...type.heading, color: color.success, fontVariant: ['tabular-nums'] },
  factLabel: { ...type.caption, color: color.textMuted, fontVariant: ['tabular-nums'] },
  deadline: { ...type.caption, color: color.textSecondary },
  urgent: { color: color.warning },
  reason: { ...type.caption, color: color.blueLight, backgroundColor: color.accentSoft, alignSelf: 'flex-start',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, overflow: 'hidden' },
});
