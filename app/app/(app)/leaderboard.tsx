import { useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Header } from '@/components/Header';
import { LeaderList, MyStanding, Podium, type Entry } from '@/components/Leaderboard';
import { LoadState } from '@/components/LoadState';
import { Screen } from '@/components/Screen';
import { Segmented } from '@/components/Segmented';
import { useQuery } from '@/lib/useQuery';
import { color, space, type } from '@/theme/tokens';
import { fetchCityBoard, fetchWeeklyBoard } from '@/features/campaigns/leaderboard';

// TAPP-wide weekly boards: top creators (masked, with city) and top cities.
export default function LeaderboardScreen() {
  const [tab, setTab] = useState<'creator' | 'city'>('creator');
  const q = useQuery(async () => {
    const [creators, cities] = await Promise.all([fetchWeeklyBoard(), fetchCityBoard()]);
    return { creators, cities };
  }, []);
  if (!q.data) return <Screen scroll={false}><Header title="Peringkat" /><LoadState error={q.error} onRetry={q.reload} /></Screen>;
  const entries: Entry[] = tab === 'creator'
    ? q.data.creators.map((r) => ({ rank: r.rank, title: r.name, subtitle: r.city, value: r.views, me: r.is_me }))
    : q.data.cities.map((r) => ({ rank: r.rank, title: r.city, subtitle: `${r.creators} creator`, value: r.views, me: r.is_mine }));

  return (
    <Screen refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={q.refresh} tintColor={color.blue} />}>
      <Header title="Peringkat" subtitle="Qualified views 7 hari terakhir." />
      <Segmented options={[{ value: 'creator', label: 'Creator' }, { value: 'city', label: 'Kota' }]} value={tab} onChange={(v) => setTab(v as 'creator' | 'city')} />
      {entries.length ? (
        <>
          <Podium entries={entries} />
          <MyStanding entries={entries} empty={tab === 'creator' ? 'Klip diterima = masuk papan.' : 'Isi kota di Profil.'} />
          <LeaderList entries={entries} />
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

const styles = StyleSheet.create({
  empty: { marginTop: space.xxl, gap: space.sm, alignItems: 'center' },
  emptyTitle: { ...type.heading, color: color.text },
  emptyText: { ...type.body, color: color.textMuted, textAlign: 'center', maxWidth: 320 },
});
