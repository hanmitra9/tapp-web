import Feather from '@expo/vector-icons/Feather';
import { LinearGradient } from 'expo-linear-gradient';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '@/components/Avatar';
import { LoadState } from '@/components/LoadState';
import { Screen } from '@/components/Screen';
import { TopBar } from '@/components/TopBar';
import { idr } from '@/lib/format';
import { useQuery } from '@/lib/useQuery';
import { color, radius, space, type } from '@/theme/tokens';
import { fetchAllTimeBoard, type AllTimeRow } from '@/features/campaigns/leaderboard';

const LEVEL: Record<string, string> = { new: 'New', rising: 'Rising', verified: 'Verified', proven: 'Proven', elite: 'Elite' };
// Metal per place: pillar gradient, edge highlight, number tint.
const METAL = {
  1: { colors: ['#FFF3C4', '#E2B84C', '#9A7420', '#5E4410'] as const, ring: '#F5C451', h: 230 },
  2: { colors: ['#F4F6FA', '#B9C0CC', '#7B8494', '#4A505C'] as const, ring: '#C9D1DE', h: 190 },
  3: { colors: ['#FFD9B8', '#C98A55', '#8A5328', '#55301A'] as const, ring: '#D99A63', h: 160 },
};

// All-time leaderboard (konten-style stage): gold/silver/bronze pillars for the top three, then the table.
export default function LeaderboardScreen() {
  const q = useQuery(() => fetchAllTimeBoard(30), []);
  if (!q.data) return <Screen scroll={false}><TopBar title="" back /><LoadState error={q.error} onRetry={q.reload} /></Screen>;
  const rows = q.data;
  const top = [rows.find((r) => r.rank === 2), rows.find((r) => r.rank === 1), rows.find((r) => r.rank === 3)];
  const rest = rows.filter((r) => r.rank > 3);
  const me = rows.find((r) => r.is_me);

  return (
    <Screen refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={q.refresh} tintColor={color.blue} />}>
      <TopBar title="" back />
      <View style={styles.pill}><Text style={styles.pillText}>All time</Text></View>
      <Text style={styles.title} accessibilityRole="header">LEADERBOARD</Text>
      <Text style={styles.sub}>Creator dengan payout terbesar sepanjang masa</Text>

      {rows.length ? (
        <>
          <View style={styles.stage}>
            <LinearGradient colors={['rgba(245,196,81,0)', 'rgba(245,196,81,0.22)', 'rgba(245,196,81,0.05)']} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFill} />
            <View style={styles.glow} />
            {top.map((r, i) => <Pillar key={i} r={r ?? null} place={([2, 1, 3] as const)[i]!} />)}
          </View>

          {me && me.rank > 3 ? (
            <View style={styles.meBar}>
              <Text style={styles.meRank}>#{me.rank}</Text>
              <Text style={styles.meText}>Posisi kamu</Text>
              <Text style={styles.mePay}>{idr(me.payout)}</Text>
            </View>
          ) : null}

          {rest.length ? (
            <View style={styles.table}>
              <View style={styles.thead}>
                <Text style={[styles.th, { width: 52 }]}>No</Text>
                <Text style={[styles.th, { flex: 1 }]}>Creator</Text>
                <Text style={[styles.th, { textAlign: 'right' }]}>Payout</Text>
              </View>
              {rest.map((r) => (
                <View key={r.rank} style={[styles.tr, r.is_me && styles.trMe]}>
                  <Text style={styles.no}>#{r.rank}</Text>
                  <Avatar uri={r.avatar_url} name={r.name} size={38} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name} numberOfLines={1}>{r.is_me ? 'Kamu' : r.name}</Text>
                    {r.tier ? <Text style={styles.level}>{LEVEL[r.tier] ?? r.tier}</Text> : null}
                  </View>
                  <Text style={styles.pay}>{idr(r.payout)}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </>
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Panggung masih kosong</Text>
          <Text style={styles.emptyText}>Klip pertama yang diterima langsung di puncak.</Text>
        </View>
      )}
    </Screen>
  );
}

function Pillar({ r, place }: { r: AllTimeRow | null; place: 1 | 2 | 3 }) {
  const m = METAL[place];
  return (
    <View style={styles.col}>
      {r ? (
        <View style={styles.who}>
          <View style={[styles.ring, { borderColor: m.ring }]}><Avatar uri={r.avatar_url} name={r.name} size={place === 1 ? 54 : 46} /></View>
          {r.tier ? <View style={styles.badge}><Feather name="check-circle" size={10} color={m.ring} /><Text style={styles.badgeText}>{LEVEL[r.tier] ?? r.tier}</Text></View> : null}
          <Text style={styles.podName} numberOfLines={1}>{r.is_me ? 'Kamu' : r.name}</Text>
          <Text style={styles.podPay} numberOfLines={1}><Text style={styles.podPayLabel}>Payout </Text>{idr(r.payout)}</Text>
        </View>
      ) : <View style={{ height: 40 }} />}
      <LinearGradient colors={m.colors} locations={[0, 0.3, 0.7, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.pillar, { height: m.h }]}>
        <LinearGradient colors={['rgba(255,255,255,0.55)', 'rgba(255,255,255,0)']} style={styles.pillarTop} />
        <Text style={[styles.num, { color: place === 2 ? '#5C6472' : place === 1 ? '#7A5A12' : '#6B3D1C' }]}>{place}</Text>
        <Feather name="award" size={18} color="rgba(255,255,255,0.55)" />
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { alignSelf: 'center', marginTop: space.lg, paddingHorizontal: 22, height: 40, borderRadius: radius.pill, justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(245,196,81,0.55)', backgroundColor: 'rgba(245,196,81,0.16)' },
  pillText: { ...type.label, fontSize: 15, color: '#F5D67A' },
  title: { fontFamily: type.display.fontFamily, fontWeight: '600', fontSize: 46, lineHeight: 52, letterSpacing: -1.5, color: '#EADDBB', textAlign: 'center', marginTop: space.lg },
  sub: { ...type.body, color: color.textSecondary, textAlign: 'center', marginTop: space.xs },
  stage: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: space.sm, marginTop: space.xl, marginHorizontal: -space.xl,
    paddingHorizontal: space.lg, paddingTop: space.xl, overflow: 'hidden' },
  glow: { position: 'absolute', bottom: -60, left: '20%', right: '20%', height: 200, borderRadius: 200, backgroundColor: 'rgba(245,196,81,0.18)',
    filter: 'blur(40px)' } as object,
  col: { flex: 1, alignItems: 'center', maxWidth: 130 },
  who: { alignItems: 'center', gap: 3, marginBottom: space.sm, width: '100%' },
  ring: { borderWidth: 2, borderRadius: 999, padding: 2 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 },
  badgeText: { ...type.caption, fontSize: 10, color: color.textSecondary },
  podName: { ...type.label, fontSize: 14, color: color.text, maxWidth: '100%' },
  podPay: { ...type.label, fontSize: 12, color: color.success, fontVariant: ['tabular-nums'] },
  podPayLabel: { ...type.caption, fontSize: 10, color: color.textMuted },
  pillar: { width: '100%', borderTopLeftRadius: 8, borderTopRightRadius: 8, alignItems: 'center', paddingTop: space.lg, gap: 2, overflow: 'hidden' },
  pillarTop: { position: 'absolute', left: 0, right: 0, top: 0, height: 14 },
  num: { fontFamily: type.display.fontFamily, fontWeight: '700', fontSize: 52, lineHeight: 58, textShadow: '0 1px 0 rgba(255,255,255,0.6)' } as object,
  meBar: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.lg, padding: space.md, borderRadius: radius.md,
    borderWidth: 1, borderColor: 'rgba(117,178,244,0.35)', backgroundColor: color.accentSoft },
  meRank: { ...type.heading, color: color.link },
  meText: { ...type.label, color: color.text, flex: 1 },
  mePay: { ...type.label, color: color.success, fontVariant: ['tabular-nums'] },
  table: { marginTop: space.lg, borderRadius: radius.lg, borderWidth: 1, borderColor: color.border, backgroundColor: '#0C0C10', overflow: 'hidden' },
  thead: { flexDirection: 'row', paddingHorizontal: space.lg, paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: color.border, backgroundColor: '#121218' },
  th: { ...type.label, color: color.textSecondary },
  tr: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: color.border },
  trMe: { backgroundColor: 'rgba(12,101,196,0.12)' },
  no: { ...type.heading, width: 40, color: color.text, fontVariant: ['tabular-nums'] },
  name: { ...type.label, color: color.text },
  level: { ...type.caption, fontSize: 11, color: color.textMuted },
  pay: { ...type.label, color: color.success, fontVariant: ['tabular-nums'] },
  empty: { marginTop: space.xxl, gap: space.sm, alignItems: 'center' },
  emptyTitle: { ...type.heading, color: color.text },
  emptyText: { ...type.body, color: color.textMuted, textAlign: 'center', maxWidth: 320 },
});
