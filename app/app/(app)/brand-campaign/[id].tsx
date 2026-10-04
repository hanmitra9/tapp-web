import Feather from '@expo/vector-icons/Feather';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { BarChart } from '@/components/BarChart';
import { Header } from '@/components/Header';
import { LoadState } from '@/components/LoadState';
import { Screen } from '@/components/Screen';
import { Segmented } from '@/components/Segmented';
import { SkeletonBlock } from '@/components/Skeleton';
import { StatusBadge } from '@/components/StatusBadge';
import { compact, dateLabel, idr, num } from '@/lib/format';
import { useAutoRefresh } from '@/lib/useAutoRefresh';
import { useQuery } from '@/lib/useQuery';
import { CostCard, Freshness, HashtagReach, ViewsBreakdown } from '@/features/brand/ReportParts';
import { web } from '@/theme/web';
import { color, radius, space, type, card } from '@/theme/tokens';
import { BRAND_STATUS, fetchBrandCampaigns, fetchBrandDaily, fetchHashtagStats, fetchPlatformBreakdown, fetchTopClips } from '@/features/brand/api';
import { platformLabel, type Platform } from '@/features/creator/options';

const RANGES = [{ value: '7', label: '7 hari' }, { value: '30', label: '30 hari' }, { value: '90', label: '90 hari' }];
const dayLabel = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });

// Brand report for one campaign: budget, funnel, trend, platforms, best clips. Read-only.
export default function BrandCampaignReport() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [range, setRange] = useState('30');
  const q = useQuery(async () => {
    const [all, platforms, clips, tags] = await Promise.all([fetchBrandCampaigns(), fetchPlatformBreakdown(id), fetchTopClips(id), fetchHashtagStats(id)]);
    const c = all.find((x) => x.id === id);
    if (!c) throw { code: 'campaign_not_found' };
    return { c, platforms, clips, tags };
  }, [id]);
  const daily = useQuery(() => fetchBrandDaily(id, Number(range)), [id, range]);
  const reloadAll = useCallback(async () => { await Promise.all([q.reload(), daily.reload()]); }, [q.reload, daily.reload]);
  const refreshedAt = useAutoRefresh(reloadAll);

  if (!q.data) return <Screen scroll={false}><Header title="Laporan campaign" /><LoadState error={q.error} onRetry={q.reload} /></Screen>;
  const { c, platforms, clips, tags } = q.data;
  const used = c.budget ? Math.min(1, c.spent / c.budget) : 0;
  const qualRate = c.raw_views ? c.qualified_views / c.raw_views : null;
  const funnel = [
    { l: 'Kreator bergabung', v: c.creators_joined },
    { l: 'Klip disubmit', v: c.submissions },
    { l: 'Klip disetujui', v: c.approved },
  ];
  const top = Math.max(1, ...funnel.map((f) => f.v));
  const st = BRAND_STATUS[c.status];
  const gain = daily.data?.reduce((a, x) => a + x.qualified_gain, 0) ?? 0;

  return (
    <Screen refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={async () => { await q.refresh(); await daily.refresh(); }} tintColor={color.blue} />}>
      <Header title="" />
      <View style={styles.headRow}>
        <Text style={styles.brand}>{c.brand_name}</Text>
        <StatusBadge label={st.label} tone={st.tone} />
      </View>
      <Text style={styles.title} accessibilityRole="header">{c.title}</Text>
      <Text style={styles.meta}>{idr(c.cpm)} per 1.000 qualified views · {c.platforms.map((p) => platformLabel(p as Platform)).join(', ')}
        {c.submission_deadline ? ` · deadline ${dateLabel(c.submission_deadline)}` : ''}</Text>
      <Freshness metricsAt={c.last_metrics_at} qualifiedAt={c.last_qualified_at} refreshedAt={refreshedAt} />

      <View style={styles.budgetCard}>
        <View style={styles.budgetTop}>
          <View><Text style={styles.cap}>Terpakai</Text><Text style={styles.budgetValue}>{idr(c.spent)}</Text></View>
          <View style={{ alignItems: 'flex-end' }}><Text style={styles.cap}>Sisa budget</Text><Text style={styles.budgetSide}>{idr(c.remaining)}</Text></View>
        </View>
        <View style={styles.track} {...web('track')}><View style={[styles.fill, { width: `${Math.max(used * 100, 1)}%` }]} {...web(used >= 0.9 ? 'seg-p' : 'seg-q')} /></View>
        <Text style={styles.cap}>{Math.round(used * 100)}% dari budget views {idr(c.budget)} · fee kerjasama {c.fee_pct}% ditagih terpisah</Text>
      </View>

      <View style={styles.grid}>
        <Stat label="Qualified views" value={num(c.qualified_views)} />
        <Stat label="Views mentah" value={num(c.raw_views)} />
        <Stat label="Effective CPM" value={c.effective_cpm == null ? '—' : idr(c.effective_cpm)} />
        <Stat label="Views lolos verifikasi" value={qualRate == null ? '—' : `${Math.round(qualRate * 100)}%`} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Ke mana views mentah pergi</Text>
        <ViewsBreakdown raw={c.raw_views} qualified={c.qualified_views} pending={c.pending_views} excluded={c.excluded_views} />
      </View>

      {tags.length ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Jangkauan hashtag</Text>
          <HashtagReach stats={tags} />
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Biaya &amp; CPM</Text>
        <CostCard spent={c.spent} fee={c.platform_fee} feePct={c.fee_pct} total={c.total_cost} effectiveCpm={c.effective_cpm} cpm={c.cpm} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Funnel kreator</Text>
        {funnel.map((f, i) => (
          <View key={f.l} style={styles.funnelRow}>
            <Text style={styles.funnelLabel}>{f.l}</Text>
            <View style={styles.funnelTrack} {...web('track')}><View style={[styles.funnelFill, { width: `${Math.max((f.v / top) * 100, 2)}%` }]} {...web('seg-q')} /></View>
            <Text style={styles.funnelValue}>{num(f.v)}</Text>
            <Text style={styles.funnelPct}>{i && funnel[i - 1]!.v ? `${Math.round((f.v / funnel[i - 1]!.v) * 100)}%` : ''}</Text>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Qualified views per hari</Text>
        <Segmented options={RANGES} value={range} onChange={setRange} />
        {!daily.data ? <SkeletonBlock width="100%" height={180} /> : gain > 0 ? (
          <BarChart data={daily.data.map((x) => ({ key: x.day, value: x.qualified_gain, label: dayLabel(x.day) }))}
            format={(v) => `+${compact(v)}`} summary={`${num(gain)} qualified views dalam ${range} hari`} />
        ) : <Text style={styles.muted}>Belum ada qualified views dalam {range} hari terakhir.</Text>}
      </View>

      {platforms.length ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Per platform</Text>
          {platforms.map((p) => (
            <View key={p.platform} style={styles.platRow}>
              <Text style={styles.platName}>{platformLabel(p.platform as Platform)}</Text>
              <Text style={styles.platMeta}>{p.approved} klip · {compact(p.qualified_views)} views</Text>
              <Text style={styles.platSpend}>{idr(p.earned)}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Klip terbaik</Text>
        {!clips.length ? <Text style={styles.muted}>Belum ada klip yang disetujui.</Text> : null}
        {clips.map((k, i) => (
          <Pressable key={k.submission_id} onPress={() => Linking.openURL(k.post_url).catch(() => {})} accessibilityRole="link"
            style={({ pressed }) => [styles.clip, pressed && { opacity: 0.6 }]}>
            <Text style={styles.rank}>{i + 1}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.clipTitle}>@{k.creator_username ?? 'kreator'} <Text style={styles.clipPlat}>· {platformLabel(k.platform as Platform)}</Text></Text>
              <Text style={styles.cap}>{compact(k.qualified_views)} qualified dari {compact(k.raw_views)} views{k.pending_views ? ` · ${compact(k.pending_views)} menunggu verifikasi` : ''} · {dateLabel(k.published_at)}</Text>
            </View>
            <Text style={styles.platSpend}>{idr(k.spend)}</Text>
            <Feather name="external-link" size={14} color={color.textMuted} />
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <View style={styles.stat}><Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text><Text style={styles.cap}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: -space.xl },
  brand: { ...type.label, color: color.textSecondary },
  title: { ...type.title, color: color.text, marginTop: space.xs },
  meta: { ...type.caption, color: color.textMuted, marginTop: space.xs },
  budgetCard: { marginTop: space.xl, ...card, borderRadius: radius.lg, padding: space.lg, gap: space.md },
  budgetTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  budgetValue: { ...type.metric, fontSize: 26, color: color.text },
  budgetSide: { ...type.heading, color: color.success, fontVariant: ['tabular-nums'] },
  track: { height: 8, borderRadius: 4, backgroundColor: color.surfaceRaised, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4, backgroundColor: color.blue },
  cap: { ...type.caption, color: color.textMuted, fontVariant: ['tabular-nums'] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.lg },
  stat: { flexGrow: 1, flexBasis: '45%', padding: space.lg, gap: 4, ...card, borderRadius: radius.lg },
  statValue: { ...type.metric, fontSize: 20, lineHeight: 24, color: color.text },
  section: { marginTop: space.xxl, gap: space.md },
  sectionTitle: { ...type.heading, color: color.text },
  funnelRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  funnelLabel: { ...type.caption, color: color.textSecondary, width: 120 },
  funnelTrack: { flex: 1, height: 10, borderRadius: 5, backgroundColor: color.surface, overflow: 'hidden' },
  funnelFill: { height: 10, borderRadius: 5, backgroundColor: color.blue },
  funnelValue: { ...type.label, color: color.text, width: 44, textAlign: 'right', fontVariant: ['tabular-nums'] },
  funnelPct: { ...type.caption, color: color.textMuted, width: 38, textAlign: 'right', fontVariant: ['tabular-nums'] },
  muted: { ...type.body, color: color.textMuted },
  platRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: color.border },
  platName: { ...type.label, color: color.text, width: 90 },
  platMeta: { ...type.caption, color: color.textMuted, flex: 1 },
  platSpend: { ...type.label, color: color.text, fontVariant: ['tabular-nums'] },
  clip: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: color.border },
  rank: { ...type.heading, color: color.blueLight, width: 20, fontVariant: ['tabular-nums'] },
  clipTitle: { ...type.label, color: color.text },
  clipPlat: { ...type.caption, color: color.textMuted },
});
