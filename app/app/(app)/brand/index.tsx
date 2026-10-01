import { router } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { BalanceCard, cardFootText } from '@/components/BalanceCard';
import { BarChart } from '@/components/BarChart';
import { EmptyState } from '@/components/EmptyState';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { Segmented } from '@/components/Segmented';
import { SkeletonBlock } from '@/components/Skeleton';
import { compact, greeting, idr, num } from '@/lib/format';
import { useQuery } from '@/lib/useQuery';
import { color, radius, space, type } from '@/theme/tokens';
import { cpvLabel, fetchBrandCampaigns, fetchBrandDaily, fetchMyBrands, totals } from '@/features/brand/api';
import { BrandCampaignRow } from '@/features/brand/BrandCampaignRow';

const RANGES = [{ value: '7', label: '7 hari' }, { value: '30', label: '30 hari' }, { value: '90', label: '90 hari' }];
const dayLabel = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });

// Brand "Ringkasan": what did my budget buy, and how is it trending.
export default function BrandHome() {
  const [range, setRange] = useState('30');
  const q = useQuery(async () => {
    const [brands, campaigns] = await Promise.all([fetchMyBrands(), fetchBrandCampaigns()]);
    return { brands, campaigns, t: totals(campaigns) };
  }, []);
  const daily = useQuery(() => fetchBrandDaily(null, Number(range)), [range]);
  const d = q.data;
  const gain = daily.data?.reduce((a, x) => a + x.qualified_gain, 0) ?? 0;
  const name = d?.brands.map((b) => b.name).join(', ');

  return (
    <Screen inTabs refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={async () => { await q.refresh(); await daily.refresh(); }} tintColor={color.blue} />}>
      <Text style={styles.hello}>{greeting()}{name ? `, ${name}` : ''}</Text>
      <Text style={styles.title} accessibilityRole="header">Ringkasan campaign</Text>
      {q.error && !d ? <Notice tone="error" message={q.error} /> : null}

      <View style={styles.cardWrap}>
        <BalanceCard label="Total qualified views" amount={d ? `${num(d.t.qualified)} views` : null}
          footLeft={<Text style={cardFootText}>{d ? `Biaya ${idr(d.t.spent)}` : ' '}</Text>}
          footRight={<Text style={cardFootText}>{d ? `CPV ${cpvLabel(d.t.cpv)}` : ' '}</Text>} />
      </View>

      <View style={styles.grid}>
        <Stat label="Campaign aktif" value={d ? String(d.t.active) : null} />
        <Stat label="Kreator bergabung" value={d ? num(d.t.creators) : null} />
        <Stat label="Klip disetujui" value={d ? num(d.t.approved) : null} />
        <Stat label="Sisa budget" value={d ? idr(d.t.remaining) : null} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Qualified views per hari</Text>
        <Segmented options={RANGES} value={range} onChange={setRange} />
        {!daily.data ? <SkeletonBlock width="100%" height={180} /> : gain > 0 ? (
          <>
            <Text style={styles.big}>+{num(gain)} <Text style={styles.bigUnit}>dalam {range} hari · {idr(daily.data.reduce((a, x) => a + x.spend, 0))}</Text></Text>
            <BarChart data={daily.data.map((x) => ({ key: x.day, value: x.qualified_gain, label: dayLabel(x.day) }))}
              format={(v) => `+${compact(v)}`} summary={`${num(gain)} qualified views dalam ${range} hari terakhir`} />
          </>
        ) : <Text style={styles.muted}>Belum ada qualified views baru dalam {range} hari terakhir.</Text>}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Campaign</Text>
          {d && d.campaigns.length > 3 ? <Text style={styles.link} onPress={() => router.navigate('/brand/campaigns')}>Lihat semua</Text> : null}
        </View>
        {d && !d.campaigns.length ? (
          <EmptyState title="Belum ada campaign" body="Campaign yang disiapkan tim TAPP untuk brand-mu akan muncul di sini." />
        ) : null}
        {d?.campaigns.slice(0, 3).map((c) => <BrandCampaignRow key={c.id} c={c} />)}
      </View>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string | null }) {
  return (
    <View style={styles.stat}>
      {value == null ? <SkeletonBlock width="60%" height={22} /> : <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>}
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hello: { ...type.caption, color: color.textMuted, marginTop: space.md },
  title: { ...type.title, color: color.text, marginTop: 4 },
  cardWrap: { marginTop: space.xl },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.lg },
  stat: { flexGrow: 1, flexBasis: '45%', padding: space.lg, gap: 4, backgroundColor: color.surface, borderRadius: radius.lg },
  statValue: { ...type.metric, fontSize: 22, lineHeight: 26, color: color.text },
  statLabel: { ...type.caption, color: color.textMuted },
  section: { marginTop: space.xxl, gap: space.md },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  sectionTitle: { ...type.heading, color: color.text },
  link: { ...type.label, color: color.link },
  big: { ...type.title, color: color.text, fontVariant: ['tabular-nums'] },
  bigUnit: { ...type.caption, color: color.textMuted },
  muted: { ...type.body, color: color.textMuted },
});
