import Feather from '@expo/vector-icons/Feather';
import { StyleSheet, Text, View } from 'react-native';
import { compact, dateLabel, idr } from '@/lib/format';
import { useQuery } from '@/lib/useQuery';
import { card, color, radius, space, type } from '@/theme/tokens';
import { fetchForecast } from './api';

// "Prediksi views": where the campaign lands at today's pace (last 7 days), until the end date or until the
// budget runs out, whichever comes first. An estimate, said plainly.
export function ForecastCard({ campaignId }: { campaignId: string }) {
  const q = useQuery(() => fetchForecast(campaignId), [campaignId]);
  const f = q.data;
  if (!f) return null;
  const gain = Math.max(0, f.projected_views - f.qualified_views);
  const until = f.budget_runout_at ? `budget habis ±${dateLabel(f.budget_runout_at)}` : f.ends_at ? `sampai ${dateLabel(f.ends_at)}` : `${f.horizon_days} hari ke depan`;
  return (
    <View style={styles.box}>
      <View style={styles.head}>
        <Feather name="trending-up" size={15} color={color.success} />
        <Text style={styles.title}>Prediksi views</Text>
      </View>
      {!f.enough_data ? <Text style={styles.body}>Belum ada views baru 7 hari terakhir, jadi prediksi belum bisa dihitung.</Text> : (
        <>
          <Text style={styles.big}>{compact(f.projected_views)} <Text style={styles.unit}>views</Text></Text>
          <Text style={styles.body}>+{compact(gain)} lagi · {until}</Text>
          <View style={styles.row}>
            <Text style={styles.cap}>±{compact(f.daily_views)} views/hari</Text>
            <Text style={styles.cap}>±{idr(f.daily_spend)}/hari</Text>
          </View>
          <Text style={styles.note}>Perkiraan dari kecepatan 7 hari terakhir; angka sebenarnya bisa naik atau turun.</Text>
        </>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  box: { ...card, borderRadius: radius.lg, padding: space.lg, gap: space.xs, marginTop: space.lg },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: space.xs },
  title: { ...type.label, color: color.text, fontSize: 15 },
  big: { ...type.metric, fontSize: 28, color: color.text },
  unit: { ...type.caption, color: color.textMuted },
  body: { ...type.caption, color: color.textSecondary },
  row: { flexDirection: 'row', gap: space.lg, marginTop: space.xs },
  cap: { ...type.caption, color: color.textMuted, fontVariant: ['tabular-nums'] },
  note: { ...type.caption, fontSize: 11, color: color.textMuted, marginTop: space.xs },
});
