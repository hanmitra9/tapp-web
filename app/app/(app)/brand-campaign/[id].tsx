import Feather from '@expo/vector-icons/Feather';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
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
import { BudgetHero, HashtagTile, Kpi, KpiGrid, Section, canExport, downloadCsv, printReport } from '@/features/brand/ui';
import { web } from '@/theme/web';
import { color, radius, space, type, card } from '@/theme/tokens';
import { BRAND_STATUS, CLIP_STATUS, fetchBrandCampaigns, fetchBrandDaily, fetchBrandSubmissions, fetchHashtagStats, fetchPlatformBreakdown,
  waTopUp, type Clip } from '@/features/brand/api';
import { platformLabel, type Platform } from '@/features/creator/options';

const TABS = [{ value: 'detail', label: 'Detail' }, { value: 'subs', label: 'Submission' }, { value: 'stats', label: 'Analitik' }, { value: 'clips', label: 'Klip' }];
const RANGES = [{ value: '7', label: '7 hari' }, { value: '30', label: '30 hari' }, { value: '90', label: '90 hari' }];
const FILTERS = [{ value: 'all', label: 'Semua' }, { value: 'review', label: 'Direview' }, { value: 'ok', label: 'Disetujui' }, { value: 'no', label: 'Ditolak' }];
const dayLabel = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
const handle = (k: Clip) => `@${k.creator_username ?? 'kreator'}`;

// Brand report for one campaign, in four tabs: Detail, Submission, Analitik, Klip. Read-only.
export default function BrandCampaignReport() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [tab, setTab] = useState('detail');
  const [range, setRange] = useState('30');
  const [filter, setFilter] = useState('all');
  const q = useQuery(async () => {
    const [all, platforms, subs, tags] = await Promise.all([fetchBrandCampaigns(), fetchPlatformBreakdown(id), fetchBrandSubmissions(id), fetchHashtagStats(id)]);
    const c = all.find((x) => x.id === id);
    if (!c) throw { code: 'campaign_not_found' };
    return { c, platforms, subs, tags };
  }, [id]);
  const daily = useQuery(() => fetchBrandDaily(id, Number(range)), [id, range]);
  const reloadAll = useCallback(async () => { await Promise.all([q.reload(), daily.reload()]); }, [q.reload, daily.reload]);
  const refreshedAt = useAutoRefresh(reloadAll);
  const subs = useMemo(() => (q.data?.subs ?? []).filter((k) => filter === 'all' || CLIP_STATUS[k.status]?.group === filter), [q.data, filter]);

  if (!q.data) return <Screen scroll={false}><Header title="Campaign" /><LoadState error={q.error} onRetry={q.reload} /></Screen>;
  const { c, platforms, tags } = q.data;
  const st = BRAND_STATUS[c.status];
  const gain = daily.data?.reduce((a, x) => a + x.qualified_gain, 0) ?? 0;
  const top = [...q.data.subs].filter((k) => CLIP_STATUS[k.status]?.group === 'ok').sort((a, b) => b.qualified_views - a.qualified_views);
  const funnel = [{ l: 'Kreator', v: c.creators_joined }, { l: 'Video masuk', v: c.submissions }, { l: 'Disetujui', v: c.approved }];
  const fmax = Math.max(1, ...funnel.map((f) => f.v));
  const saving = c.effective_cpm != null && c.cpm ? Math.round((1 - c.effective_cpm / c.cpm) * 100) : null;

  function exportPdf() {
    const all = q.data!.subs;
    printReport({
      title: c.title, subtitle: `${c.brand_name} · ${idr(c.cpm)} / 1K views · ${st.label}`,
      kpis: [['Views terverifikasi', num(c.qualified_views)], ['Views mentah', num(c.raw_views)], ['Effective CPM', c.effective_cpm == null ? '—' : idr(c.effective_cpm)],
        ['CPM asli', idr(c.cpm)], ['Budget', idr(c.budget)], ['Terpakai', idr(c.spent)], ['Total biaya', idr(c.total_cost)], ['Sisa budget', idr(c.remaining)],
        ['Video masuk', num(c.submissions)], ['Disetujui', num(c.approved)], ['Kreator', num(c.creators_joined)],
        ['Views hashtag', tags.length ? num(tags.at(-1)!.view_count) : '—']],
      tables: [
        { title: 'Per platform', head: ['Platform', 'Video', 'Views', 'Biaya'], rows: platforms.map((p) => [platformLabel(p.platform as Platform), p.approved, num(p.qualified_views), idr(p.earned)]) },
        { title: 'Klip terbaik', head: ['#', 'Kreator', 'Platform', 'Views lolos', 'Biaya'], rows: top.slice(0, 10).map((k, i) => [i + 1, handle(k), platformLabel(k.platform as Platform), num(k.qualified_views), idr(k.spend)]) },
        { title: `Semua video (${all.length})`, head: ['Kreator', 'Platform', 'Status', 'Tanggal', 'Views', 'Lolos', 'Biaya'],
          rows: all.map((k) => [handle(k), platformLabel(k.platform as Platform), CLIP_STATUS[k.status]?.label ?? k.status, k.published_at ? dateLabel(k.published_at) : '—', num(k.raw_views), num(k.qualified_views), idr(k.spend)]) },
      ],
    });
  }

  function exportCsv() {
    downloadCsv(`${c.title.replace(/[^\w-]+/g, '_')}_submission.csv`, [
      ['Kreator', 'Platform', 'Link', 'Status', 'Tanggal posting', 'Views', 'Views lolos', 'Biaya (Rp)'],
      ...q.data!.subs.map((k) => [handle(k), platformLabel(k.platform as Platform), k.post_url, CLIP_STATUS[k.status]?.label ?? k.status,
        k.published_at?.slice(0, 10) ?? '', k.raw_views, k.qualified_views, k.spend]),
    ]);
  }

  return (
    <Screen refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={async () => { await q.refresh(); await daily.refresh(); }} tintColor={color.blue} />}>
      <Header title="" />
      <View style={styles.headRow}>
        <Text style={styles.brand}>{c.brand_name}</Text>
        <StatusBadge label={st.label} tone={st.tone} />
      </View>
      <Text style={styles.title} accessibilityRole="header">{c.title}</Text>
      <Text style={styles.meta}>{idr(c.cpm)} / 1K views · {c.platforms.map((p) => platformLabel(p as Platform)).join(', ')}
        {c.submission_deadline ? ` · s/d ${dateLabel(c.submission_deadline)}` : ''}</Text>
      <Freshness metricsAt={c.last_metrics_at} qualifiedAt={c.last_qualified_at} refreshedAt={refreshedAt} />
      {canExport ? (
        <View style={styles.exportRow}>
          <Pressable onPress={exportPdf} style={({ pressed }) => [styles.export, pressed && { opacity: 0.7 }]} accessibilityRole="button">
            <Feather name="file-text" size={14} color={color.text} /><Text style={styles.exportText}>PDF</Text>
          </Pressable>
          <Pressable onPress={exportCsv} style={({ pressed }) => [styles.export, pressed && { opacity: 0.7 }]} accessibilityRole="button">
            <Feather name="download" size={14} color={color.text} /><Text style={styles.exportText}>CSV</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={{ marginTop: space.lg }}><Segmented options={TABS} value={tab} onChange={setTab} /></View>

      {tab === 'detail' ? (
        <>
          <BudgetHero budget={c.budget} spent={c.spent} topUpUrl={waTopUp(c.brand_name, c.title)}
            second={{ label: 'Submission', icon: 'film', onPress: () => setTab('subs') }} />
          <KpiGrid>
            <Kpi icon="eye" label="Views terverifikasi" value={compact(c.qualified_views)} />
            <Kpi icon="trending-down" label="Effective CPM" value={c.effective_cpm == null ? '—' : idr(c.effective_cpm)} tint={color.success}
              note={saving != null && saving > 0 ? `Hemat ${saving}% dari CPM asli` : `CPM asli ${idr(c.cpm)}`} />
            <Kpi icon="film" label="Video masuk" value={num(c.submissions)} note={`${num(c.approved)} disetujui`} tint="#B794F6" />
            <Kpi icon="users" label="Kreator" value={num(c.creators_joined)} tint="#E8B65A" />
          </KpiGrid>
          {tags.length ? <HashtagTile views={tags.at(-1)!.view_count} videos={tags.at(-1)!.video_count} tags={[tags.at(-1)!.hashtag]} /> : null}
          <Section title="Biaya">
            <CostCard spent={c.spent} fee={c.platform_fee} feePct={c.fee_pct} total={c.total_cost} effectiveCpm={c.effective_cpm} cpm={c.cpm} />
          </Section>
        </>
      ) : null}

      {tab === 'subs' ? (
        <Section title={`${num(q.data.subs.length)} video`}>
          <Segmented options={FILTERS} value={filter} onChange={setFilter} />
          {!subs.length ? <Text style={styles.muted}>Belum ada video.</Text> : null}
          <View style={{ gap: space.sm }}>{subs.map((k) => <SubRow key={k.submission_id} k={k} />)}</View>
        </Section>
      ) : null}

      {tab === 'stats' ? (
        <>
          <Section title="Views harian">
            <View style={styles.box}>
              <Segmented options={RANGES} value={range} onChange={setRange} />
              {!daily.data ? <SkeletonBlock width="100%" height={180} /> : gain > 0 ? (
                <>
                  <Text style={styles.big}>+{compact(gain)} <Text style={styles.bigUnit}>views · {idr(daily.data.reduce((a, x) => a + x.spend, 0))}</Text></Text>
                  <BarChart data={daily.data.map((x) => ({ key: x.day, value: x.qualified_gain, label: dayLabel(x.day) }))}
                    format={(v) => `+${compact(v)}`} summary={`${num(gain)} views dalam ${range} hari`} />
                </>
              ) : <Text style={styles.muted}>Belum ada views baru.</Text>}
            </View>
          </Section>
          <Section title="Validasi views">
            <ViewsBreakdown raw={c.raw_views} qualified={c.qualified_views} pending={c.pending_views} excluded={c.excluded_views} />
          </Section>
          <Section title="Funnel">
            <View style={styles.box}>
              {funnel.map((f, i) => (
                <View key={f.l} style={styles.funnelRow}>
                  <Text style={styles.funnelLabel}>{f.l}</Text>
                  <View style={styles.funnelTrack} {...web('track')}><View style={[styles.funnelFill, { width: `${Math.max((f.v / fmax) * 100, 2)}%` }]} {...web('seg-q')} /></View>
                  <Text style={styles.funnelValue}>{num(f.v)}</Text>
                  <Text style={styles.funnelPct}>{i === 2 && funnel[1]!.v ? `${Math.round((f.v / funnel[1]!.v) * 100)}%` : ''}</Text>
                </View>
              ))}
            </View>
          </Section>
          {platforms.length ? (
            <Section title="Per platform">
              <View style={styles.box}>
                {platforms.map((p, i) => (
                  <View key={p.platform} style={[styles.platRow, i === platforms.length - 1 && { borderBottomWidth: 0 }]}>
                    <Text style={styles.platName}>{platformLabel(p.platform as Platform)}</Text>
                    <Text style={styles.platMeta}>{p.approved} video · {compact(p.qualified_views)} views</Text>
                    <Text style={styles.platSpend}>{idr(p.earned)}</Text>
                  </View>
                ))}
              </View>
            </Section>
          ) : null}
          {tags.length ? <Section title="Hashtag"><HashtagReach stats={tags} /></Section> : null}
        </>
      ) : null}

      {tab === 'clips' ? (
        <Section title="Klip terbaik" right={top.length ? (
          <Pressable onPress={() => router.push({ pathname: '/brand-clips/[id]', params: { id } })} hitSlop={8} accessibilityRole="link">
            <Text style={styles.more}>Pakai untuk iklan</Text>
          </Pressable>
        ) : null}>
          {!top.length ? <Text style={styles.muted}>Belum ada klip disetujui.</Text> : null}
          <View style={{ gap: space.sm }}>
            {top.slice(0, 10).map((k, i) => (
              <Pressable key={k.submission_id} onPress={() => Linking.openURL(k.post_url).catch(() => {})} accessibilityRole="link"
                style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}>
                <Text style={[styles.rank, i < 3 && { color: color.link }]}>{i + 1}</Text>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.rowTitle}>{handle(k)}</Text>
                  <Text style={styles.cap}>{platformLabel(k.platform as Platform)} · {compact(k.qualified_views)} views</Text>
                </View>
                <Text style={styles.platSpend}>{idr(k.spend)}</Text>
                <Feather name="arrow-up-right" size={15} color={color.textMuted} />
              </Pressable>
            ))}
          </View>
        </Section>
      ) : null}
    </Screen>
  );
}

function SubRow({ k }: { k: Clip }) {
  const s = CLIP_STATUS[k.status] ?? { label: k.status, tone: 'neutral' as const };
  return (
    <Pressable onPress={() => Linking.openURL(k.post_url).catch(() => {})} accessibilityRole="link" style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}>
      <View style={styles.avatar}><Text style={styles.avatarText}>{(k.creator_username ?? 'k').charAt(0).toUpperCase()}</Text></View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.rowTitle} numberOfLines={1}>{handle(k)}</Text>
        <Text style={styles.cap} numberOfLines={1}>{platformLabel(k.platform as Platform)} · {k.published_at ? dateLabel(k.published_at) : '—'}</Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        <StatusBadge label={s.label} tone={s.tone} />
        <Text style={styles.cap}>{compact(k.raw_views)} views{k.spend ? ` · ${idr(k.spend)}` : ''}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: -space.xl },
  brand: { ...type.label, color: color.textSecondary },
  title: { ...type.title, color: color.text, marginTop: space.xs },
  meta: { ...type.caption, color: color.textMuted, marginTop: space.xs },
  box: { ...card, borderRadius: radius.lg, padding: space.lg, gap: space.md },
  big: { ...type.metric, fontSize: 24, color: color.text },
  bigUnit: { ...type.caption, color: color.textMuted },
  cap: { ...type.caption, color: color.textMuted, fontVariant: ['tabular-nums'] },
  muted: { ...type.body, color: color.textMuted },
  more: { ...type.label, color: color.link, fontSize: 14 },
  exportRow: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  export: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: space.md, paddingVertical: 7, borderRadius: radius.pill,
    borderWidth: 1, borderColor: color.borderStrong },
  exportText: { ...type.label, fontSize: 13, color: color.text },
  funnelRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  funnelLabel: { ...type.caption, color: color.textSecondary, width: 84 },
  funnelTrack: { flex: 1, height: 10, borderRadius: 5, backgroundColor: color.surfaceRaised, overflow: 'hidden' },
  funnelFill: { height: 10, borderRadius: 5, backgroundColor: color.blue },
  funnelValue: { ...type.label, color: color.text, width: 44, textAlign: 'right', fontVariant: ['tabular-nums'] },
  funnelPct: { ...type.caption, color: color.textMuted, width: 38, textAlign: 'right', fontVariant: ['tabular-nums'] },
  platRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingBottom: space.md, borderBottomWidth: 1, borderBottomColor: color.border },
  platName: { ...type.label, color: color.text, width: 84 },
  platMeta: { ...type.caption, color: color.textMuted, flex: 1 },
  platSpend: { ...type.label, color: color.text, fontVariant: ['tabular-nums'] },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.lg, ...card },
  rowTitle: { ...type.label, color: color.text },
  rank: { ...type.heading, color: color.textMuted, width: 22, textAlign: 'center', fontVariant: ['tabular-nums'] },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: color.surfaceRaised },
  avatarText: { ...type.label, color: color.textSecondary },
});
