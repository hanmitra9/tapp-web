import Feather from '@expo/vector-icons/Feather';
import { useEffect, useState } from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/Button';
import { LoadState } from '@/components/LoadState';
import { Screen } from '@/components/Screen';
import { TopBar } from '@/components/TopBar';
import { fetchRecap } from '@/features/creator/recap';
import { compact } from '@/lib/format';
import { renderRecapCard, shareRenderedCard, type RenderedCard } from '@/lib/shareCard';
import { useQuery } from '@/lib/useQuery';
import { useAuth } from '@/providers/AuthProvider';
import { card, color, radius, space, type } from '@/theme/tokens';

const LEVEL: Record<string, string> = { new: 'New', rising: 'Rising', verified: 'Verified', proven: 'Proven', elite: 'Elite' };
const MONTH = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
// First day of the month n months back, as YYYY-MM-01 (local time).
const monthKey = (back: number) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - back); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`; };
const monthName = (key: string) => { const d = new Date(`${key}T00:00:00`); return `${MONTH[d.getMonth()]} ${d.getFullYear()}`; };

// Monthly recap: last month by default, a card to save or share to Story, and the numbers behind it.
export default function RecapScreen() {
  const { account } = useAuth();
  const [back, setBack] = useState(1);
  const key = monthKey(back);
  const q = useQuery(() => fetchRecap(key), [key]);
  const [img, setImg] = useState<RenderedCard | null>(null);
  const r = q.data;

  useEffect(() => {
    if (!r || Platform.OS !== 'web') return;
    let live = true, made: RenderedCard | null = null;
    renderRecapCard({ month: r.month, views: r.views, clips: r.clips, topPct: r.top_pct, tier: LEVEL[r.tier] ?? r.tier,
      name: account?.fullName ?? r.name ?? 'TAPP', avatarUrl: account?.avatarUrl ?? null })
      .then((c) => { made = c; if (live) setImg(c); }).catch(() => {});
    return () => { live = false; if (made) URL.revokeObjectURL(made.url); };
  }, [r, account?.fullName, account?.avatarUrl]);

  return (
    <Screen width="narrow">
      <TopBar title="Rekap bulanan" back />
      <View style={styles.months}>
        <Pressable onPress={() => setBack((b) => Math.min(b + 1, 12))} accessibilityRole="button" accessibilityLabel="Bulan sebelumnya" hitSlop={8} style={styles.arrow}>
          <Feather name="chevron-left" size={20} color={color.text} />
        </Pressable>
        <Text style={styles.month} accessibilityRole="header">{monthName(key)}</Text>
        <Pressable onPress={() => setBack((b) => Math.max(b - 1, 0))} disabled={back === 0} accessibilityRole="button" accessibilityLabel="Bulan berikutnya" hitSlop={8}
          style={[styles.arrow, back === 0 && { opacity: 0.3 }]}>
          <Feather name="chevron-right" size={20} color={color.text} />
        </Pressable>
      </View>
      {!r ? <LoadState error={q.error} onRetry={q.reload} /> : (
        <>
          {img ? <Image source={{ uri: img.url }} style={styles.card} accessibilityLabel={`Kartu rekap ${monthName(key)}: ${compact(r.views)} qualified views`} />
            : <View style={[styles.card, styles.cardSk]} />}
          <View style={styles.grid}>
            <Stat label="Qualified views" value={compact(r.views)} />
            <Stat label="Klip diterima" value={String(r.clips)} />
            <Stat label="Campaign" value={String(r.campaigns)} />
            <Stat label="Klip terbaik" value={r.best_views ? `${compact(r.best_views)} views` : '—'} />
            <Stat label="Posisi" value={r.top_pct ? `Top ${r.top_pct}%` : '—'} />
            <Stat label="Level" value={LEVEL[r.tier] ?? r.tier} />
          </View>
          {r.views === 0 ? <Text style={styles.note}>Belum ada qualified views di bulan ini. Ambil campaign dan posting klip supaya rekap berikutnya terisi.</Text> : null}
          {Platform.OS === 'web' ? (
            <View style={{ marginTop: space.xl }}>
              <Button label="Simpan / bagikan ke Story" onPress={() => { if (img) void shareRenderedCard(img).catch(() => {}); }} disabled={!img} />
            </View>
          ) : null}
        </>
      )}
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  months: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.lg },
  arrow: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', ...card },
  month: { ...type.heading, color: color.text },
  card: { width: '100%', aspectRatio: 960 / 1344, marginTop: space.lg, borderRadius: radius.xl },
  cardSk: { backgroundColor: color.surface },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.lg },
  stat: { flexBasis: '31%', flexGrow: 1, padding: space.md, gap: 4, ...card, borderRadius: radius.lg },
  statLabel: { ...type.caption, fontSize: 12, color: color.textMuted },
  statValue: { ...type.metric, fontSize: 20, lineHeight: 26, color: color.text },
  note: { ...type.caption, color: color.textSecondary, marginTop: space.md },
});
