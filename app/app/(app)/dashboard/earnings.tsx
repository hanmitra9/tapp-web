import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Image, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { showAlert } from '@/lib/alert';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { TopBar } from '@/components/TopBar';
import { BarChart } from '@/components/BarChart';
import { dateLabel, idr } from '@/lib/format';
import { compactIdr } from '@/lib/shareCard';
import { errorMessage } from '@/lib/errors';
import { track } from '@/lib/analytics';
import { useQuery } from '@/lib/useQuery';
import { useAuth } from '@/providers/AuthProvider';
import { LevelProgress } from '@/components/LevelProgress';
import { fetchTierProgress } from '@/features/creator/tier';
import { fetchReferral } from '@/features/referral/api';
import { unreadCount } from '@/features/notifications/api';
import { fetchDaily } from '@/features/performance/api';
import { renderPayoutCard, shareRenderedCard, type RenderedCard } from '@/lib/shareCard';
import { ShareCardSheet } from '@/components/ShareCardSheet';
import { color, gradient, radius, space, type, card } from '@/theme/tokens';
import { fetchAvatarUrl, fetchPayoutMethod } from '@/features/creator/api';
import { PaymentMethodSheet, ProviderTile } from '@/features/creator/PaymentMethodSheet';
import { maskAccount } from '@/features/creator/handles';
import { fetchEarnings } from '@/features/campaigns/earnings';
import { fetchPayouts, fetchWithdrawTerms, OPEN, PAYOUT_STATUS, requestPayout, TIER_LABEL, uuid } from '@/features/payouts/api';
import { web } from '@/theme/web';

type Tab = 'withdraw' | 'income' | 'bonus';
type Filter = 'pending' | 'done' | 'failed';
type Item = { id: string; title: string; at: string; amount: number; state: Filter };
const PERIODS = [7, 28, 90];

// Saldo (konten "Pendapatan" layout, TAPP style): total, available vs in-process, chart, activity, payment method.
export default function Payments() {
  useEffect(() => { track('earnings_viewed'); }, []);
  const { session, account } = useAuth();
  const uid = session!.user.id;
  const q = useQuery(async () => {
    const [earn, payouts, method, terms, avatarUrl, level, referral, unread] = await Promise.all([fetchEarnings(uid), fetchPayouts(), fetchPayoutMethod(uid),
      fetchWithdrawTerms(uid), fetchAvatarUrl(uid), fetchTierProgress().catch(() => null), fetchReferral().catch(() => null), unreadCount().catch(() => 0)]);
    return { ...earn, payouts, method, terms, avatarUrl, level, referral, unread };
  }, [uid]);
  const d = q.data;
  const [days, setDays] = useState(28);
  const [mode, setMode] = useState<'total' | 'gain'>('total');
  const chart = useQuery(() => fetchDaily(days), [days]);
  const [tab, setTab] = useState<Tab>('withdraw');
  const [filter, setFilter] = useState<Filter>('pending');
  const [methodOpen, setMethodOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [key] = useState(uuid);   // one key per screen visit: a double tap never creates two withdrawals

  const available = Math.max(d?.summary.available ?? 0, 0);
  const processing = d ? d.summary.pending + d.summary.in_payout : 0;
  const total = d ? available + processing + d.summary.paid : 0;
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
    if (!totalPaid) { showAlert('Belum ada payout', 'Kartu total payout muncul setelah pencairan pertamamu.'); return; }
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

  function confirm() {
    if (!d || busy) return;
    if (open) { showAlert('Sedang diproses', `Pencairan ${idr(open.amount + Number(open.bonus ?? 0) - (open.fee ?? 0))} masih ${PAYOUT_STATUS[open.status].label.toLowerCase()}. Maks 1x24 jam kerja.`); return; }
    if (!d.method) { setMethodOpen(true); return; }
    if (available < d.terms.min) { showAlert('Belum cukup', `Minimal penarikan ${idr(d.terms.min)}. Saldo kamu ${idr(available)}.`); return; }
    showAlert('Tarik saldo?', `Saldo ${idr(available)}${bonus - refBonus ? ` + bonus level ${idr(bonus - refBonus)}` : ''}${refBonus ? ` + bonus referral ${idr(refBonus)}` : ''}${platformFee ? ` − fee ${d.terms.feePct}% ${idr(platformFee)}` : ''} − biaya transfer ${idr(d.terms.fee)}.\nDiterima ${idr(net)} ke ${d.method.provider}.`, [
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

  // Chart: cumulative ("Total") or per-day ("Kenaikan") earnings for the period.
  let run = 0;
  const points = (chart.data ?? []).map((p) => {
    run += p.earned;
    const dt = new Date(p.day);
    return { key: p.day, value: mode === 'total' ? run : p.earned, label: (chart.data?.length ?? 0) <= 7 ? dt.toLocaleDateString('id-ID', { weekday: 'short' }) : `${dt.getDate()}/${dt.getMonth() + 1}` };
  });
  const periodSum = (chart.data ?? []).reduce((a, p) => a + p.earned, 0);

  // Activity: withdrawals, income per clip, bonuses — filtered by state.
  const payState = (s: string): Filter => (s === 'paid' ? 'done' : s === 'rejected' ? 'failed' : 'pending');
  const items: Item[] = !d ? [] : tab === 'withdraw'
    ? d.payouts.map((p) => ({ id: p.id, title: `Ke ${p.payout_method?.provider ?? 'rekening'}`, at: p.paid_at ?? p.created_at,
      amount: p.amount + Number(p.bonus ?? 0) - Number(p.fee ?? 0), state: payState(p.status) }))
    : tab === 'income'
      ? d.rows.filter((r) => r.amount !== 0).map((r) => ({ id: r.id, title: r.campaign?.title ?? 'Klip', at: r.created_at, amount: r.amount,
        state: (r.status === 'reversed' ? 'failed' : r.status === 'pending' ? 'pending' : 'done') as Filter }))
      : d.payouts.filter((p) => Number(p.bonus ?? 0) > 0).map((p) => ({ id: p.id, title: 'Bonus level & referral', at: p.paid_at ?? p.created_at,
        amount: Number(p.bonus), state: payState(p.status) }));
  const shown = items.filter((i) => i.state === filter);
  const TAB_EMPTY: Record<Tab, string> = { withdraw: 'penarikan', income: 'pendapatan', bonus: 'bonus' };

  return (
    <Screen inTabs refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={() => { void chart.refresh(); return q.refresh(); }} tintColor={color.blue} />}>
      <View style={{ marginBottom: space.lg }}><TopBar title="Saldo" /></View>

      <View style={styles.actionsRow}>
        <Pressable onPress={openCard} disabled={saving} accessibilityRole="button" accessibilityLabel="Kartu total payout"
          style={({ pressed }) => [styles.squareBtn, pressed && { opacity: 0.7 }]}>
          <Feather name={saving ? 'loader' : 'download'} size={18} color={color.text} />
        </Pressable>
        <Pressable onPress={confirm} accessibilityRole="button" style={({ pressed }) => [{ flex: 1 }, pressed && { opacity: 0.85 }]}>
          <LinearGradient colors={gradient.button} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.withdrawBtn}>
            <Feather name="arrow-down-left" size={17} color="#FFFFFF" />
            <Text style={styles.withdrawText}>{busy ? 'Memproses…' : d && !open && d.method && available >= d.terms.min ? `Tarik ${idr(Math.max(net, 0))}` : 'Tarik saldo'}</Text>
          </LinearGradient>
        </Pressable>
      </View>

      {q.error && !d ? <Notice tone="error" message={q.error} /> : null}
      {error ? <View style={{ marginBottom: space.md }}><Notice tone="error" message={error} /></View> : null}

      <LinearGradient colors={gradient.card} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={styles.hero} {...web('balance')}>
        <Image source={require('../../../assets/tapp-mark-white.png')} style={styles.watermark} accessibilityIgnoresInvertColors />
        <Text style={styles.heroLabel}>Total pendapatan</Text>
        {d ? <Text style={styles.heroAmount} numberOfLines={1} adjustsFontSizeToFit>{idr(total)}</Text> : <View style={styles.heroSkeleton} />}
        {d ? (
          <View style={styles.chips}>
            <Text style={styles.chip}>Level {TIER_LABEL[d.terms.tier] ?? d.terms.tier}{d.terms.bonusPct ? ` · +${d.terms.bonusPct}%` : ''}</Text>
            {refBonus ? <Text style={styles.chip}>+{idr(refBonus)} referral</Text> : null}
          </View>
        ) : null}
      </LinearGradient>

      <View style={styles.tiles}>
        <View style={[styles.tile, styles.tileGreen]}>
          <View style={styles.tileHead}><View style={[styles.tileIcon, { backgroundColor: color.successSoft }]}><Feather name="check-circle" size={14} color={color.success} /></View>
            <Text style={styles.tileLabel}>Bisa dicairkan</Text></View>
          <Text style={styles.tileValue} numberOfLines={1} adjustsFontSizeToFit>{d ? idr(available) : '—'}</Text>
        </View>
        <View style={[styles.tile, styles.tileAmber]}>
          <View style={styles.tileHead}><View style={[styles.tileIcon, { backgroundColor: color.warningSoft }]}><Feather name="clock" size={14} color={color.warning} /></View>
            <Text style={styles.tileLabel}>Sedang diproses</Text></View>
          <Text style={styles.tileValue} numberOfLines={1} adjustsFontSizeToFit>{d ? idr(processing) : '—'}</Text>
        </View>
      </View>
      {d ? (
        <Text style={styles.terms}>
          {open ? `Pencairan ${PAYOUT_STATUS[open.status].label.toLowerCase()} · maks 1x24 jam kerja` : `Min. tarik ${idr(d.terms.min)} · biaya transfer ${idr(d.terms.fee)}`}
        </Text>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Analitik pendapatan</Text>
        <View style={styles.chartBar}>
          <View style={styles.seg}>
            {(['total', 'gain'] as const).map((m) => (
              <Pressable key={m} onPress={() => setMode(m)} accessibilityRole="tab" accessibilityState={{ selected: mode === m }}
                style={[styles.segBtn, mode === m && styles.segOn]}>
                <Text style={[styles.segText, mode === m && styles.segTextOn]}>{m === 'total' ? 'Total' : 'Kenaikan'}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.seg}>
            {PERIODS.map((p) => (
              <Pressable key={p} onPress={() => setDays(p)} accessibilityRole="tab" accessibilityState={{ selected: days === p }}
                style={[styles.segBtn, days === p && styles.segOn]}>
                <Text style={[styles.segText, days === p && styles.segTextOn]}>{p}H</Text>
              </Pressable>
            ))}
          </View>
        </View>
        <View style={styles.chartHead}>
          <Text style={styles.chartValue}>{chart.data ? idr(periodSum) : '—'}</Text>
          <Text style={styles.chartSub}>{days} hari terakhir</Text>
        </View>
        {points.length ? <BarChart data={points} height={170} format={(v) => compactIdr(v)} summary={`Pendapatan ${days} hari terakhir ${idr(periodSum)}`} />
          : <View style={{ height: 190 }} />}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Aktivitas</Text>
        <View style={styles.tabs}>
          {([['withdraw', 'Penarikan'], ['income', 'Pendapatan'], ['bonus', 'Bonus']] as const).map(([k, label]) => (
            <Pressable key={k} onPress={() => setTab(k)} accessibilityRole="tab" accessibilityState={{ selected: tab === k }} style={[styles.tab, tab === k && styles.tabOn]}>
              <Text style={[styles.tabText, tab === k && styles.tabTextOn]}>{label}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.filters}>
          {([['pending', 'Pending'], ['done', 'Selesai'], ['failed', 'Gagal']] as const).map(([k, label]) => (
            <Pressable key={k} onPress={() => setFilter(k)} accessibilityRole="button" accessibilityState={{ selected: filter === k }}
              style={[styles.filter, filter === k && styles.filterOn]}>
              <Text style={[styles.filterText, filter === k && styles.filterTextOn]}>{label}</Text>
            </Pressable>
          ))}
        </View>
        {shown.length ? shown.slice(0, 6).map((i) => (
          <View key={i.id} style={styles.item}>
            <View style={[styles.itemIcon, { backgroundColor: i.state === 'failed' ? color.dangerSoft : i.state === 'pending' ? color.warningSoft : color.successSoft }]}>
              <Feather name={tab === 'withdraw' ? 'arrow-down-left' : tab === 'bonus' ? 'gift' : 'film'} size={15}
                color={i.state === 'failed' ? color.danger : i.state === 'pending' ? color.warning : color.success} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemTitle} numberOfLines={1}>{i.title}</Text>
              <Text style={styles.itemSub}>{dateLabel(i.at)}</Text>
            </View>
            <Text style={[styles.itemAmount, i.state === 'failed' && { color: color.textMuted, textDecorationLine: 'line-through' }]}>
              {tab === 'withdraw' ? '' : '+'}{idr(i.amount)}
            </Text>
          </View>
        )) : (
          <View style={styles.empty}>
            <Feather name="inbox" size={22} color={color.textMuted} />
            <Text style={styles.emptyText}>Belum ada {TAB_EMPTY[tab]} di filter ini.</Text>
          </View>
        )}
        {tab === 'withdraw' && d?.payouts.length ? (
          <Pressable onPress={() => router.push('/payouts')} accessibilityRole="button" style={styles.more}>
            <Text style={styles.moreText}>Lihat semua riwayat</Text><Feather name="chevron-right" size={16} color={color.link} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Metode pembayaran</Text>
        {d?.method ? (
          <Pressable onPress={() => setMethodOpen(true)} accessibilityRole="button" style={({ pressed }) => [styles.method, pressed && { opacity: 0.8 }]}>
            <ProviderTile provider={d.method.provider} size={42} />
            <View style={{ flex: 1 }}>
              <Text style={styles.itemTitle}>{d.method.provider} {maskAccount(d.method.account_number)}</Text>
              <Text style={styles.itemSub} numberOfLines={1}>{d.method.account_name}</Text>
            </View>
            <Text style={styles.moreText}>Ganti</Text>
          </Pressable>
        ) : (
          <Pressable onPress={() => setMethodOpen(true)} accessibilityRole="button" style={({ pressed }) => [styles.addMethod, pressed && { opacity: 0.8 }]}>
            <Text style={styles.addText}>Tambah metode pembayaran</Text>
            <Feather name="plus" size={18} color={color.link} />
          </Pressable>
        )}
      </View>

      {d?.level ? <View style={{ marginTop: space.lg }}><LevelProgress p={d.level} /></View> : null}

      <PaymentMethodSheet uid={uid} current={d?.method ?? null} visible={methodOpen} onClose={() => setMethodOpen(false)} onSaved={() => void q.reload()} />
      <ShareCardSheet card={shareCard} onClose={closeCard} onShare={share} title="Total payout"
        body="Semua yang sudah kamu cairkan. Simpan atau bagikan ke story." />
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.lg },
  title: { ...type.title, color: color.text, flex: 1 },
  invite: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 34, borderRadius: radius.pill,
    borderWidth: 1, borderColor: 'rgba(245,196,81,0.45)', backgroundColor: 'rgba(245,196,81,0.10)' },
  inviteText: { ...type.label, fontSize: 12, letterSpacing: 0.6, color: '#F5C451' },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: color.surfaceRaised },
  dot: { position: 'absolute', top: 9, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: color.blueLight },
  actionsRow: { flexDirection: 'row', gap: space.sm, marginBottom: space.lg },
  squareBtn: { width: 50, height: 50, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', ...card },
  withdrawBtn: { height: 50, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  withdrawText: { ...type.label, fontSize: 16, color: '#FFFFFF', fontVariant: ['tabular-nums'] },
  hero: { borderRadius: radius.xl, padding: space.xl, gap: space.sm, overflow: 'hidden', minHeight: 150, justifyContent: 'center' },
  watermark: { position: 'absolute', right: -24, bottom: -28, width: 150, height: 150, opacity: 0.14 },
  heroLabel: { ...type.caption, color: 'rgba(255,255,255,0.82)' },
  heroAmount: { ...type.display, fontSize: 38, lineHeight: 44, color: '#FFFFFF', fontVariant: ['tabular-nums'] },
  heroSkeleton: { height: 44, width: '60%', borderRadius: radius.sm, backgroundColor: 'rgba(255,255,255,0.12)' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.xs },
  chip: { ...type.caption, fontSize: 12, color: '#FFFFFF', backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)',
    paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.pill, overflow: 'hidden' },
  tiles: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
  tile: { flex: 1, padding: space.lg, gap: space.sm, borderRadius: radius.lg, borderWidth: 1 },
  tileGreen: { backgroundColor: 'rgba(52,208,122,0.07)', borderColor: 'rgba(52,208,122,0.22)' },
  tileAmber: { backgroundColor: 'rgba(255,176,32,0.07)', borderColor: 'rgba(255,176,32,0.22)' },
  tileHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tileIcon: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  tileLabel: { ...type.caption, fontSize: 12, color: color.textSecondary },
  tileValue: { ...type.heading, fontSize: 19, color: color.text, fontVariant: ['tabular-nums'] },
  terms: { ...type.caption, fontSize: 12, color: color.textMuted, textAlign: 'center', marginTop: space.sm },
  card: { ...card, borderRadius: radius.lg, padding: space.lg, marginTop: space.lg, gap: space.md },
  cardTitle: { ...type.heading, color: color.text },
  chartBar: { flexDirection: 'row', justifyContent: 'space-between', gap: space.sm },
  seg: { flexDirection: 'row', backgroundColor: color.bg, borderRadius: radius.sm, padding: 3, gap: 2 },
  segBtn: { paddingHorizontal: 10, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  segOn: { backgroundColor: color.surfaceRaised },
  segText: { ...type.caption, fontSize: 12, color: color.textMuted },
  segTextOn: { color: color.text, fontFamily: type.label.fontFamily },
  chartHead: { gap: 2 },
  chartValue: { ...type.title, fontSize: 24, color: color.text, fontVariant: ['tabular-nums'] },
  chartSub: { ...type.caption, color: color.textMuted },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: color.border },
  tab: { flex: 1, alignItems: 'center', paddingVertical: space.sm, borderBottomWidth: 2, borderBottomColor: 'transparent', marginBottom: -1 },
  tabOn: { borderBottomColor: color.blueLight },
  tabText: { ...type.label, color: color.textMuted },
  tabTextOn: { color: color.text },
  filters: { flexDirection: 'row', gap: space.sm },
  filter: { paddingHorizontal: 14, height: 32, borderRadius: radius.pill, borderWidth: 1, borderColor: color.border, alignItems: 'center', justifyContent: 'center' },
  filterOn: { backgroundColor: color.accentSoft, borderColor: 'rgba(117,178,244,0.45)' },
  filterText: { ...type.caption, color: color.textSecondary },
  filterTextOn: { color: color.link, fontFamily: type.label.fontFamily },
  item: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.xs },
  itemIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  itemTitle: { ...type.label, color: color.text },
  itemSub: { ...type.caption, fontSize: 12, color: color.textMuted },
  itemAmount: { ...type.label, color: color.text, fontVariant: ['tabular-nums'] },
  empty: { alignItems: 'center', gap: space.sm, paddingVertical: space.xl },
  emptyText: { ...type.caption, color: color.textMuted },
  more: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingTop: space.xs },
  moreText: { ...type.label, color: color.link },
  method: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  addMethod: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, height: 52, borderRadius: radius.md,
    borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(117,178,244,0.45)', backgroundColor: 'rgba(12,101,196,0.08)' },
  addText: { ...type.label, color: color.link },
});
