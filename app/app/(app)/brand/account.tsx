import { useState } from 'react';
import { Linking, StyleSheet, Switch, Text, View } from 'react-native';
import { Button } from '@/components/Button';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { StatusBadge } from '@/components/StatusBadge';
import { useQuery } from '@/lib/useQuery';
import { useAuth } from '@/providers/AuthProvider';
import { color, radius, space, type, card } from '@/theme/tokens';
import { fetchMyBrands, setDailyReport } from '@/features/brand/api';
import { errorMessage } from '@/lib/errors';

const ROLE = { owner: 'Pemilik', member: 'Anggota', viewer: 'Hanya lihat' } as const;

export default function BrandAccount() {
  const { session, signOut } = useAuth();
  const q = useQuery(fetchMyBrands, []);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  async function toggle(id: string, on: boolean) {
    setBusy(id); setErr(null);
    q.setData((xs) => xs?.map((b) => (b.id === id ? { ...b, daily_report: on } : b)) ?? xs);
    try { await setDailyReport(id, on); } catch (e) { setErr(errorMessage(e)); await q.reload(); } finally { setBusy(null); }
  }
  return (
    <Screen inTabs>
      <Header title="Akun" back={false} />
      <View style={styles.card}>
        <Text style={styles.label}>Masuk sebagai</Text>
        <Text style={styles.value}>{session?.user.email}</Text>
      </View>
      <Text style={styles.section}>Brand</Text>
      {q.data?.map((b) => (
        <View key={b.id} style={styles.row}>
          <Text style={styles.value}>{b.name}</Text>
          <StatusBadge label={ROLE[b.role]} tone="neutral" />
        </View>
      ))}
      <Text style={styles.section}>Laporan harian via email</Text>
      <Text style={styles.helpBody}>Setiap pagi sekitar 08.00 WIB: qualified views baru, biaya kemarin, dan status tiap campaign.</Text>
      {q.data?.map((b) => (
        <View key={`r-${b.id}`} style={styles.row}>
          <Text style={styles.value}>{b.name}</Text>
          <Switch value={b.daily_report} disabled={busy === b.id} onValueChange={(on) => void toggle(b.id, on)}
            trackColor={{ false: color.surfaceRaised, true: color.blue }} thumbColor={color.text} accessibilityLabel={`Laporan harian ${b.name}`} />
        </View>
      ))}
      {err ? <Text style={[styles.helpBody, { color: color.danger }]}>{err}</Text> : null}
      <View style={styles.help}>
        <Text style={styles.helpTitle}>Mau campaign baru atau ubah budget?</Text>
        <Text style={styles.helpBody}>Untuk saat ini campaign disiapkan oleh tim TAPP. Hubungi account manager-mu dan kami akan mengaturnya.</Text>
        <Text style={styles.link} onPress={() => Linking.openURL('mailto:brand@tapp.id?subject=Campaign%20baru').catch(() => {})}>brand@tapp.id</Text>
      </View>
      <View style={{ marginTop: space.xxl }}><Button variant="secondary" label="Keluar" onPress={signOut} /></View>
    </Screen>
  );
}
const styles = StyleSheet.create({
  card: { ...card, borderRadius: radius.lg, padding: space.lg, gap: 4 },
  label: { ...type.caption, color: color.textMuted },
  value: { ...type.label, color: color.text },
  section: { ...type.heading, color: color.text, marginTop: space.xxl, marginBottom: space.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: color.border },
  help: { marginTop: space.xxl, padding: space.lg, borderRadius: radius.lg, backgroundColor: color.accentSoft, gap: space.xs },
  helpTitle: { ...type.label, color: color.text },
  helpBody: { ...type.caption, color: color.textSecondary },
  link: { ...type.label, color: color.blueLight, marginTop: space.xs },
});
