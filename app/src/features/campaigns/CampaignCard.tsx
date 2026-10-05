import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { LinearGradient } from 'expo-linear-gradient';
import { memo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { deadlineLabel, idr, isUrgent } from '@/lib/format';
import { color, radius, space, type, card } from '@/theme/tokens';
import type { FeedItem } from './api';
import { categoryLabel } from './copy';
import { JoinedRow } from './JoinedRow';
import { web } from '@/theme/web';

const ICON: Record<string, string> = { tiktok: 'tiktok', instagram: 'instagram', youtube: 'youtube', x: 'x-twitter', facebook: 'facebook' };

// Campaign card: banner with the rate and deadline on it, brand + title, platforms, budget left, who's in.
export const CampaignCard = memo(function CampaignCard({ item, onPress }: { item: FeedItem; onPress: () => void }) {
  const deadline = deadlineLabel(item.submission_deadline ?? item.ends_at);
  const urgent = isUrgent(item.submission_deadline ?? item.ends_at);
  const initials = item.brand_name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');
  const left = item.budget > 0 ? Math.max(0, Math.min(1, item.remaining / item.budget)) : 0;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${item.title}, ${item.brand_name}`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]} {...web('lift')}>
      <View style={styles.banner} {...(item.banner_url ? {} : web('art'))}>
        {item.banner_url ? <Image source={{ uri: item.banner_url }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityIgnoresInvertColors />
          : <Image source={require('../../../assets/tapp-mark-white.png')} style={styles.artMark} accessibilityIgnoresInvertColors />}
        <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(5,8,14,0.8)']} start={{ x: 0, y: 0.45 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
        <View style={styles.bannerTop}>
          <View style={styles.rate}><Text style={styles.rateValue}>{idr(item.cpm)}</Text><Text style={styles.rateUnit}>/1K views</Text></View>
          {deadline ? <Text style={[styles.pill, urgent && styles.pillUrgent]}>{deadline}</Text> : null}
        </View>
        <View style={styles.bannerBottom}>
          <View style={styles.mono}><Text style={styles.monoText}>{initials}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.brand} numberOfLines={1}>{item.brand_name}</Text>
            <Text style={styles.cat} numberOfLines={1}>{categoryLabel(item.category)}</Text>
          </View>
          {item.joined ? <Text style={styles.joined}>Bergabung</Text> : null}
        </View>
      </View>

      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
        <View style={styles.row}>
          <View style={styles.plats}>
            {item.platforms.map((p) => <View key={p} style={styles.plat}><FontAwesome6 name={ICON[p] ?? 'link'} brand size={12} color={color.text} /></View>)}
          </View>
          <Text style={styles.budget}>Sisa budget {Math.round(left * 100)}%</Text>
        </View>
        <View style={styles.track}><View style={[styles.fill, { width: `${Math.max(left * 100, 2)}%` }]} /></View>
        <JoinedRow count={item.creators_joined ?? 0} initials={item.joined_initials} />
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: { ...card, borderRadius: radius.lg, overflow: 'hidden' },
  pressed: { opacity: 0.88, transform: [{ scale: 0.99 }] },
  banner: { aspectRatio: 1.9, backgroundColor: color.surfaceRaised, justifyContent: 'space-between', padding: space.md },
  artMark: { position: 'absolute', right: '14%', top: '38%', width: 52, height: 52, marginTop: -26, opacity: 0.95 },
  bannerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  rate: { flexDirection: 'row', alignItems: 'baseline', gap: 3, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill,
    backgroundColor: 'rgba(5,10,20,0.62)', borderWidth: 1, borderColor: 'rgba(52,208,122,0.45)' },
  rateValue: { ...type.label, fontSize: 14, color: color.success, fontVariant: ['tabular-nums'] },
  rateUnit: { ...type.caption, fontSize: 11, color: 'rgba(255,255,255,0.75)' },
  pill: { ...type.caption, fontSize: 12, color: '#FFFFFF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill,
    backgroundColor: 'rgba(5,10,20,0.55)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', overflow: 'hidden' },
  pillUrgent: { color: color.warning, borderColor: 'rgba(255,176,32,0.5)' },
  bannerBottom: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  mono: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center' },
  monoText: { ...type.label, fontSize: 13, color: '#FFFFFF' },
  brand: { ...type.label, color: '#FFFFFF' },
  cat: { ...type.caption, fontSize: 12, color: 'rgba(255,255,255,0.72)' },
  joined: { ...type.caption, fontSize: 12, color: '#FFFFFF', fontFamily: type.label.fontFamily, paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: radius.pill, backgroundColor: 'rgba(52,208,122,0.35)', overflow: 'hidden' },
  body: { padding: space.lg, gap: space.md },
  title: { ...type.heading, fontSize: 18, lineHeight: 24, color: color.text },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  plats: { flexDirection: 'row', gap: 6 },
  plat: { width: 28, height: 28, borderRadius: 14, backgroundColor: color.surfaceRaised, borderWidth: 1, borderColor: color.border, alignItems: 'center', justifyContent: 'center' },
  budget: { ...type.caption, color: color.textSecondary, fontVariant: ['tabular-nums'] },
  track: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.07)', overflow: 'hidden', marginTop: -4 },
  fill: { height: 4, borderRadius: 2, backgroundColor: color.blueLight },
  reason: { ...type.caption, color: color.blueLight, backgroundColor: color.accentSoft, alignSelf: 'flex-start',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, overflow: 'hidden' },
});
