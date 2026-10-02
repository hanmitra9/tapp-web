import { router } from 'expo-router';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { Header } from '@/components/Header';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { StatusBadge } from '@/components/StatusBadge';
import { dateLabel, idr } from '@/lib/format';
import { useQuery } from '@/lib/useQuery';
import { color, space, type } from '@/theme/tokens';
import { maskAccount } from '@/features/creator/handles';
import { fetchPayouts, PAYOUT_STATUS, STEPS, type Payout } from '@/features/payouts/api';

export default function Payouts() {
  const q = useQuery(fetchPayouts, []);
  return (
    <Screen refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={q.refresh} tintColor={color.blue} />}>
      <Header title="Riwayat pencairan" subtitle="Pencairan diproses manual oleh tim TAPP, biasanya 1–3 hari kerja." />
      {q.error && !q.data ? <Notice tone="error" message={q.error} /> : null}
      {q.data && !q.data.length ? (
        <EmptyState title="Belum ada pencairan" body="Ajukan pencairan dari tab Penghasilan setelah saldo tersedia mencapai minimum."
          action={{ label: 'Ke Penghasilan', onPress: () => router.navigate('/dashboard/earnings') }} />
      ) : null}
      {q.data?.map((p) => <PayoutRow key={p.id} p={p} />)}
    </Screen>
  );
}

function PayoutRow({ p }: { p: Payout }) {
  const st = PAYOUT_STATUS[p.status];
  const idx = STEPS.indexOf(p.status);
  return (
    <View style={styles.row}>
      <View style={styles.head}>
        <Text style={styles.amount}>{idr(p.amount)}</Text>
        <StatusBadge label={st.label} tone={st.tone} />
      </View>
      <Text style={styles.meta}>
        {p.payout_method.provider} {maskAccount(p.payout_method.account_number)} · diajukan {dateLabel(p.created_at)}
      </Text>
      {p.status !== 'rejected' ? (
        <View style={styles.track} accessible accessibilityLabel={`Tahap ${idx + 1} dari ${STEPS.length}: ${st.label}`}>
          {STEPS.map((s, i) => <View key={s} style={[styles.seg, i <= idx && styles.segOn]} />)}
        </View>
      ) : null}
      {p.status === 'paid' ? <Text style={styles.ok}>Dikirim {p.paid_at ? dateLabel(p.paid_at) : ''} · Ref. {p.processed_reference}</Text> : null}
      {p.status === 'rejected' ? (
        <>
          <Text style={styles.bad}>Ditolak: {p.review_reason}. Saldo sudah kembali ke Tersedia.</Text>
          <Text style={styles.link} onPress={() => router.push({ pathname: '/dispute', params: { payout: p.id, reason: p.review_reason ?? '' } })}>Ajukan keberatan</Text>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { paddingVertical: space.lg, gap: space.sm, borderBottomWidth: 1, borderBottomColor: color.border },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  amount: { ...type.heading, color: color.text, fontVariant: ['tabular-nums'] },
  meta: { ...type.caption, color: color.textMuted },
  track: { flexDirection: 'row', gap: 4 },
  seg: { flex: 1, height: 3, borderRadius: 2, backgroundColor: color.border },
  segOn: { backgroundColor: color.blue },
  ok: { ...type.caption, color: color.success },
  bad: { ...type.caption, color: color.danger },
  link: { ...type.label, color: color.link },
});
