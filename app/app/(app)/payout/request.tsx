import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useRef, useState, useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/Button';
import { Header } from '@/components/Header';
import { LoadState } from '@/components/LoadState';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { errorMessage } from '@/lib/errors';
import { idr } from '@/lib/format';
import { useQuery } from '@/lib/useQuery';
import { useAuth } from '@/providers/AuthProvider';
import { color, radius, space, type } from '@/theme/tokens';
import { fetchEarnings } from '@/features/campaigns/earnings';
import { fetchPayoutMethod } from '@/features/creator/api';
import { maskAccount } from '@/features/creator/handles';
import { fetchPayouts, fetchWithdrawalFee, OPEN, requestPayout, TIER_LABEL, uuid, type Payout } from '@/features/payouts/api';
import { track } from '@/lib/analytics';

export default function RequestPayout() {
  useEffect(() => { track('payout_started'); }, []);
  const { session, account } = useAuth();
  const uid = session!.user.id;
  const key = useRef(uuid()).current;   // same key on retry → server returns the same request, never a duplicate
  const q = useQuery(async () => {
    const [e, method, payouts, fee] = await Promise.all([fetchEarnings(uid), fetchPayoutMethod(uid), fetchPayouts(), fetchWithdrawalFee(uid)]);
    return { e, method, fee, open: payouts.find((p) => OPEN.includes(p.status)) ?? null };
  }, [uid]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Payout | null>(null);

  if (!q.data) return <Screen width="narrow" scroll={false}><Header title="Cairkan penghasilan" /><LoadState error={q.error} onRetry={q.reload} /></Screen>;
  const { e, method, open, fee } = q.data;
  const available = Math.max(e.summary.available, 0);
  const feeAmount = Math.round(available * fee.pct / 100);   // same rounding as request_payout
  const net = available - feeAmount;

  if (done) {
    return (
      <Screen width="narrow" scroll={false} footer={<Button label="Lihat status pencairan" onPress={() => router.replace('/payouts')} />}>
        <View style={styles.done}>
          <View style={styles.doneIcon}><Feather name="check" size={28} color={color.blue} /></View>
          <Text style={styles.doneTitle}>Pencairan diajukan</Text>
          <Text style={styles.doneBody}>{idr(done.net_amount ?? done.amount)} akan ditinjau tim TAPP lalu dikirim ke {done.payout_method.provider} {maskAccount(done.payout_method.account_number)}. Kamu akan mendapat notifikasi di setiap tahap.</Text>
        </View>
      </Screen>
    );
  }

  // Everything the server checks, surfaced before the tap.
  const block = account?.status !== 'active' ? 'Akunmu belum aktif, jadi belum bisa mencairkan penghasilan.'
    : open ? 'Kamu masih punya pencairan yang sedang diproses. Tunggu sampai selesai untuk mengajukan lagi.'
    : !method ? 'Tambahkan metode pencairan terlebih dahulu.'
    : available < e.minPayout ? `Saldo tersedia masih di bawah minimum pencairan ${idr(e.minPayout)}.`
    : null;

  async function confirm() {
    setBusy(true); setError(null);
    try { const p = await requestPayout(key); track('payout_requested', { amount: p.amount }); setDone(p); } catch (err) { setError(errorMessage(err)); await q.reload(); }
    finally { setBusy(false); }
  }

  return (
    <Screen width="narrow" footer={
      block ? (!method ? <Button label="Tambah metode pencairan" onPress={() => router.push('/profile/payout')} />
        : open ? <Button variant="secondary" label="Lihat status pencairan" onPress={() => router.replace('/payouts')} /> : null)
      : <Button label={`Cairkan ${idr(net)}`} onPress={confirm} loading={busy} />
    }>
      <Header title="Cairkan penghasilan" />
      <View style={styles.body}>
        {block ? <Notice tone="info" message={block} /> : null}
        <Notice tone="error" message={error} />
        <View style={styles.summary}>
          <Line label="Saldo ditarik" value={idr(available)} />
          <Line label={`Fee penarikan (Level ${TIER_LABEL[fee.tier] ?? fee.tier})`} value={fee.pct ? `−${idr(feeAmount)}` : 'Gratis'} />
          <Line label="Kamu terima" value={idr(net)} strong />
          <Line label="Tujuan" value={method ? `${method.provider} ${maskAccount(method.account_number)}` : '—'} />
          <Line label="Atas nama" value={method?.account_name ?? '—'} />
          <Line label="Estimasi" value="1–3 hari kerja" />
        </View>
        <Text style={styles.note}>Seluruh saldo tersedia dicairkan sekaligus. Fee penarikan makin kecil saat level-mu naik. Penghasilan yang masih tertunda tidak ikut. Pastikan nama pemilik sama persis dengan di rekening agar transfer tidak gagal.</Text>
      </View>
    </Screen>
  );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.line}>
      <Text style={styles.lineLabel}>{label}</Text>
      <Text style={[styles.lineValue, strong && styles.strong]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.lg },
  summary: { borderWidth: 1, borderColor: color.border, borderRadius: radius.md, paddingHorizontal: space.lg },
  line: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: color.border, gap: space.lg },
  lineLabel: { ...type.body, color: color.textMuted },
  lineValue: { ...type.body, color: color.text, flexShrink: 1, textAlign: 'right', fontVariant: ['tabular-nums'] },
  strong: { ...type.heading },
  note: { ...type.caption, color: color.textMuted },
  done: { flex: 1, justifyContent: 'center', gap: space.md },
  doneIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: color.accentSoft, alignItems: 'center', justifyContent: 'center' },
  doneTitle: { ...type.title, color: color.text, marginTop: space.md },
  doneBody: { ...type.body, color: color.textSecondary },
});
