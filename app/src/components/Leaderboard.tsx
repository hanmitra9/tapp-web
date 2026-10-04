import Feather from '@expo/vector-icons/Feather';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';
import { compact } from '@/lib/format';
import { color, radius, space, type, card } from '@/theme/tokens';

export type Entry = { rank: number; title: string; subtitle?: string | null; value: number; me: boolean };

const MEDAL = {
  1: { ring: ['#FFE7A3', '#F5C451', '#B8862B'] as const, text: '#F5C451', stage: 132 },
  2: { ring: ['#F2F6FB', '#C9D3E0', '#8D99AA'] as const, text: '#C9D3E0', stage: 98 },
  3: { ring: ['#F6C9A8', '#D99A6C', '#9A6440'] as const, text: '#D99A6C', stage: 76 },
} as const;
const initials = (t: string) => (t === 'Kamu' ? 'K' : t.replace(/[^A-Za-z0-9 ]/g, '').trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '•');

// Top three on a stage: #2 left, #1 centre (tallest, spotlight + award), #3 right. Empty places stay as dim plinths.
export function Podium({ entries, unit = 'views' }: { entries: Entry[]; unit?: string }) {
  const by = (r: 1 | 2 | 3) => entries.find((e) => e.rank === r) ?? null;
  return (
    <View style={styles.podium}>
      <View style={styles.spot} pointerEvents="none" {...({ dataSet: { tapp: 'spotlight' } } as object)} />
      {([2, 1, 3] as const).map((r) => <Place key={r} r={r} e={by(r)} unit={unit} />)}
    </View>
  );
}

function Place({ r, e, unit }: { r: 1 | 2 | 3; e: Entry | null; unit: string }) {
  const m = MEDAL[r];
  return (
    <View style={styles.place}>
      <View style={styles.who}>
        {r === 1 ? <Feather name="award" size={22} color={m.text} style={{ marginBottom: 4 }} /> : null}
        <LinearGradient colors={e?.me ? ['#9CCBFF', '#2F86E8', '#0C4F92'] : m.ring} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={[styles.ring, r === 1 && styles.ringBig, !e && { opacity: 0.25 }]}>
          <View style={[styles.face, r === 1 && styles.faceBig]}>
            <Text style={[styles.faceText, r === 1 && { fontSize: 22 }]}>{e ? initials(e.title) : '?'}</Text>
          </View>
        </LinearGradient>
        <Text style={[styles.name, e?.me && { color: color.link }]} numberOfLines={1}>{e ? e.title : 'Kosong'}</Text>
        {e?.subtitle ? <Text style={styles.sub} numberOfLines={1}>{e.subtitle}</Text> : null}
        <Text style={[styles.value, { color: e ? m.text : color.textMuted }]}>{e ? `${compact(e.value)} ${unit}` : '—'}</Text>
      </View>
      <LinearGradient colors={['rgba(47,134,232,0.55)', 'rgba(12,64,120,0.35)', 'rgba(8,20,38,0.15)']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
        style={[styles.stage, { height: m.stage }]} {...({ dataSet: { tapp: 'stage' } } as object)}>
        <View style={[styles.stageEdge, { backgroundColor: m.text }]} />
        <Text style={[styles.stageNum, { color: m.text }]}>{r}</Text>
      </LinearGradient>
    </View>
  );
}

// Ranks 4+ as rows; the caller's row highlighted.
export function LeaderList({ entries, unit = 'views', from = 4 }: { entries: Entry[]; unit?: string; from?: number }) {
  const rest = entries.filter((e) => e.rank >= from);
  if (!rest.length) return null;
  return (
    <View style={styles.list}>
      {rest.map((e, i) => (
        <View key={`${e.rank}-${e.title}`} style={[styles.row, e.me && styles.rowMe, i > 0 && rest[i - 1]!.rank + 1 !== e.rank && styles.gapAbove]}>
          <Text style={styles.rank}>{e.rank}</Text>
          <View style={[styles.dot, e.me && { backgroundColor: color.blue }]}><Text style={styles.dotText}>{initials(e.title)}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowTitle, e.me && { color: color.text }]} numberOfLines={1}>{e.title}</Text>
            {e.subtitle ? <Text style={styles.sub} numberOfLines={1}>{e.subtitle}</Text> : null}
          </View>
          <Text style={styles.rowValue}>{compact(e.value)} <Text style={styles.sub}>{unit}</Text></Text>
        </View>
      ))}
    </View>
  );
}

// "Kamu #5 · 42 rb views lagi untuk naik ke #4", or an invitation when the caller isn't ranked yet.
export function MyStanding({ entries, unit = 'views', empty }: { entries: Entry[]; unit?: string; empty: string }) {
  const me = entries.find((e) => e.me);
  const above = me ? entries.find((e) => e.rank === me.rank - 1) : null;
  const text = !me ? empty
    : me.rank === 1 ? 'Kamu di puncak minggu ini. Pertahankan!'
    : above ? `${compact(Math.max(above.value - me.value + 1, 1))} ${unit} lagi untuk naik ke #${above.rank}.` : `Kamu di peringkat #${me.rank}.`;
  return (
    <View style={styles.standing}>
      <View style={styles.standingBadge}><Text style={styles.standingRank}>{me ? `#${me.rank}` : '—'}</Text></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.standingTitle}>{me ? 'Posisimu' : 'Belum masuk peringkat'}</Text>
        <Text style={styles.standingText}>{text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  podium: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, paddingTop: space.xl, position: 'relative' },
  spot: { position: 'absolute', left: '25%', right: '25%', top: -10, bottom: 40, borderRadius: 999 },
  place: { flex: 1, alignItems: 'center' },
  who: { alignItems: 'center', gap: 4, paddingBottom: space.md, width: '100%' },
  ring: { width: 60, height: 60, borderRadius: 30, padding: 3 },
  ringBig: { width: 78, height: 78, borderRadius: 39 },
  face: { flex: 1, borderRadius: 30, backgroundColor: '#0B1220', alignItems: 'center', justifyContent: 'center' },
  faceBig: { borderRadius: 39 },
  faceText: { ...type.heading, color: '#FFFFFF' },
  name: { ...type.label, color: color.text, marginTop: 4, maxWidth: '100%' },
  sub: { ...type.caption, fontSize: 12, color: color.textMuted },
  value: { ...type.caption, fontFamily: type.label.fontFamily, fontVariant: ['tabular-nums'] },
  stage: { width: '100%', borderTopLeftRadius: radius.md, borderTopRightRadius: radius.md, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderBottomWidth: 0, borderColor: 'rgba(117,178,244,0.25)', overflow: 'hidden' },
  stageEdge: { position: 'absolute', top: 0, left: 0, right: 0, height: 3, opacity: 0.9 },
  stageNum: { ...type.display, fontSize: 40, lineHeight: 44, opacity: 0.9 },

  list: { marginTop: space.md, gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm + 2, paddingHorizontal: space.md, borderRadius: radius.md, ...card },
  rowMe: { borderWidth: 1, borderColor: color.blue, backgroundColor: 'rgba(12,101,196,0.14)' },
  gapAbove: { marginTop: space.md },
  rank: { ...type.label, color: color.textMuted, width: 26, fontVariant: ['tabular-nums'] },
  dot: { width: 34, height: 34, borderRadius: 17, backgroundColor: color.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  dotText: { ...type.caption, color: '#FFFFFF', fontFamily: type.label.fontFamily },
  rowTitle: { ...type.label, color: color.textSecondary },
  rowValue: { ...type.label, color: color.text, fontVariant: ['tabular-nums'] },

  standing: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.md, marginTop: space.lg,
    backgroundColor: 'rgba(12,101,196,0.12)', borderWidth: 1, borderColor: 'rgba(117,178,244,0.25)' },
  standingBadge: { minWidth: 48, height: 48, paddingHorizontal: 8, borderRadius: 24, backgroundColor: color.blue, alignItems: 'center', justifyContent: 'center' },
  standingRank: { ...type.heading, color: '#FFFFFF', fontVariant: ['tabular-nums'] },
  standingTitle: { ...type.label, color: color.text },
  standingText: { ...type.caption, color: color.textSecondary, lineHeight: 18 },
});
