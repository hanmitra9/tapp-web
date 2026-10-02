import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useState, useEffect } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { BarChart } from '@/components/BarChart';
import { Segmented } from '@/components/Segmented';
import { EmptyState } from '@/components/EmptyState';
import { Header } from '@/components/Header';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { SkeletonBlock } from '@/components/Skeleton';
import { compact, idr, num } from '@/lib/format';
import { track } from '@/lib/analytics';
import { useQuery } from '@/lib/useQuery';
import { color, radius, space, type } from '@/theme/tokens';
import { CAMPAIGN_STATUS } from '@/features/campaigns/copy';
import { fetchCampaignPerf, fetchDaily, totals, trendLabel, type CampaignPerf } from '@/features/performance/api';

const RANGES = [{ value: '7', label: '7 hari' }, { value: '30', label: '30 hari' }, { value: '90', label: '90 hari' }];
const pct = (x: number | null) => (x == null ? '—' : `${(x * 100).toFixed(x < 0.1 ? 1 : 0)}%`);
const dayLabel = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });

export default function Performance() {
  useEffect(() => { track('performance_viewed'); }, []);
  const [range, setRange] = useState('30');
  const q = useQuery(async () => {
    const [daily, campaigns] = await Promise.all([fetchDaily(Number(range)), fetchCampaignPerf()]);
    return { daily, campaigns, t: totals(campaigns) };
  }, [range]);
  const d = q.data;
  const gain = d?.daily.reduce((a, x) => a + x.qualified_gain, 0) ?? 0;
  const earnedInRange = d?.daily.reduce((a, x) => a + x.earned, 0) ?? 0;

  return (
    <Screen refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={q.refresh} tintColor={color.blue} />}>
      <Header title="Performa" subtitle="Views mentah dari platform, dan qualified views yang sudah diverifikasi TAPP dan dibayar." />
      {q.error && !d ? <Notice tone="error" message={q.error} /> : null}

      <View style={styles.grid}>
        <Stat label="Total views" value={d ? compact(d.t.rawViews) : null} />
        <Stat label="Qualified views" value={d ? compact(d.t.qualifiedViews) : null} />
        <Stat label="Klip disetujui" value={d ? `${d.t.approvedPosts} / ${d.t.posts}` : null} />
        <Stat label="Campaign" value={d ? String(d.t.campaigns) : null} />
        <Stat label="Engagement" value={d ? pct(d.t.engagementRate) : null} hint="(likes + komentar + share) / views" />
        <Stat label="Penghasilan" value={d ? idr(d.t.earned) : null} />
      </View>
      {d && d.t.qualificationRate != null ? (
        <Text style={styles.note}>
          {pct(d.t.qualificationRate)} dari views kamu lolos verifikasi. Views dari bot, promosi berbayar, atau lonjakan tidak wajar tidak dihitung.
        </Text>
      ) : null}

      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Qualified views per hari</Text>
        </View>
        <Segmented options={RANGES} value={range} onChange={setRange} />
        {!d ? <SkeletonBlock width="100%" height={150} /> : gain > 0 ? (
          <>
            <Text style={styles.big}>+{num(gain)} <Text style={styles.bigUnit}>qualified views · {idr(earnedInRange)}</Text></Text>
            <BarChart
              data={d.daily.map((x) => ({ key: x.day, value: x.qualified_gain, label: dayLabel(x.day) }))}
              format={(v) => `+${num(v)}`}
              summary={`${num(gain)} qualified views baru dalam ${range} hari terakhir`}
            />
          </>
        ) : (
          <Text style={styles.muted}>Belum ada qualified views baru dalam {range} hari terakhir.</Text>
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
    </Screen>
  );
}

function Stat({ label, value, hint }: { label: string; value: string | null; hint?: string }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label}: ${value ?? 'memuat'}`}>
      {value == null ? <SkeletonBlock width="60%" height={22} /> : <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>}
      <Text style={styles.statLabel}>{label}</Text>
      {hint ? <Text style={styles.statHint}>{hint}</Text> : null}
    </View>
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
          <Text style={styles.rowMeta}>{c.brand_name} · {CAMPAIGN_STATUS[c.campaign_status as keyof typeof CAMPAIGN_STATUS] ?? c.campaign_status}</Text>
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
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: -space.md },
  stat: { flexGrow: 1, flexBasis: '45%', padding: space.lg, gap: 4, backgroundColor: color.surface, borderRadius: radius.lg },
  statValue: { ...type.metric, fontSize: 22, lineHeight: 26, color: color.text },
  statLabel: { ...type.caption, color: color.textMuted },
  statHint: { ...type.caption, fontSize: 11, color: color.textMuted },
  note: { ...type.caption, color: color.textSecondary, marginTop: space.md },
  section: { marginTop: space.xxl, gap: space.md },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between' },
  sectionTitle: { ...type.heading, color: color.text },
  big: { ...type.title, color: color.text, fontVariant: ['tabular-nums'] },
  bigUnit: { ...type.caption, color: color.textMuted },
  muted: { ...type.body, color: color.textMuted },
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
