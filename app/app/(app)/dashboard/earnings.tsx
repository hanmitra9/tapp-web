import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { showAlert } from '@/lib/alert';
import { Button } from '@/components/Button';
import { Header } from '@/components/Header';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { dateLabel, idr } from '@/lib/format';
import { errorMessage } from '@/lib/errors';
import { track } from '@/lib/analytics';
import { useQuery } from '@/lib/useQuery';
import { useAuth } from '@/providers/AuthProvider';
import { LevelProgress } from '@/components/LevelProgress';
import { fetchTierProgress } from '@/features/creator/tier';
import { fetchReferral } from '@/features/referral/api';
import { renderPayoutCard, shareRenderedCard, type RenderedCard } from '@/lib/shareCard';
import { ShareCardSheet } from '@/components/ShareCardSheet';
import { color, radius, space, type, card } from '@/theme/tokens';
import { BalanceCard, cardFootText } from '@/components/BalanceCard';
import { fetchAvatarUrl, fetchPayoutMethod } from '@/features/creator/api';
import { maskAccount } from '@/features/creator/handles';
import { fetchEarnings } from '@/features/campaigns/earnings';
import { fetchPayouts, fetchWithdrawTerms, OPEN, PAYOUT_STATUS, requestPayout, TIER_LABEL, uuid } from '@/features/payouts/api';

// Wallet (0045/0046): accepted clips add to the balance; the creator withdraws it. Platform fee + transfer fee, level bonus on top.
export default function Payments() {
  useEffect(() => { track('earnings_viewed'); }, []);
  const { session, account } = useAuth();
  const uid = session!.user.id;
  const q = useQuery(async () => {
    const [earn, payouts, method, terms, avatarUrl, level, referral] = await Promise.all([fetchEarnings(uid), fetchPayouts(), fetchPayoutMethod(uid), fetchWithdrawTerms(uid), fetchAvatarUrl(uid), fetchTierProgress().catch(() => null), fetchReferral().catch(() => null)]);
    return { ...earn, payouts, method, terms, avatarUrl, level, referral };
  }, [uid]);
  const d = q.data;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [key] = useState(uuid);   // one key per screen visit: a double tap never creates two withdrawals

  const available = Math.max(d?.summary.available ?? 0, 0);
  const open = d?.payouts.find((p) => OPEN.includes(p.status)) ?? null;
  const refBonus = d?.referral?.available ?? 0;
  const bonus = d ? Math.round(available * d.terms.bonusPct / 100) + refBonus : 0;
  const platformFee = d ? Math.round(available * d.terms.feePct / 100) : 0;
  const net = d ? available + bonus - platformFee - d.terms.fee : 0;
  const paid = d?.payouts.filter((p) => p.status === 'paid') ?? [];
  const totalPaid = paid.reduce((a, p) => a + p.amount + Number(p.bonus ?? 0) - Number(p.fee ?? 0), 0);
  const firstPaid = paid.map((p) => p.paid_at ?? p.created_at).sort()[0] ?? null;
  const [saving, setSaving] = useState(false);
  const [shareCard, setShareCard] = useState<RenderedCard | null>(null);
  async function openCard() {
    setSaving(true);
    try {
      setShareCard(await renderPayoutCard({ total: totalPaid, from: firstPaid, to: new Date().toISOString(),
        name: account?.fullName ?? account?.username ?? 'TAPP', avatarUrl: d?.avatarUrl ?? null }));
    } catch (e) { setError(errorMessage(e)); }
    finally { setSaving(false); }
  }
  function closeCard() { if (shareCard) URL.revokeObjectURL(shareCard.url); setShareCard(null); }
  async function share() {
    if (!shareCard) return;
    try { await shareRenderedCard(shareCard); track('payout_card_saved', { total: totalPaid }); }
    catch (e) { setError(errorMessage(e)); }
  }
  const canWithdraw = !!d && !!d.method && !open && available >= d.terms.min;

  function confirm() {
    if (!d) return;
    showAlert('Tarik saldo?', `Saldo ${idr(available)}${bonus - refBonus ? ` + bonus level ${idr(bonus - refBonus)}` : ''}${refBonus ? ` + bonus referral ${idr(refBonus)}` : ''} − fee platform ${d.terms.feePct}% ${idr(platformFee)} − biaya transfer ${idr(d.terms.fee)}.\nDiterima ${idr(net)} ke ${d.method?.provider ?? ''}.`, [
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
      <Header title="Saldo" back={false} />
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
                {available < d.terms.min ? `Min. ${idr(d.terms.min)} · ` : ''}Fee {d.terms.feePct}% + {idr(d.terms.fee)}{d.terms.bonusPct ? ` · Bonus +${d.terms.bonusPct}%` : ''}
              </Text>
            </>
          )}
          <Notice tone="error" message={error} />
        </View>
      ) : null}

      {d?.level ? <View style={{ marginTop: space.lg }}><LevelProgress p={d.level} /></View> : null}

      <Pressable style={styles.method} onPress={() => router.push('/referral')} accessibilityRole="button">
        <View style={{ flex: 1 }}>
          <Text style={styles.methodValue}>Ajak teman, dapat {idr(d?.referral?.bonus ?? 20000)}</Text>
          <Text style={styles.methodLabel}>{d?.referral?.invited ? `${d.referral.invited} teman bergabung` : 'Per teman yang cair pertama kali'}</Text>
        </View>
        <Feather name="chevron-right" size={18} color={color.textMuted} />
      </Pressable>

      {totalPaid > 0 ? (
        <View style={styles.total}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.methodLabel}>Total payout selama ini</Text>
            <Text style={styles.totalValue}>{idr(totalPaid)}</Text>
            {firstPaid ? <Text style={styles.rowMeta}>Sejak {dateLabel(firstPaid)}</Text> : null}
          </View>
          <Button label="Lihat kartu" variant="secondary" onPress={openCard} loading={saving} />
        </View>
      ) : null}

      <ShareCardSheet card={shareCard} onClose={closeCard} onShare={share} title="Total payout"
        body="Semua yang sudah kamu cairkan. Simpan atau bagikan ke story." />

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


      <Pressable style={styles.method} onPress={() => router.push('/payouts')} accessibilityRole="button">
        <Feather name="clock" size={18} color={color.link} />
        <View style={{ flex: 1 }}>
          <Text style={styles.methodValue}>Riwayat pencairan</Text>
          {d ? <Text style={styles.methodLabel}>{d.payouts.length ? `${d.payouts.length} pencairan` : 'Belum ada'}</Text> : null}
        </View>
        <Feather name="chevron-right" size={18} color={color.textMuted} />
      </Pressable>
    </Screen>
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
