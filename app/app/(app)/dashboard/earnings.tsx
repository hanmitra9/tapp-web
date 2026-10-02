import { router } from 'expo-router';
import { useEffect } from 'react';
import { Linking, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { EmptyState } from '@/components/EmptyState';
import { Header } from '@/components/Header';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { dateLabel, idr } from '@/lib/format';
import { track } from '@/lib/analytics';
import { useQuery } from '@/lib/useQuery';
import { useAuth } from '@/providers/AuthProvider';
import { color, radius, space, type } from '@/theme/tokens';
import { BalanceCard, cardFootText } from '@/components/BalanceCard';
import { StatusBadge } from '@/components/StatusBadge';
import { fetchPayoutMethod } from '@/features/creator/api';
import { maskAccount } from '@/features/creator/handles';
import { fetchPayments, paidTotal, type Payment } from '@/features/payouts/api';
import { fetchMySubmissions, type MySubmission } from '@/features/submissions/api';

// Simple flow: submit a clip → TAPP accepts it → TAPP transfers the pay. No balance to withdraw.
export default function Payments() {
  useEffect(() => { track('earnings_viewed'); }, []);
  const { session } = useAuth();
  const q = useQuery(async () => {
    const [payments, subs, method] = await Promise.all([fetchPayments(), fetchMySubmissions(undefined, 200), fetchPayoutMethod(session!.user.id)]);
    return { payments, method, waiting: subs.filter((s) => s.status === 'approved' || s.status === 'tracking') };
  }, [session?.user.id]);
  const d = q.data;

  return (
    <Screen inTabs refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={q.refresh} tintColor={color.blue} />}>
      <Header title="Pembayaran" back={false} />
      {q.error && !d ? <Notice tone="error" message={q.error} /> : null}

      <View style={styles.hero}>
        <BalanceCard label="Total dibayar ke kamu" amount={d ? idr(paidTotal(d.payments)) : null}
          footLeft={d ? <Text style={cardFootText}>{d.payments.length} klip dibayar</Text> : null}
          footRight={<Text style={cardFootText}>TAPP Creators</Text>} />
      </View>

      {d ? (
        <Pressable style={styles.method} onPress={() => router.push('/profile/payout')} accessibilityRole="button">
          <View style={{ flex: 1 }}>
            <Text style={styles.methodLabel}>Dibayar ke</Text>
            <Text style={styles.methodValue}>{d.method ? `${d.method.provider} ${maskAccount(d.method.account_number)} · ${d.method.account_name}` : 'Belum diisi'}</Text>
          </View>
          <Text style={styles.link}>{d.method ? 'Ubah' : 'Isi sekarang'}</Text>
        </Pressable>
      ) : null}
      {d && !d.method ? <View style={{ marginTop: space.md }}><Notice tone="info" message="Isi rekening atau e-wallet dulu supaya tim TAPP bisa mentransfer bayaranmu." /></View> : null}

      <View style={styles.explain}>
        <Text style={styles.explainTitle}>Cara kamu dibayar</Text>
        <Text style={styles.explainBody}>
          1. Submit klip dari campaign yang kamu ikuti.{'\n'}2. Tim TAPP mengecek dan menerima klipmu.{'\n'}3. Tim TAPP mentransfer bayarannya langsung ke rekening atau e-wallet di atas. Besarnya dari views klip × tarif campaign per 1.000 views, ditambah bonus tarif sesuai level-mu.
        </Text>
      </View>

      {d && d.waiting.length ? (
        <>
          <Text style={styles.section}>Menunggu dibayar</Text>
          {d.waiting.map((s) => <WaitingRow key={s.id} s={s} />)}
        </>
      ) : null}

      <Text style={styles.section}>Riwayat pembayaran</Text>
      {d && !d.payments.length ? (
        <EmptyState title="Belum ada pembayaran" body="Bayaran muncul di sini setelah klipmu diterima dan ditransfer oleh tim TAPP."
          action={{ label: 'Cari campaign', onPress: () => router.navigate('/dashboard/campaigns') }} />
      ) : null}
      {d?.payments.map((p) => <PaymentRow key={p.id} p={p} />)}
    </Screen>
  );
}

function WaitingRow({ s }: { s: MySubmission }) {
  return (
    <Pressable style={styles.row} onPress={() => Linking.openURL(s.post_url)} accessibilityRole="link">
      <View style={styles.rowText}>
        <Text style={styles.rowTitle} numberOfLines={1}>{s.campaign_title}</Text>
        <Text style={styles.rowMeta}>Diterima {s.reviewed_at ? dateLabel(s.reviewed_at) : ''} · {s.platform}</Text>
      </View>
      <StatusBadge label="Menunggu transfer" tone="blue" />
    </Pressable>
  );
}

function PaymentRow({ p }: { p: Payment }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle} numberOfLines={1}>{p.campaign_title ?? 'Pembayaran'}</Text>
        <Text style={styles.rowMeta}>
          {p.paid_at ? dateLabel(p.paid_at) : ''}{p.provider ? ` · ${p.provider} ••${p.account_last4 ?? ''}` : ''}{p.processed_reference ? ` · Ref. ${p.processed_reference}` : ''}
        </Text>
        {p.bonus > 0 || p.fee > 0 ? <Text style={styles.rowMeta}>Bayaran {idr(p.amount)}{p.bonus > 0 ? ` · bonus level +${idr(p.bonus)}` : ''}{p.fee > 0 ? ` · fee ${idr(p.fee)}` : ''}</Text> : null}
      </View>
      <Text style={styles.amount}>{idr(p.net_amount)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { marginTop: -space.md },
  method: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.lg, padding: space.lg, borderRadius: radius.md, backgroundColor: color.surface },
  methodLabel: { ...type.caption, color: color.textMuted },
  methodValue: { ...type.label, color: color.text },
  explain: { marginTop: space.lg, padding: space.lg, gap: space.sm, backgroundColor: color.surface, borderRadius: radius.md },
  explainTitle: { ...type.label, color: color.text },
  explainBody: { ...type.caption, color: color.textSecondary, lineHeight: 20 },
  link: { ...type.label, color: color.link },
  section: { ...type.heading, color: color.text, marginTop: space.xxl, marginBottom: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.lg, borderBottomWidth: 1, borderBottomColor: color.border },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { ...type.label, color: color.text },
  rowMeta: { ...type.caption, color: color.textMuted, fontVariant: ['tabular-nums'] },
  amount: { ...type.label, color: color.success, fontVariant: ['tabular-nums'] },
});
