import { StyleSheet, Text, View } from 'react-native';
import { compact, idr } from '@/lib/format';
import { useQuery } from '@/lib/useQuery';
import { card, color, radius, space, type } from '@/theme/tokens';
import { fetchStandings, type ChallengeInfo } from './api';

const MEDAL = ['#F5C451', '#C9D1DC', '#D9925B'];

// Challenge detail: the prize per place, then live standings for creators who joined.
export function ChallengePrizes({ info }: { info: ChallengeInfo }) {
  return (
    <View style={styles.box}>
      {info.prizes.map((p, i) => (
        <View key={i} style={[styles.row, i === info.prizes.length - 1 && styles.last]}>
          <View style={[styles.place, i < 3 && { backgroundColor: MEDAL[i] + '26' }]}><Text style={[styles.placeText, i < 3 && { color: MEDAL[i] }]}>{i + 1}</Text></View>
          <Text style={styles.label}>Juara {i + 1}</Text>
          <Text style={styles.prize}>{idr(p)}</Text>
        </View>
      ))}
    </View>
  );
}

export function ChallengeStandings({ campaignId }: { campaignId: string }) {
  const q = useQuery(() => fetchStandings(campaignId, 10), [campaignId]);
  if (!q.data) return null;
  if (!q.data.length) return <Text style={styles.muted}>Belum ada klip yang lolos verifikasi. Jadilah yang pertama.</Text>;
  return (
    <View style={styles.box}>
      {q.data.map((s, i) => (
        <View key={`${s.rank}-${s.name}`} style={[styles.row, i === q.data!.length - 1 && styles.last, s.is_me && styles.me]}>
          <View style={styles.place}><Text style={styles.placeText}>{s.rank}</Text></View>
          <Text style={[styles.label, s.is_me && { color: color.link }]} numberOfLines={1}>{s.name}</Text>
          <Text style={styles.prize}>{compact(s.views)} views</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { ...card, borderRadius: radius.lg, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: color.border },
  last: { borderBottomWidth: 0 },
  me: { backgroundColor: 'rgba(117,178,244,0.08)' },
  place: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.06)' },
  placeText: { ...type.label, fontSize: 13, color: color.textSecondary, fontVariant: ['tabular-nums'] },
  label: { ...type.label, color: color.text, flex: 1 },
  prize: { ...type.label, color: color.text, fontVariant: ['tabular-nums'] },
  muted: { ...type.caption, color: color.textMuted },
});
