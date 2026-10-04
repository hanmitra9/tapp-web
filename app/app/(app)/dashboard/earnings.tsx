import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { showAlert } from '@/lib/alert';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { Header } from '@/components/Header';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { dateLabel, idr } from '@/lib/format';
import { errorMessage } from '@/lib/errors';
import { track } from '@/lib/analytics';
import { useQuery } from '@/lib/useQuery';
import { useAuth } from '@/providers/AuthProvider';
import { savePayoutCard } from '@/lib/shareCard';
import { color, radius, space, type, card } from '@/theme/tokens';
import { BalanceCard, cardFootText } from '@/components/BalanceCard';
import { StatusBadge } from '@/components/StatusBadge';
import { fetchPayoutMethod } from '@/features/creator/api';
import { maskAccount } from '@/features/creator/handles';
import { fetchEarnings } from '@/features/campaigns/earnings';
import { fetchPayouts, fetchWithdrawTerms, OPEN, PAYOUT_STATUS, requestPayout, TIER_LABEL, uuid, type Payout } from '@/features/payouts/api';

// Wallet (0045/0046): accepted clips add to the balance; the creator withdraws it. Platform fee + transfer fee, level bonus on top.
export default function Payments() {
  useEffect(() => { track('earnings_viewed'); }, []);
  const { session, account } = useAuth();
  const uid = session!.user.id;
  const q = useQuery(async () => {
    const [earn, payouts, method, terms] = await Promise.all([fetchEarnings(uid), fetchPayouts(), fetchPayoutMethod(uid), fetchWithdrawTerms(uid)]);
    return { ...earn, payouts, method, terms };
  }, [uid]);
  const d = q.data;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [key] = useState(uuid);   // one key per screen visit: a double tap never creates two withdrawals

  const available = Math.max(d?.summary.available ?? 0, 0);
  const open = d?.payouts.find((p) => OPEN.includes(p.status)) ?? null;
  const bonus = d ? Math.round(available * d.terms.bonusPct / 100) : 0;
  const platformFee = d ? Math.round(available * d.terms.feePct / 100) : 0;
  const net = d ? available + bonus - platformFee - d.terms.fee : 0;
  const paid = d?.payouts.filter((p) => p.status === 'paid') ?? [];
  const totalPaid = paid.reduce((a, p) => a + p.amount + Number(p.bonus ?? 0) - Number(p.fee ?? 0), 0);
  const firstPaid = paid.map((p) => p.paid_at ?? p.created_at).sort()[0] ?? null;
  const [saving, setSaving] = useState(false);
  async function saveCard() {
    setSaving(true);
    try {
      await savePayoutCard({ amount: idr(totalPaid), name: account?.fullName ?? 'Creator TAPP', handle: account?.username ?? null,
        payouts: paid.length, since: firstPaid ? new Date(firstPaid).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }) : null });
      track('payout_card_saved', { total: totalPaid });
    } catch (e) { setError(errorMessage(e)); }
    finally { setSaving(false); }
  }
  const canWithdraw = !!d && !!d.method && !open && available >= d.terms.min;

  function confirm() {
    if (!d) return;
    showAlert('Tarik saldo?', `Saldo ${idr(available)}${bonus ? ` + bonus level ${idr(bonus)}` : ''} − fee platform ${d.terms.feePct}% ${idr(platformFee)} − biaya transfer ${idr(d.terms.fee)}.\nDiterima ${idr(net)} ke ${d.method?.provider ?? ''}.`, [
      { text: 'Batal', style: 'cancel' },
      { text: 'Tarik', onPress: withdraw },
    ]);
  }
  async function withdraw() {
    setBusy(true); setError(null);
    try { await requestPayout(key); track('payout_requested', { amount: available }); await q.reload(); }
    catch (e) { setError(errorMessage(e)); }
    finally { setBusy(false); }
  }

  return (
    <Screen inTabs refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={q.refresh} tintColor={color.blue} />}>
      <Header title="Pembayaran" back={false} />
      {q.error && !d ? <Notice tone="error" message={q.error} /> : null}

      <View style={styles.hero}>
        <BalanceCard label="Saldo bisa ditarik" amount={d ? idr(available) : null}
          footLeft={d ? <Text style={cardFootText}>{d.summary.pending > 0 ? `${idr(d.summary.pending)} sedang diproses` : `Level ${TIER_LABEL[d.terms.tier] ?? d.terms.tier}`}</Text> : null}
          footRight={<Text style={cardFootText}>TAPP Creators</Text>} />
      </View>

      {d ? (
        <View style={styles.withdraw}>
          {open ? (
            <Notice tone="info" message={`Pencairan ${idr(open.amount + Number(open.bonus ?? 0) - (open.fee ?? 0))} sedang ${PAYOUT_STATUS[open.status].label.toLowerCase()}. Biasanya selesai dalam 1x24 jam kerja.`} />
          ) : (
            <>
              <Button label={available >= d.terms.min ? `Tarik ${idr(Math.max(net, 0))}` : 'Tarik saldo'} onPress={confirm} loading={busy} disabled={!canWithdraw} />
              <Text style={styles.terms}>
                {available < d.terms.min ? `Minimal tarik ${idr(d.terms.min)}. ` : ''}Fee platform {d.terms.feePct}% + biaya transfer {idr(d.terms.fee)} per pencairan.
                {d.terms.bonusPct ? ` Bonus level ${TIER_LABEL[d.terms.tier]} +${d.terms.bonusPct}% ditambahkan saat kamu menarik.` : ' Naik ke level Rising untuk mulai dapat bonus saat menarik.'}
              </Text>
            </>
          )}
          <Notice tone="error" message={error} />
        </View>
      ) : null}

      {totalPaid > 0 ? (
        <View style={styles.total}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.methodLabel}>Total payout selama ini</Text>
            <Text style={styles.totalValue}>{idr(totalPaid)}</Text>
            <Text style={styles.rowMeta}>{paid.length}x pencairan{firstPaid ? ` · sejak ${dateLabel(firstPaid)}` : ''}</Text>
          </View>
          <Button label="Simpan kartu" variant="secondary" onPress={saveCard} loading={saving} />
        </View>
      ) : null}

      {d ? (
        <Pressable style={styles.method} onPress={() => router.push('/profile/payout')} accessibilityRole="button">
          <View style={{ flex: 1 }}>
            <Text style={styles.methodLabel}>Ditransfer ke</Text>
            <Text style={styles.methodValue}>{d.method ? `${d.method.provider} ${maskAccount(d.method.account_number)} · ${d.method.account_name}` : 'Belum diisi'}</Text>
          </View>
          <Text style={styles.link}>{d.method ? 'Ubah' : 'Isi sekarang'}</Text>
        </Pressable>
      ) : null}
      {d && !d.method ? <View style={{ marginTop: space.md }}><Notice tone="info" message="Isi rekening atau e-wallet dulu supaya saldomu bisa ditarik." /></View> : null}

      <View style={styles.explain}>
        <Text style={styles.explainTitle}>Cara kamu dibayar</Text>
        <Text style={styles.explainBody}>
          1. Submit klip dari campaign yang kamu ikuti.{'\n'}2. Setelah tim TAPP menerima klipmu, bayarannya masuk ke saldo: views klip × tarif per 1.000 views.{'\n'}3. Tarik saldo kapan saja setelah mencapai minimum. Saat menarik ada fee platform dan biaya transfer, dan bonus level ditambahkan.
        </Text>
      </View>

      <Text style={styles.section}>Riwayat pencairan</Text>
      {d && !d.payouts.length ? (
        <EmptyState title="Belum ada pencairan" body="Pencairan saldo muncul di sini, lengkap dengan bonus, biaya, dan status transfernya."
          action={{ label: 'Cari campaign', onPress: () => router.navigate('/dashboard/campaigns') }} />
      ) : null}
      {d?.payouts.map((p) => <PayoutRow key={p.id} p={p} />)}
    </Screen>
  );
}

function PayoutRow({ p }: { p: Payout }) {
  const st = PAYOUT_STATUS[p.status];
  const bonus = Number(p.bonus ?? 0), fee = Number(p.fee ?? 0);
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{p.paid_at ? dateLabel(p.paid_at) : dateLabel(p.created_at)} · {p.payout_method.provider} ••{p.payout_method.account_number.slice(-4)}</Text>
        <Text style={styles.rowMeta}>Saldo {idr(p.amount)}{bonus ? ` · bonus +${idr(bonus)}` : ''}{fee ? ` · fee ${idr(fee)}` : ''}{p.processed_reference ? ` · Ref. ${p.processed_reference}` : ''}</Text>
        {p.status === 'rejected' && p.review_reason ? <Text style={[styles.rowMeta, { color: color.danger }]}>{p.review_reason}</Text> : null}
      </View>
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        <Text style={styles.amount}>{idr(p.amount + bonus - fee)}</Text>
        <StatusBadge label={st.label} tone={st.tone} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { marginTop: -space.md },
  withdraw: { marginTop: space.lg, gap: space.sm },
  terms: { ...type.caption, color: color.textMuted, textAlign: 'center', lineHeight: 19 },
  method: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.lg, padding: space.lg, borderRadius: radius.md, ...card },
  methodLabel: { ...type.caption, color: color.textMuted },
  methodValue: { ...type.label, color: color.text },
  total: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.lg, padding: space.lg, borderRadius: radius.md, ...card },
  totalValue: { ...type.title, color: color.text, fontVariant: ['tabular-nums'] },
  explain: { marginTop: space.lg, padding: space.lg, gap: space.sm, ...card, borderRadius: radius.md },
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
