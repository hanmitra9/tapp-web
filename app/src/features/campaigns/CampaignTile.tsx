import Feather from '@expo/vector-icons/Feather';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { memo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { idr } from '@/lib/format';
import { color, radius, space, type, card } from '@/theme/tokens';
import { web } from '@/theme/web';
import type { FeedItem } from './api';
import { categoryLabel, contentTypeLabel } from './copy';

const ICON: Record<string, string> = { tiktok: 'tiktok', instagram: 'instagram', youtube: 'youtube', x: 'x-twitter', facebook: 'facebook' };

// Compact grid card (two per row on phones): banner, brand + type, title, rate, platforms, category, joined, budget left.
export const CampaignTile = memo(function CampaignTile({ item, onPress }: { item: FeedItem; onPress: () => void }) {
  const left = item.budget > 0 ? Math.max(0, Math.min(1, item.remaining / item.budget)) : 0;
  const kind = item.content_type;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${item.title}, ${item.brand_name}`}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.88 }]} {...web('lift')}>
      <View style={styles.banner} {...(item.banner_url ? {} : web('art'))}>
        {item.banner_url ? <Image source={{ uri: item.banner_url }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityIgnoresInvertColors />
          : <Image source={require('../../../assets/tapp-mark-white.png')} style={styles.mark} accessibilityIgnoresInvertColors />}
        {item.joined ? <Text style={styles.joined}>Bergabung</Text> : null}
      </View>
      <View style={styles.body}>
        <View style={styles.brandRow}>
          {item.brand_logo ? <Image source={{ uri: item.brand_logo }} style={styles.mono} accessibilityIgnoresInvertColors />
            : <View style={styles.mono}><Text style={styles.monoText}>{item.brand_name.slice(0, 1).toUpperCase()}</Text></View>}
          <Text style={styles.brand} numberOfLines={1}>{item.brand_name}</Text>
          {kind ? <Text style={styles.tag} numberOfLines={1}>{contentTypeLabel(kind).toUpperCase()}</Text> : null}
        </View>
        <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.rate}>{idr(item.cpm)}<Text style={styles.unit}> / 1K views</Text></Text>
        <View style={styles.meta}>
          {item.platforms.map((p) => <FontAwesome6 key={p} name={ICON[p] ?? 'link'} brand size={12} color={color.textSecondary} />)}
          <Text style={styles.tag} numberOfLines={1}>{categoryLabel(item.category).toUpperCase()}</Text>
          {item.creators_joined ? <View style={styles.count}><Feather name="users" size={10} color={color.textSecondary} /><Text style={styles.countText}>{item.creators_joined}</Text></View> : null}
        </View>
        <View style={styles.budgetRow}><Text style={styles.budgetLabel}>Budget tersisa</Text><Text style={styles.budgetLabel}>{Math.round(left * 100)}%</Text></View>
        <View style={styles.track}><View style={[styles.fill, { width: `${Math.max(left * 100, 2)}%` }]} /></View>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: { ...card, borderRadius: radius.lg, overflow: 'hidden', flex: 1 },
  banner: { aspectRatio: 1.75, backgroundColor: color.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  mark: { width: 34, height: 34, opacity: 0.95 },
  joined: { position: 'absolute', top: 8, left: 8, ...type.caption, fontSize: 10, color: '#FFFFFF', paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: radius.pill, backgroundColor: 'rgba(52,208,122,0.45)', overflow: 'hidden' },
  body: { padding: space.md, gap: 6 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  mono: { width: 18, height: 18, borderRadius: 9, backgroundColor: color.accentSoft, alignItems: 'center', justifyContent: 'center' },
  monoText: { fontSize: 10, fontFamily: type.label.fontFamily, color: color.link },
  brand: { ...type.caption, fontSize: 12, color: color.text, flex: 1 },
  tag: { fontSize: 9, letterSpacing: 0.3, fontFamily: type.label.fontFamily, color: color.textSecondary, paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.07)', overflow: 'hidden', maxWidth: 90 },
  title: { ...type.label, fontSize: 15, color: color.text },
  rate: { ...type.label, fontSize: 15, color: color.text, fontVariant: ['tabular-nums'] },
  unit: { ...type.caption, fontSize: 11, color: color.textMuted },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  count: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.07)' },
  countText: { fontSize: 10, fontFamily: type.label.fontFamily, color: color.textSecondary, fontVariant: ['tabular-nums'] },
  budgetRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  budgetLabel: { ...type.caption, fontSize: 11, color: color.textMuted, fontVariant: ['tabular-nums'] },
  track: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2, backgroundColor: color.blueLight },
});
