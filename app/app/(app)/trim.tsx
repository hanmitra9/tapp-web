import { useLocalSearchParams } from 'expo-router';
import { Platform, StyleSheet, Text } from 'react-native';
import { LoadState } from '@/components/LoadState';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { TopBar } from '@/components/TopBar';
import { useQuery } from '@/lib/useQuery';
import { assetLink, fetchAssets } from '@/features/campaigns/api';
import { VideoTrimmer } from '@/features/campaigns/VideoTrimmer';
import { color, space, type } from '@/theme/tokens';

// Potong video: trim a campaign's raw video to a 9:16 clip right in the browser. /trim?c=<campaign>&a=<asset>
export default function TrimScreen() {
  const { c, a } = useLocalSearchParams<{ c: string; a: string }>();
  const q = useQuery(async () => {
    const asset = (await fetchAssets(c)).find((x) => x.id === a);
    if (!asset?.storage_path) throw { code: 'asset_not_found' };
    return { asset, src: (await assetLink(asset))! };
  }, [c, a]);
  return (
    <Screen width="narrow">
      <TopBar title="Potong video" back />
      {Platform.OS !== 'web' ? <Notice tone="info" message="Potong video tersedia di versi web TAPP." />
        : !q.data ? <LoadState error={q.error} onRetry={q.reload} /> : (
          <>
            <Text style={styles.title} numberOfLines={2}>{q.data.asset.title}</Text>
            <Text style={styles.sub}>Pilih bagian terbaik, atur bingkai 9:16, lalu simpan. Tambah teks & musik di CapCut kalau perlu.</Text>
            <VideoTrimmer src={q.data.src} title={q.data.asset.title} />
          </>
        )}
    </Screen>
  );
}
const styles = StyleSheet.create({
  title: { ...type.heading, color: color.text, marginTop: space.lg },
  sub: { ...type.caption, color: color.textMuted, marginTop: space.xs, marginBottom: space.lg },
});
