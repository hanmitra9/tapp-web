import { useEffect, useState } from 'react';
import { Image, Platform, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/Button';
import { LoadState } from '@/components/LoadState';
import { Screen } from '@/components/Screen';
import { TopBar } from '@/components/TopBar';
import { fetchStreak, fetchStreakWeeks, nextBadge, streakBadge } from '@/features/creator/recap';
import { renderStreakCard, shareRenderedCard, type RenderedCard } from '@/lib/shareCard';
import { useQuery } from '@/lib/useQuery';
import { useAuth } from '@/providers/AuthProvider';
import { card, color, radius, space, type } from '@/theme/tokens';

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const FIRE = '#FF7A45';

// Streak: weeks in a row with at least one accepted clip (counted by the week the clip was sent). A badge, no money.
// Big number, a 26-week calendar, the next badge, and a card to share to Story.
export default function StreakScreen() {
  const { account } = useAuth();
  const q = useQuery(async () => {
    const [s, weeks] = await Promise.all([fetchStreak(), fetchStreakWeeks(26)]);
    return { s, weeks };
  }, []);
  const [img, setImg] = useState<RenderedCard | null>(null);
  const d = q.data;

  useEffect(() => {
    if (!d || Platform.OS !== 'web' || d.s.current < 1) return;
    let live = true, made: RenderedCard | null = null;
    renderStreakCard({ weeks: d.s.current, best: d.s.best, badge: streakBadge(d.s.current), name: account?.fullName ?? 'TAPP', avatarUrl: account?.avatarUrl ?? null })
      .then((c) => { made = c; if (live) setImg(c); }).catch(() => {});
    return () => { live = false; if (made) URL.revokeObjectURL(made.url); };
  }, [d, account?.fullName, account?.avatarUrl]);

  if (!d) return <Screen width="narrow"><TopBar title="Streak" back /><LoadState error={q.error} onRetry={q.reload} /></Screen>;
  const { s, weeks } = d;
  const badge = streakBadge(s.current);
  const next = nextBadge(s.current);
  const thisWeek = weeks.at(-1)?.week;

  return (
    <Screen width="narrow">
      <TopBar title="Streak" back />
      <View style={styles.hero}>
        <Text style={styles.fire}>🔥</Text>
        <Text style={styles.big} accessibilityRole="header">{s.current}</Text>
        <Text style={styles.unit}>WEEKS STREAK</Text>
        {badge ? <View style={styles.badge}><Text style={styles.badgeText}>{badge}</Text></View> : null}
        <Text style={styles.sub}>
          {s.current === 0 ? 'Kirim klip yang diterima minggu ini untuk mulai streak.'
            : s.this_week ? 'Minggu ini aman. Kirim klip lagi minggu depan supaya lanjut.'
            : 'Minggu ini belum ada klip. Kirim sebelum Minggu 23.59 WIB biar nggak putus.'}
        </Text>
      </View>

      <View style={styles.row}>
        <Stat label="Terbaik" value={`${s.best} weeks`} />
        <Stat label={next ? `Ke ${next.name}` : 'Badge'} value={next ? `${next.at - s.current} weeks lagi` : 'Tertinggi'} />
      </View>

      <View style={styles.box}>
        <Text style={styles.boxTitle}>26 minggu terakhir</Text>
        <View style={styles.grid} accessibilityLabel={`${weeks.filter((w) => w.clips > 0).length} dari ${weeks.length} minggu ada klip diterima`}>
          {weeks.map((w) => {
            const dt = new Date(`${w.week}T00:00:00`);
            const on = w.clips > 0, now = w.week === thisWeek;
            return (
              <View key={w.week} style={styles.slot}>
                <View style={[styles.cell, on && styles.cellOn, now && styles.cellNow]} accessibilityLabel={`Minggu ${dt.getDate()} ${MON[dt.getMonth()]}: ${w.clips} klip`}>
                  {on ? <Text style={styles.cellText}>{w.clips > 9 ? '9+' : w.clips}</Text> : null}
                </View>
              </View>
            );
          })}
        </View>
        <View style={styles.axis}>
          <Text style={styles.axisText}>{weeks[0] ? label(weeks[0].week) : ''}</Text>
          <Text style={styles.axisText}>Minggu ini</Text>
        </View>
        <Text style={styles.note}>Angka = jumlah klip diterima minggu itu. Dihitung dari minggu klip dikirim (Senin–Minggu, WIB).</Text>
      </View>

      {Platform.OS === 'web' && s.current > 0 ? (
        <>
          {img ? <Image source={{ uri: img.url }} style={styles.card} accessibilityLabel={`Kartu streak ${s.current} weeks`} />
            : <View style={[styles.card, { backgroundColor: color.surface }]} />}
          <View style={{ marginTop: space.lg }}>
            <Button label="Simpan / bagikan ke Story" onPress={() => { if (img) void shareRenderedCard(img).catch(() => {}); }} disabled={!img} />
          </View>
        </>
      ) : null}
    </Screen>
  );
}
const label = (iso: string) => { const d = new Date(`${iso}T00:00:00`); return `${d.getDate()} ${MON[d.getMonth()]}`; };

function Stat({ label: l, value }: { label: string; value: string }) {
  return <View style={styles.stat}><Text style={styles.statLabel}>{l}</Text><Text style={styles.statValue} numberOfLines={1}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', marginTop: space.xl, gap: 2 },
  fire: { fontSize: 40 },
  big: { ...type.metric, fontSize: 88, lineHeight: 96, color: color.text, fontVariant: ['tabular-nums'] },
  unit: { ...type.label, letterSpacing: 2, color: FIRE },
  badge: { marginTop: space.sm, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,122,69,0.45)',
    backgroundColor: 'rgba(255,122,69,0.10)' },
  badgeText: { ...type.caption, color: '#FFB08A', fontWeight: '600' },
  sub: { ...type.body, color: color.textSecondary, textAlign: 'center', marginTop: space.md, maxWidth: 320 },
  row: { flexDirection: 'row', gap: space.sm, marginTop: space.xl },
  stat: { flex: 1, padding: space.md, gap: 4, ...card, borderRadius: radius.lg },
  statLabel: { ...type.caption, fontSize: 12, color: color.textMuted },
  statValue: { ...type.label, fontSize: 16, color: color.text },
  box: { ...card, borderRadius: radius.lg, padding: space.lg, gap: space.md, marginTop: space.lg },
  boxTitle: { ...type.label, color: color.text },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -3 },
  slot: { width: `${100 / 7}%`, padding: 3 },
  cell: { width: '100%', aspectRatio: 1, borderRadius: 8, backgroundColor: color.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  cellOn: { backgroundColor: FIRE },
  cellNow: { borderWidth: 2, borderColor: color.link },
  cellText: { ...type.caption, fontSize: 12, color: '#1A0A02', fontWeight: '700' },
  axis: { flexDirection: 'row', justifyContent: 'space-between' },
  axisText: { ...type.caption, fontSize: 12, color: color.textMuted },
  note: { ...type.caption, fontSize: 12, color: color.textMuted },
  card: { width: '100%', aspectRatio: 960 / 1344, marginTop: space.xl, borderRadius: radius.xl },
});
