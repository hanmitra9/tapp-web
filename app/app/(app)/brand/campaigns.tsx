import { RefreshControl, StyleSheet, View } from 'react-native';
import { EmptyState } from '@/components/EmptyState';
import { Header } from '@/components/Header';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { CardSkeleton } from '@/components/Skeleton';
import { useQuery } from '@/lib/useQuery';
import { color, space } from '@/theme/tokens';
import { fetchBrandCampaigns } from '@/features/brand/api';
import { BrandCampaignRow } from '@/features/brand/BrandCampaignRow';

export default function BrandCampaigns() {
  const q = useQuery(fetchBrandCampaigns, []);
  return (
    <Screen inTabs refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={q.refresh} tintColor={color.blue} />}>
      <Header title="Campaign" subtitle="Semua campaign brand-mu. Ketuk untuk melihat laporan lengkap." back={false} />
      {q.error && !q.data ? <Notice tone="error" message={q.error} /> : null}
      <View style={styles.list}>
        {!q.data && !q.error ? [0, 1].map((i) => <CardSkeleton key={i} />) : null}
        {q.data && !q.data.length ? <EmptyState title="Belum ada campaign" body="Hubungi tim TAPP untuk menyiapkan campaign pertamamu." /> : null}
        {q.data?.map((c) => <BrandCampaignRow key={c.id} c={c} />)}
      </View>
    </Screen>
  );
}
const styles = StyleSheet.create({ list: { gap: space.md } });
