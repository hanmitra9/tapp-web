import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Image, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { showAlert } from '@/lib/alert';
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
import { color, gradient, radius, space, type, card } from '@/theme/tokens';
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
    showAlert('Tarik saldo?', `Saldo ${idr(available)}${bonus - refBonus ? ` + bonus level ${idr(bonus - refBonus)}` : ''}${refBonus ? ` + bonus referral ${idr(refBonus)}` : ''}${platformFee ? ` − fee ${d.terms.feePct}% ${idr(platformFee)}` : ''} − biaya transfer ${idr(d.terms.fee)}.\nDiterima ${idr(net)} ke ${d.method?.provider ?? ''}.`, [
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

      <LinearGradient colors={gradient.card} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={styles.hero} {...({ dataSet: { tapp: 'balance' } } as object)}>
        <View style={styles.heroTop}>
          <Text style={styles.heroLabel}>Saldo bisa ditarik</Text>
          <Image source={require('../../../assets/tapp-mark-white.png')} style={styles.heroMark} accessibilityIgnoresInvertColors />
        </View>
        {d ? <Text style={styles.heroAmount} numberOfLines={1} adjustsFontSizeToFit>{idr(available)}</Text> : <View style={styles.heroSkeleton} />}
        {d ? (
          <View style={styles.chips}>
            {d.summary.pending > 0 ? <Text style={styles.chip}>{idr(d.summary.pending)} diproses</Text> : null}
            <Text style={styles.chip}>Level {TIER_LABEL[d.terms.tier] ?? d.terms.tier}{d.terms.bonusPct ? ` · +${d.terms.bonusPct}%` : ''}</Text>
            {refBonus ? <Text style={styles.chip}>+{idr(refBonus)} referral</Text> : null}
          </View>
        ) : null}
        {d ? (open ? (
          <View style={styles.openBox}>
            <Feather name="loader" size={16} color="#FFFFFF" />
            <Text style={styles.openText}>Pencairan {idr(open.amount + Number(open.bonus ?? 0) - (open.fee ?? 0))} sedang {PAYOUT_STATUS[open.status].label.toLowerCase()} · maks 1x24 jam kerja</Text>
          </View>
        ) : (
          <>
            <Pressable onPress={confirm} disabled={!canWithdraw || busy} accessibilityRole="button"
              style={({ pressed }) => [styles.withdrawBtn, (!canWithdraw || busy) && { opacity: 0.55 }, pressed && { opacity: 0.85 }]}>
              <Feather name="arrow-down-left" size={17} color="#0A2A4D" />
              <Text style={styles.withdrawText}>{busy ? 'Memproses…' : available >= d.terms.min ? `Tarik ${idr(Math.max(net, 0))}` : 'Tarik saldo'}</Text>
            </Pressable>
            <Text style={styles.terms}>
              {available < d.terms.min ? `Min. ${idr(d.terms.min)} · ` : ''}{d.terms.feePct ? `Fee ${d.terms.feePct}% + ` : 'Biaya transfer '}{idr(d.terms.fee)}
            </Text>
          </>
        )) : null}
      </LinearGradient>
      {error ? <View style={{ marginTop: space.md }}><Notice tone="error" message={error} /></View> : null}
      {d && !d.method ? <View style={{ marginTop: space.md }}><Notice tone="info" message="Isi rekening dulu supaya saldo bisa ditarik." /></View> : null}

      {d?.level ? <View style={{ marginTop: space.lg }}><LevelProgress p={d.level} /></View> : null}

      {totalPaid > 0 ? (
        <Pressable onPress={openCard} disabled={saving} accessibilityRole="button" style={({ pressed }) => [styles.total, pressed && { opacity: 0.9 }]}>
          <LinearGradient colors={['#17130A', '#0E0D0B']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.totalLabel}>Total payout selama ini</Text>
            <Text style={styles.totalValue}>{idr(totalPaid)}</Text>
            {firstPaid ? <Text style={styles.totalSub}>Sejak {dateLabel(firstPaid)}</Text> : null}
          </View>
          <View style={styles.cardBtn}><Feather name="share-2" size={15} color="#F5C451" /><Text style={styles.cardBtnText}>{saving ? '…' : 'Kartu'}</Text></View>
        </Pressable>
      ) : null}

      <ShareCardSheet card={shareCard} onClose={closeCard} onShare={share} title="Total payout"
        body="Semua yang sudah kamu cairkan. Simpan atau bagikan ke story." />

      <View style={styles.list}>
        <ListRow icon="credit-card" title={d?.method ? `${d.method.provider} ${maskAccount(d.method.account_number)}` : 'Rekening'}
          sub={d?.method ? d.method.account_name : 'Belum diisi'} onPress={() => router.push('/profile/payout')} action={d?.method ? 'Ubah' : 'Isi'} />
        <ListRow icon="clock" title="Riwayat pencairan" sub={d ? (d.payouts.length ? `${d.payouts.length} pencairan` : 'Belum ada') : ' '} onPress={() => router.push('/payouts')} line />
        <ListRow icon="gift" title={`Ajak teman, dapat ${idr(d?.referral?.bonus ?? 20000)}`} sub={d?.referral?.invited ? `${d.referral.invited} teman bergabung` : 'Per teman yang cair pertama kali'}
          onPress={() => router.push('/referral')} line />
      </View>
    </Screen>
  );
}


function ListRow({ icon, title, sub, onPress, action, line }: { icon: 'credit-card' | 'clock' | 'gift'; title: string; sub: string; onPress: () => void; action?: string; line?: boolean }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.lrow, line && styles.lline, pressed && { opacity: 0.6 }]}>
      <View style={styles.licon}><Feather name={icon} size={17} color={color.link} /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.methodValue} numberOfLines={1}>{title}</Text>
        <Text style={styles.methodLabel} numberOfLines={1}>{sub}</Text>
      </View>
      {action ? <Text style={styles.link}>{action}</Text> : <Feather name="chevron-right" size={18} color={color.textMuted} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: radius.xl, padding: space.xl, gap: space.md, overflow: 'hidden' },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroLabel: { ...type.caption, color: 'rgba(255,255,255,0.82)' },
  heroMark: { width: 26, height: 26 },
  heroAmount: { ...type.display, fontSize: 40, lineHeight: 46, color: '#FFFFFF', fontVariant: ['tabular-nums'] },
  heroSkeleton: { height: 46, width: '60%', borderRadius: radius.sm, backgroundColor: 'rgba(255,255,255,0.12)' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: { ...type.caption, color: '#FFFFFF', backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, overflow: 'hidden' },
  withdrawBtn: { height: 50, borderRadius: radius.pill, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: space.xs },
  withdrawText: { ...type.label, fontSize: 16, color: '#0A2A4D', fontVariant: ['tabular-nums'] },
  openBox: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.12)' },
  openText: { ...type.caption, color: '#FFFFFF', flex: 1 },
  totalLabel: { ...type.caption, color: 'rgba(255,236,190,0.7)' },
  totalSub: { ...type.caption, fontSize: 12, color: 'rgba(255,236,190,0.55)' },
  cardBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 38, borderRadius: radius.pill, borderWidth: 1, borderColor: 'rgba(245,196,81,0.45)' },
  cardBtnText: { ...type.label, fontSize: 14, color: '#F5C451' },
  list: { marginTop: space.lg, ...card, borderRadius: radius.lg, paddingHorizontal: space.lg },
  lrow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.lg },
  lline: { borderTopWidth: 1, borderTopColor: color.border },
  licon: { width: 36, height: 36, borderRadius: 18, backgroundColor: color.accentSoft, alignItems: 'center', justifyContent: 'center' },
  withdraw: { marginTop: space.lg, gap: space.sm },
  terms: { ...type.caption, fontSize: 12, color: 'rgba(255,255,255,0.7)', textAlign: 'center' },
  method: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.lg, padding: space.lg, borderRadius: radius.md, ...card },
  methodLabel: { ...type.caption, color: color.textMuted },
  methodValue: { ...type.label, color: color.text },
  total: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.lg, padding: space.lg, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(245,196,81,0.25)' },
  totalValue: { ...type.title, color: '#FFF4D6', fontVariant: ['tabular-nums'] },
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
