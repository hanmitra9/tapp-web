import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { BarChart } from '@/components/BarChart';
import { EmptyState } from '@/components/EmptyState';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { Segmented } from '@/components/Segmented';
import { SkeletonBlock } from '@/components/Skeleton';
import { compact, greeting, idr, num } from '@/lib/format';
import { useAutoRefresh } from '@/lib/useAutoRefresh';
import { useQuery } from '@/lib/useQuery';
import { Freshness } from '@/features/brand/ReportParts';
import { BudgetHero, HashtagTile, Kpi, KpiGrid, Section, SubscriptionTile } from '@/features/brand/ui';
import { color, space, type, card, radius } from '@/theme/tokens';
import { fetchBrandCampaigns, fetchBrandDaily, fetchHashtagTotals, fetchMyBrands, fetchSubscriptions, totals, BRAND_WA } from '@/features/brand/api';
import { BrandCampaignRow } from '@/features/brand/BrandCampaignRow';

const RANGES = [{ value: '7', label: '7 hari' }, { value: '30', label: '30 hari' }, { value: '90', label: '90 hari' }];
const dayLabel = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });

// Brand home: budget left, the four numbers that matter, the daily trend, then campaigns.
export default function BrandHome() {
  const [range, setRange] = useState('30');
  const q = useQuery(async () => {
    const [brands, campaigns, tags, subs] = await Promise.all([fetchMyBrands(), fetchBrandCampaigns(), fetchHashtagTotals().catch(() => null), fetchSubscriptions().catch(() => [])]);
    return { brands, campaigns, tags, subs, t: totals(campaigns), videos: campaigns.reduce((a, c) => a + c.submissions, 0),
      cpm: campaigns.length ? Math.round(campaigns.reduce((a, c) => a + c.cpm, 0) / campaigns.length) : null };
  }, []);
  const daily = useQuery(() => fetchBrandDaily(null, Number(range)), [range]);
  const reloadAll = useCallback(async () => { await Promise.all([q.reload(), daily.reload()]); }, [q.reload, daily.reload]);
  const refreshedAt = useAutoRefresh(reloadAll);
  const d = q.data;
  const gain = daily.data?.reduce((a, x) => a + x.qualified_gain, 0) ?? 0;
  const name = d?.brands.map((b) => b.name).join(', ');
  const saving = d?.cpm && d.t.effectiveCpm != null ? Math.round((1 - d.t.effectiveCpm / d.cpm) * 100) : null;

  return (
    <Screen inTabs refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={async () => { await q.refresh(); await daily.refresh(); }} tintColor={color.blue} />}>
      <Text style={styles.hello}>{greeting()}</Text>
      <Text style={styles.title} accessibilityRole="header" numberOfLines={1}>{name ?? ' '}</Text>
      {d ? <Freshness metricsAt={d.t.lastMetricsAt} qualifiedAt={d.t.lastQualifiedAt} refreshedAt={refreshedAt} /> : null}
      {q.error && !d ? <Notice tone="error" message={q.error} /> : null}

      <BudgetHero budget={d ? d.t.budget : null} spent={d?.t.spent ?? 0}
        primary={{ label: 'Campaign', icon: 'layers', onPress: () => router.navigate('/brand/campaigns') }}
        second={{ label: 'Chat AM', icon: 'message-circle', onPress: () => void Linking.openURL(BRAND_WA).catch(() => {}) }} />
      {d?.subs.map((s) => <SubscriptionTile key={s.id} s={s} onPress={() => router.push({ pathname: '/brand-campaign/[id]', params: { id: s.campaign_id } })} />)}

      <KpiGrid>
        <Kpi icon="eye" label="Views terverifikasi" value={d ? compact(d.t.qualified) : null} />
        <Kpi icon="trending-down" label="Effective CPM" value={d ? (d.t.effectiveCpm == null ? '—' : idr(d.t.effectiveCpm)) : null}
          note={saving != null && saving > 0 ? `${saving}% di bawah CPM` : undefined} tint={color.success} />
        <Kpi icon="film" label="Video masuk" value={d ? num(d.videos) : null} tint="#B794F6" />
        <Kpi icon="users" label="Kreator" value={d ? num(d.t.creators) : null} tint="#E8B65A" />
      </KpiGrid>
      {d?.tags ? <HashtagTile {...d.tags} /> : null}

      <Section title="Views harian">
        <View style={styles.chartCard}>
          <Segmented options={RANGES} value={range} onChange={setRange} />
          {!daily.data ? <SkeletonBlock width="100%" height={180} /> : gain > 0 ? (
            <>
              <Text style={styles.big}>+{compact(gain)} <Text style={styles.bigUnit}>views · {idr(daily.data.reduce((a, x) => a + x.spend, 0))}</Text></Text>
              <BarChart data={daily.data.map((x) => ({ key: x.day, value: x.qualified_gain, label: dayLabel(x.day) }))}
                format={(v) => `+${compact(v)}`} summary={`${num(gain)} views dalam ${range} hari terakhir`} />
            </>
          ) : <Text style={styles.muted}>Belum ada views baru.</Text>}
        </View>
      </Section>

      <Section title="Campaign" right={d && d.campaigns.length > 3 ? <Text style={styles.link} onPress={() => router.navigate('/brand/campaigns')}>Semua</Text> : null}>
        {d && !d.campaigns.length ? <EmptyState title="Belum ada campaign" body="Hubungi account manager untuk mulai." /> : null}
        {d?.campaigns.slice(0, 3).map((c) => <BrandCampaignRow key={c.id} c={c} />)}
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hello: { ...type.caption, color: color.textMuted },
  title: { ...type.title, color: color.text, marginTop: 2 },
  chartCard: { ...card, borderRadius: radius.lg, padding: space.lg, gap: space.md },
  big: { ...type.metric, fontSize: 24, color: color.text },
  bigUnit: { ...type.caption, color: color.textMuted },
  muted: { ...type.body, color: color.textMuted },
  link: { ...type.label, color: color.link, fontSize: 14 },
});
