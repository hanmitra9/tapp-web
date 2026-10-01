import { router } from 'expo-router';
import { useState, useEffect } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Chips } from '@/components/Chips';
import { EmptyState } from '@/components/EmptyState';
import { Header } from '@/components/Header';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { SkeletonBlock } from '@/components/Skeleton';
import { dateLabel, idr, num } from '@/lib/format';
import { track } from '@/lib/analytics';
import { useQuery } from '@/lib/useQuery';
import { useAuth } from '@/providers/AuthProvider';
import { color, radius, space, type } from '@/theme/tokens';
import { fetchEarnings, nextMaturity, type EarningRow } from '@/features/campaigns/earnings';
import { fetchCampaignPerf } from '@/features/performance/api';
import { Button } from '@/components/Button';
import { BalanceCard, cardFootText } from '@/components/BalanceCard';
import { StatusBadge } from '@/components/StatusBadge';
import { fetchPayouts, OPEN, PAYOUT_STATUS } from '@/features/payouts/api';

type Filter = 'all' | 'pending' | 'available' | 'paid';
const FILTERS = [{ value: 'all', label: 'Semua' }, { value: 'pending', label: 'Tertunda' }, { value: 'available', label: 'Tersedia' }, { value: 'paid', label: 'Dibayar' }];

// Effective state as the creator sees it (matured pending rows are already payable).
function stateOf(e: EarningRow): Filter | 'in_payout' {
  if (e.status === 'paid') return 'paid';
  if (e.payout_request_id) return 'in_payout';
  if (e.status === 'available' || (e.status === 'pending' && new Date(e.available_at) <= new Date())) return 'available';
  return 'pending';
}
const STATE_LABEL: Record<string, string> = { pending: 'Tertunda', available: 'Tersedia', paid: 'Dibayar', in_payout: 'Sedang dicairkan' };

// Earnings are payable amounts, not a wallet.
export default function Earnings() {
  useEffect(() => { track('earnings_viewed'); }, []);
  const { session, account } = useAuth();
  const [filter, setFilter] = useState<Filter>('all');
  const q = useQuery(async () => {
    const [e, perf, payouts] = await Promise.all([fetchEarnings(session!.user.id), fetchCampaignPerf(), fetchPayouts()]);
    return { ...e, byCampaign: perf.filter((p) => p.earned !== 0), open: payouts.find((p) => OPEN.includes(p.status)) ?? null };
  }, [session?.user.id]);
  const d = q.data;
  const s = d?.summary;
  const next = d ? nextMaturity(d.rows) : null;
  const rows = (d?.rows ?? []).filter((e) => filter === 'all' || stateOf(e) === filter);

  return (
    <Screen inTabs refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={q.refresh} tintColor={color.blue} />}>
      <Header title="Penghasilan" back={false} />
      {q.error && !d ? <Notice tone="error" message={q.error} /> : null}

      <View style={styles.hero}>
        <BalanceCard label="Tersedia untuk dicairkan" amount={s ? idr(Math.max(s.available, 0)) : null}
          footLeft={d && s ? <Text style={cardFootText}>
            {s.available >= d.minPayout ? 'Siap dicairkan' : `Min. ${idr(d.minPayout)} · kurang ${idr(d.minPayout - Math.max(s.available, 0))}`}
          </Text> : null}
          footRight={s ? <Text style={cardFootText}>Dibayar {idr(s.paid)}</Text> : null} />
      </View>

      {d && s ? (
        d.open ? (
          <Pressable style={styles.open} onPress={() => router.push('/payouts')} accessibilityRole="button">
            <View style={{ flex: 1 }}>
              <Text style={styles.openTitle}>Pencairan {idr(d.open.amount)}</Text>
              <Text style={styles.openMeta}>Ketuk untuk melihat status</Text>
            </View>
            <StatusBadge label={PAYOUT_STATUS[d.open.status].label} tone={PAYOUT_STATUS[d.open.status].tone} />
          </Pressable>
        ) : (
          <View style={styles.cta}>
            <Button label="Cairkan" onPress={() => router.push('/payout/request')}
              disabled={s.available < d.minPayout || account?.status !== 'active'} />
          </View>
        )
      ) : null}

      <View style={styles.split}>
        <Cell label="Tertunda" value={s ? idr(s.pending) : null} />
        <Cell label="Sedang dicairkan" value={s ? idr(s.in_payout) : null} />
        <Cell label="Sudah dibayar" value={s ? idr(s.paid) : null} />
      </View>
      {next ? <Text style={styles.next}>{idr(next.amount)} akan tersedia pada {dateLabel(next.at)}.</Text> : null}

      {d ? (
        <View style={styles.explain}>
          <Text style={styles.explainTitle}>Cara penghasilan dihitung</Text>
          <Text style={styles.explainBody}>
            Qualified views × CPM campaign ÷ 1.000. Penghasilan baru tertunda {d.holdDays} hari untuk verifikasi, lalu bisa dicairkan ke rekening atau e-wallet yang terdaftar.
          </Text>
          <View style={{ flexDirection: 'row', gap: space.xl }}>
            <Pressable onPress={() => router.push('/performance')} hitSlop={8}><Text style={styles.link}>Lihat performa</Text></Pressable>
            <Pressable onPress={() => router.push('/payouts')} hitSlop={8}><Text style={styles.link}>Riwayat pencairan</Text></Pressable>
          </View>
        </View>
      ) : null}

      {d && d.byCampaign.length ? (
        <>
          <Text style={styles.section}>Per campaign</Text>
          {d.byCampaign.map((c) => (
            <Pressable key={c.campaign_id} style={styles.row} onPress={() => router.push({ pathname: '/workspace/[id]', params: { id: c.campaign_id } })}>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle} numberOfLines={1}>{c.title}</Text>
                <Text style={styles.rowMeta}>{num(c.qualified_views)} qualified views · {idr(c.cpm)}/1.000</Text>
              </View>
              <Text style={styles.total}>{idr(c.earned)}</Text>
            </Pressable>
          ))}
        </>
      ) : null}

      <Text style={styles.section}>Riwayat</Text>
      {d && d.rows.length ? <Chips options={FILTERS} value={[filter]} onChange={([f]) => f && setFilter(f as Filter)} /> : null}
      {d && !d.rows.length ? (
        <EmptyState title="Belum ada penghasilan" body="Penghasilan muncul setelah klipmu disetujui dan qualified views-nya dihitung."
          action={{ label: 'Cari campaign', onPress: () => router.navigate('/campaigns') }} />
      ) : null}
      {d && d.rows.length && !rows.length ? <Text style={styles.muted}>Tidak ada riwayat dengan status ini.</Text> : null}
      {rows.map((e) => <Row key={e.id} e={e} />)}
    </Screen>
  );
}

function Cell({ label, value }: { label: string; value: string | null }) {
  return (
    <View style={styles.cell}>
      <Text style={styles.cellLabel}>{label}</Text>
      {value == null ? <SkeletonBlock width="70%" height={18} /> : <Text style={styles.cellValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>}
    </View>
  );
}

function Row({ e }: { e: EarningRow }) {
  const st = stateOf(e);
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle} numberOfLines={1}>{e.campaign?.title ?? 'Campaign'}</Text>
        <Text style={styles.rowMeta}>
          {dateLabel(e.created_at)} · {e.qualified_views_delta >= 0 ? '+' : '−'}{num(Math.abs(e.qualified_views_delta))} qualified views
        </Text>
        <Text style={[styles.rowMeta, st === 'available' && { color: color.success }]}>
          {e.amount < 0 ? 'Penyesuaian setelah verifikasi ulang' : STATE_LABEL[st]}{st === 'pending' ? ` sampai ${dateLabel(e.available_at)}` : ''}
        </Text>
      </View>
      <Text style={[styles.amount, e.amount < 0 && { color: color.danger }]}>{e.amount < 0 ? '−' : '+'}{idr(Math.abs(e.amount))}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { marginTop: -space.md },
  heroLabel: { ...type.label, color: color.textMuted },
  heroValue: { ...type.display, fontVariant: ['tabular-nums'], color: color.text },
  heroNote: { ...type.caption, color: color.textMuted },
  split: { flexDirection: 'row', marginTop: space.lg, gap: space.sm },
  cell: { flex: 1, padding: space.md, gap: 4, backgroundColor: color.surface, borderRadius: radius.md },
  cellLabel: { ...type.caption, color: color.textMuted },
  cellValue: { ...type.heading, color: color.text, fontVariant: ['tabular-nums'] },
  next: { ...type.caption, color: color.textSecondary, marginTop: space.md },
  cta: { marginTop: space.lg },
  open: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.lg, padding: space.lg, borderRadius: radius.md, borderWidth: 1, borderColor: color.border },
  openTitle: { ...type.label, color: color.text, fontVariant: ['tabular-nums'] },
  openMeta: { ...type.caption, color: color.textMuted },
  explain: { marginTop: space.xl, padding: space.lg, gap: space.sm, backgroundColor: color.surface, borderRadius: radius.md },
  explainTitle: { ...type.label, color: color.text },
  explainBody: { ...type.caption, color: color.textSecondary },
  link: { ...type.label, color: color.blue },
  section: { ...type.heading, color: color.text, marginTop: space.xxl, marginBottom: space.sm },
  muted: { ...type.body, color: color.textMuted, marginTop: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.lg, borderBottomWidth: 1, borderBottomColor: color.border },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { ...type.label, color: color.text },
  rowMeta: { ...type.caption, color: color.textMuted, fontVariant: ['tabular-nums'] },
  amount: { ...type.label, color: color.success, fontVariant: ['tabular-nums'] },
  total: { ...type.label, color: color.text, fontVariant: ['tabular-nums'] },
});
