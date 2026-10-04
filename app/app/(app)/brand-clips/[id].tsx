import Feather from '@expo/vector-icons/Feather';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Linking, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/Button';
import { Chips } from '@/components/Chips';
import { Header } from '@/components/Header';
import { LoadState } from '@/components/LoadState';
import { Screen } from '@/components/Screen';
import { compact, dateLabel, idr } from '@/lib/format';
import { useQuery } from '@/lib/useQuery';
import { color, radius, space, type, card } from '@/theme/tokens';
import { fetchBrandCampaigns, fetchTopClips, type Clip } from '@/features/brand/api';
import { platformLabel, type Platform } from '@/features/creator/options';

const SUPPORT = 'tappcreators@gmail.com';

// Best clips of a campaign, ready to reuse as ads: ranked by qualified views, with cost per 1.000 views,
// quick copy/open, and a request to TAPP for the creator's ad permission (Spark Ads / Partnership Ads).
export default function BrandClips() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useQuery(async () => {
    const [all, clips] = await Promise.all([fetchBrandCampaigns(), fetchTopClips(id)]);
    return { c: all.find((x) => x.id === id) ?? null, clips };
  }, [id]);
  const [platform, setPlatform] = useState('all');
  const [picked, setPicked] = useState<string[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const list = useMemo(() => (q.data?.clips ?? []).filter((k) => platform === 'all' || k.platform === platform), [q.data, platform]);

  if (!q.data) return <Screen scroll={false}><Header title="Klip terbaik" /><LoadState error={q.error} onRetry={q.reload} /></Screen>;
  const { c, clips } = q.data;
  const platforms = [...new Set(clips.map((k) => k.platform))];
  const chosen = clips.filter((k) => picked.includes(k.submission_id));

  async function copy(text: string, key: string) {
    await Clipboard.setStringAsync(text);
    setCopied(key); setTimeout(() => setCopied(null), 1800);
  }
  function requestAds() {
    const rows = chosen.map((k, i) => `${i + 1}. @${k.creator_username ?? 'kreator'} · ${k.post_url}`).join('\n');
    const subject = `Izin iklan klip · ${c?.title ?? 'campaign'}`;
    const body = `Halo tim TAPP,\n\nKami ingin memakai klip berikut sebagai iklan (Spark Ads / Partnership Ads):\n${rows}\n\nBrand: ${c?.brand_name ?? ''}\nCampaign: ${c?.title ?? ''}\n\nTerima kasih.`;
    Linking.openURL(`mailto:${SUPPORT}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`).catch(() => {});
  }

  return (
    <Screen refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={q.refresh} tintColor={color.blue} />}
      footer={chosen.length ? <Button label={`Minta izin iklan (${chosen.length} klip)`} onPress={requestAds} /> : undefined}>
      <Header title="Klip terbaik" subtitle={`${c?.title ?? ''} · urut dari qualified views terbanyak. Pilih klip yang mau dipakai ulang sebagai iklan.`} />

      {platforms.length > 1 ? (
        <View style={{ marginBottom: space.lg }}>
          <Chips options={[{ value: 'all', label: 'Semua' }, ...platforms.map((p) => ({ value: p, label: platformLabel(p as Platform) }))]}
            value={[platform]} onChange={(v) => setPlatform(v[0] ?? 'all')} />
        </View>
      ) : null}

      {!list.length ? <Text style={styles.muted}>Belum ada klip yang disetujui.</Text> : null}
      {list.map((k, i) => <ClipCard key={k.submission_id} k={k} rank={i + 1} picked={picked.includes(k.submission_id)}
        copied={copied === k.submission_id}
        onPick={() => setPicked((p) => (p.includes(k.submission_id) ? p.filter((x) => x !== k.submission_id) : [...p, k.submission_id]))}
        onCopy={() => copy(k.post_url, k.submission_id)} />)}

      {list.length ? (
        <View style={styles.info}>
          <Text style={styles.infoTitle}>Pakai klip sebagai iklan</Text>
          <Text style={styles.infoText}>Untuk Spark Ads (TikTok) atau Partnership Ads (Instagram), creator perlu memberi kode atau izin. Pilih klipnya, lalu tekan Minta izin iklan — tim TAPP yang menghubungi creator.</Text>
          <Pressable onPress={() => copy(list.map((k) => k.post_url).join('\n'), 'all')} hitSlop={8} accessibilityRole="button">
            <Text style={styles.link}>{copied === 'all' ? 'Tersalin' : `Salin semua link (${list.length})`}</Text>
          </Pressable>
        </View>
      ) : null}
    </Screen>
  );
}

function ClipCard({ k, rank, picked, copied, onPick, onCopy }: { k: Clip; rank: number; picked: boolean; copied: boolean; onPick: () => void; onCopy: () => void }) {
  const cpm = k.qualified_views ? Math.round((k.spend / k.qualified_views) * 1000) : null;
  return (
    <Pressable onPress={onPick} style={[styles.card, picked && styles.cardOn]} accessibilityRole="checkbox" accessibilityState={{ checked: picked }}>
      <View style={styles.top}>
        <Text style={[styles.rank, rank <= 3 && { color: color.link }]}>#{rank}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.creator}>@{k.creator_username ?? 'kreator'}</Text>
          <Text style={styles.meta}>{platformLabel(k.platform as Platform)} · {dateLabel(k.published_at)}</Text>
        </View>
        <View style={[styles.check, picked && styles.checkOn]}>{picked ? <Feather name="check" size={14} color="#fff" /> : null}</View>
      </View>
      <View style={styles.nums}>
        <Num label="Qualified views" value={compact(k.qualified_views)} />
        <Num label="Total views" value={compact(k.raw_views)} />
        <Num label="Biaya / 1.000" value={cpm != null ? idr(cpm) : '—'} />
      </View>
      <View style={styles.actions}>
        <Pressable onPress={() => Linking.openURL(k.post_url).catch(() => {})} hitSlop={6} style={styles.action} accessibilityRole="link">
          <Feather name="external-link" size={14} color={color.link} /><Text style={styles.link}>Buka klip</Text>
        </Pressable>
        <Pressable onPress={onCopy} hitSlop={6} style={styles.action} accessibilityRole="button">
          <Feather name={copied ? 'check' : 'copy'} size={14} color={copied ? color.success : color.link} /><Text style={styles.link}>{copied ? 'Tersalin' : 'Salin link'}</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}
function Num({ label, value }: { label: string; value: string }) {
  return <View style={{ flex: 1, gap: 2 }}><Text style={styles.numValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text><Text style={styles.meta}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  muted: { ...type.body, color: color.textMuted },
  card: { padding: space.lg, gap: space.md, borderRadius: radius.lg, marginBottom: space.md, ...card, borderWidth: 1, borderColor: color.border },
  cardOn: { borderColor: color.blue, backgroundColor: 'rgba(12,101,196,0.10)' },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  rank: { ...type.heading, color: color.textMuted, width: 36, fontVariant: ['tabular-nums'] },
  creator: { ...type.label, color: color.text },
  meta: { ...type.caption, color: color.textMuted },
  check: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: color.borderStrong, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: color.blue, borderColor: color.blue },
  nums: { flexDirection: 'row', gap: space.md },
  numValue: { ...type.heading, color: color.text, fontVariant: ['tabular-nums'] },
  actions: { flexDirection: 'row', gap: space.xl },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  link: { ...type.label, color: color.link, fontSize: 14 },
  info: { marginTop: space.lg, padding: space.lg, gap: space.sm, borderRadius: radius.md, ...card },
  infoTitle: { ...type.label, color: color.text },
  infoText: { ...type.caption, color: color.textSecondary, lineHeight: 19 },
});
