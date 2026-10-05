import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useState, useEffect } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { BarChart } from '@/components/BarChart';
import { Dropdown } from '@/components/Dropdown';
import { TopBar } from '@/components/TopBar';
import { ShareCardSheet } from '@/components/ShareCardSheet';
import { EmptyState } from '@/components/EmptyState';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { SkeletonBlock } from '@/components/Skeleton';
import { renderViewsCard, shareRenderedCard, type RenderedCard } from '@/lib/shareCard';
import { showAlert } from '@/lib/alert';
import { compact, idr, num } from '@/lib/format';
import { track } from '@/lib/analytics';
import { useQuery } from '@/lib/useQuery';
import { useAuth } from '@/providers/AuthProvider';
import { color, radius, space, type, card } from '@/theme/tokens';
import { CAMPAIGN_STATUS } from '@/features/campaigns/copy';
import { fetchCampaignPerf, fetchDaily, totals, trendLabel, type CampaignPerf } from '@/features/performance/api';

const RANGES = [{ value: '7', label: '7 hari terakhir' }, { value: '28', label: '28 hari terakhir' }, { value: '90', label: '90 hari terakhir' }];
const pct = (x: number | null) => (x == null ? '—' : `${(x * 100).toLocaleString('id-ID', { maximumFractionDigits: x < 0.1 ? 1 : 0 })}%`);
const dayLabel = (iso: string, days: number) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('id-ID', days <= 7 ? { weekday: 'short' } : { day: 'numeric', month: 'short' });

// Analytics (konten-style): total views, campaign/video/accepted tiles, views chart (total or daily), then per campaign.
export default function Performance() {
  useEffect(() => { track('performance_viewed'); }, []);
  const { account } = useAuth();
  const [range, setRange] = useState('28');
  const [mode, setMode] = useState<'total' | 'gain'>('total');
  const q = useQuery(async () => {
    const [daily, campaigns] = await Promise.all([fetchDaily(Number(range)), fetchCampaignPerf()]);
    return { daily, campaigns, t: totals(campaigns) };
  }, [range]);
  const d = q.data;
  const days = Number(range);
  const gain = d?.daily.reduce((a, x) => a + x.qualified_gain, 0) ?? 0;
  let run = 0;
  const points = (d?.daily ?? []).map((x) => {
    run += x.qualified_gain;
    return { key: x.day, value: mode === 'total' ? run : x.qualified_gain, label: dayLabel(x.day, days) };
  });

  const [shareCard, setShareCard] = useState<RenderedCard | null>(null);
  const [saving, setSaving] = useState(false);
  async function openCard() {
    if (!d?.t.qualifiedViews) { showAlert('Belum ada views', 'Kartu muncul setelah klipmu punya qualified views.'); return; }
    setSaving(true);
    try {
      setShareCard(await renderViewsCard({ views: d.t.qualifiedViews, campaign: 'Semua campaign', from: null, to: new Date().toISOString(),
        name: account?.fullName ?? account?.username ?? 'TAPP', avatarUrl: account?.avatarUrl ?? null }));
    } catch { /* card rendering is best effort */ } finally { setSaving(false); }
  }
  function closeCard() { if (shareCard) URL.revokeObjectURL(shareCard.url); setShareCard(null); }

  return (
    <Screen refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={q.refresh} tintColor={color.blue} />}>
      <TopBar title="Performa" back />
      {q.error && !d ? <View style={{ marginTop: space.lg }}><Notice tone="error" message={q.error} /></View> : null}

      <View style={styles.titleRow}>
        <Text style={styles.pageTitle} accessibilityRole="header">Analitik performa kamu</Text>
        <Pressable onPress={openCard} disabled={saving} accessibilityRole="button" accessibilityLabel="Simpan kartu views"
          style={({ pressed }) => [styles.squareBtn, pressed && { opacity: 0.7 }]}>
          <Feather name={saving ? 'loader' : 'download'} size={18} color={color.text} />
        </Pressable>
      </View>

      <LinearGradient colors={['rgba(12,101,196,0)', 'rgba(12,101,196,0.3)']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.hero}>
        <View style={styles.heroHead}><Feather name="play" size={18} color={color.textSecondary} /><Text style={styles.heroLabel}>Total views</Text></View>
        <View style={{ flex: 1 }} />
        {d ? <Text style={styles.heroValue} numberOfLines={1} adjustsFontSizeToFit>{num(d.t.rawViews)} <Text style={styles.heroUnit}>Views</Text></Text>
          : <SkeletonBlock width="50%" height={44} />}
        {d && d.t.qualificationRate != null ? <Text style={styles.heroSub}>{num(d.t.qualifiedViews)} qualified · {pct(d.t.qualificationRate)} lolos verifikasi</Text> : null}
      </LinearGradient>

      <View style={styles.tiles}>
        <Tile icon="flag" label="Campaign" value={d?.t.campaigns} unit="Campaign" tint="#B18CFF" />
        <Tile icon="video" label="Total video" value={d?.t.posts} unit="Video" tint="#75B2F4" />
        <Tile icon="check-square" label="Diterima" value={d?.t.approvedPosts} unit="Video" tint="#B8E86B" />
      </View>

      <View style={styles.chartCard}>
        <Text style={styles.cardTitle}>Qualified views</Text>
        <View style={styles.chartBar}>
          <View style={styles.seg}>
            {(['total', 'gain'] as const).map((m) => (
              <Pressable key={m} onPress={() => setMode(m)} accessibilityRole="tab" accessibilityState={{ selected: mode === m }}
                style={[styles.segBtn, mode === m && styles.segOn]}>
                <Text style={[styles.segText, mode === m && styles.segTextOn]}>{m === 'total' ? 'Total' : 'Kenaikan'}</Text>
              </Pressable>
            ))}
          </View>
          <View style={{ flex: 1 }}><Dropdown label="Periode" value={range} options={RANGES} onChange={setRange} /></View>
        </View>
        {!d ? <SkeletonBlock width="100%" height={200} /> : (
          <>
            <Text style={styles.chartValue}>+{num(gain)} <Text style={styles.chartUnit}>dalam {days} hari</Text></Text>
            <BarChart data={points} height={180} format={(v) => num(v)} summary={`${num(gain)} qualified views baru dalam ${days} hari terakhir`} />
          </>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Per campaign</Text>
        {d && !d.campaigns.length ? (
          <EmptyState title="Belum ada data performa" body="Data muncul setelah kamu submit klip dan views-nya mulai dilacak."
            action={{ label: 'Cari campaign', onPress: () => router.navigate('/dashboard/campaigns') }} />
        ) : null}
        {d?.campaigns.map((c) => <CampaignRow key={c.campaign_id} c={c} />)}
      </View>

      <ShareCardSheet card={shareCard} onClose={closeCard} title="Total views" body="Semua qualified views kamu. Simpan atau bagikan ke story."
        onShare={async () => { if (shareCard) await shareRenderedCard(shareCard).catch(() => {}); }} />
    </Screen>
  );
}

function Tile({ icon, label, value, unit, tint }: { icon: 'flag' | 'video' | 'check-square'; label: string; value: number | undefined; unit: string; tint: string }) {
  return (
    <LinearGradient colors={['rgba(255,255,255,0.02)', `${tint}2E`]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={[styles.tile, { borderColor: `${tint}44` }]}>
      <View style={styles.tileHead}><Feather name={icon} size={13} color={color.textSecondary} /><Text style={styles.tileLabel} numberOfLines={1}>{label}</Text></View>
      <Text style={[styles.tileValue, { color: tint }]} numberOfLines={1}>{value == null ? '—' : num(value)} <Text style={styles.tileUnit}>{unit}</Text></Text>
    </LinearGradient>
  );
}

function CampaignRow({ c }: { c: CampaignPerf }) {
  const t = trendLabel(c.gain_7d, c.gain_prev_7d);
  const icon = t?.tone === 'up' ? 'trending-up' : t?.tone === 'down' ? 'trending-down' : 'minus';
  const tint = t?.tone === 'up' ? color.success : t?.tone === 'down' ? color.danger : color.textMuted;
  return (
    <Pressable onPress={() => router.push({ pathname: '/workspace/[id]', params: { id: c.campaign_id } })}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]} accessibilityRole="button">
      <View style={styles.rowHead}>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle} numberOfLines={1}>{c.title}</Text>
          <Text style={styles.rowMeta}>{[c.brand_name, CAMPAIGN_STATUS[c.campaign_status as keyof typeof CAMPAIGN_STATUS] ?? c.campaign_status].filter(Boolean).join(' · ')}</Text>
        </View>
        <Feather name="chevron-right" size={18} color={color.borderStrong} />
      </View>
      <View style={styles.rowStats}>
        <Mini label="Klip" value={`${c.approved_posts}/${c.posts}`} />
        <Mini label="Views" value={compact(c.raw_views)} />
        <Mini label="Qualified" value={compact(c.qualified_views)} />
        <Mini label="Penghasilan" value={idr(c.earned)} />
      </View>
      {t ? (
        <View style={styles.trend}>
          <Feather name={icon} size={14} color={tint} />
          <Text style={[styles.trendText, { color: tint }]}>{t.text}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}
function Mini({ label, value }: { label: string; value: string }) {
  return <View style={{ flex: 1, gap: 2 }}><Text style={styles.miniValue} numberOfLines={1}>{value}</Text><Text style={styles.miniLabel}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md, marginTop: space.xl },
  pageTitle: { ...type.title, fontSize: 24, color: color.text, flex: 1 },
  squareBtn: { width: 46, height: 46, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', ...card },
  hero: { marginTop: space.lg, minHeight: 190, padding: space.xl, borderRadius: radius.lg, borderWidth: 1, borderColor: 'rgba(117,178,244,0.22)',
    backgroundColor: '#0B0D14', gap: space.xs },
  heroHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  heroLabel: { ...type.heading, color: color.textSecondary },
  heroValue: { ...type.display, fontSize: 44, lineHeight: 50, color: color.blueLight, fontVariant: ['tabular-nums'] },
  heroUnit: { ...type.heading, color: color.blueLight },
  heroSub: { ...type.caption, color: color.textMuted },
  tiles: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  tile: { flex: 1, minHeight: 110, padding: space.md, borderRadius: radius.lg, borderWidth: 1, justifyContent: 'space-between', backgroundColor: '#0B0B10' },
  tileHead: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  tileLabel: { ...type.caption, fontSize: 12, color: color.textSecondary, flex: 1 },
  tileValue: { ...type.heading, fontSize: 22, fontVariant: ['tabular-nums'] },
  tileUnit: { ...type.caption, fontSize: 12 },
  chartCard: { ...card, borderRadius: radius.lg, padding: space.lg, marginTop: space.lg, gap: space.md },
  cardTitle: { ...type.heading, fontSize: 20, color: color.text },
  chartBar: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
  seg: { flexDirection: 'row', backgroundColor: color.bg, borderRadius: radius.md, padding: 3, gap: 2, borderWidth: 1, borderColor: color.border },
  segBtn: { paddingHorizontal: 12, height: 34, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  segOn: { backgroundColor: color.blue },
  segText: { ...type.label, fontSize: 13, color: color.textMuted },
  segTextOn: { color: '#FFFFFF' },
  chartValue: { ...type.title, fontSize: 24, color: color.text, fontVariant: ['tabular-nums'] },
  chartUnit: { ...type.caption, color: color.textMuted },
  section: { marginTop: space.xxl, gap: space.md },
  sectionTitle: { ...type.heading, color: color.text },
  row: { paddingVertical: space.lg, gap: space.md, borderBottomWidth: 1, borderBottomColor: color.border },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  rowTitle: { ...type.heading, color: color.text },
  rowMeta: { ...type.caption, color: color.textMuted },
  rowStats: { flexDirection: 'row' },
  miniValue: { ...type.label, color: color.text, fontVariant: ['tabular-nums'] },
  miniLabel: { ...type.caption, color: color.textMuted },
  trend: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  trendText: { ...type.caption },
});
