import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Platform, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/Button';
import { LoadState } from '@/components/LoadState';
import { Screen } from '@/components/Screen';
import { TopBar } from '@/components/TopBar';
import { fetchStreak, fetchStreakWeeks, nextBadge, streakBadge } from '@/features/creator/recap';
import { renderStreakCard, shareRenderedCard, type RenderedCard } from '@/lib/shareCard';
import { useQuery } from '@/lib/useQuery';
import { useAuth } from '@/providers/AuthProvider';
import { color, radius, space, type } from '@/theme/tokens';

// Streak, minimal: one huge number, a thin orange accent, hairlines instead of cards. Weeks in a row with at least one
// accepted clip (counted by the week the clip was sent, Mon–Sun WIB). A badge, never money.
const ACCENT = '#FF7A45';
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const store = () => { try { return Platform.OS === 'web' ? globalThis.localStorage ?? null : null; } catch { return null; } };
const SEEN = 'tapp:streak:seen';

// End of this week (Sunday 23:59:59 WIB) as a timestamp.
function weekEnd(): number {
  const now = Date.now(), wib = new Date(now + 7 * 3600e3);          // WIB wall clock in UTC fields
  const daysToSun = (7 - wib.getUTCDay()) % 7;
  const end = Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), wib.getUTCDate() + daysToSun, 23, 59, 59);
  return end - 7 * 3600e3;
}
function useCountdown(on: boolean) {
  const [left, setLeft] = useState(() => weekEnd() - Date.now());
  useEffect(() => {
    if (!on) return;
    const t = setInterval(() => setLeft(weekEnd() - Date.now()), 1000);
    return () => clearInterval(t);
  }, [on]);
  const s = Math.max(0, Math.floor(left / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}
const pad = (n: number) => String(n).padStart(2, '0');

export default function StreakScreen() {
  const { account } = useAuth();
  const q = useQuery(async () => {
    const [s, weeks] = await Promise.all([fetchStreak(), fetchStreakWeeks(26)]);
    return { s, weeks };
  }, []);
  const [img, setImg] = useState<RenderedCard | null>(null);
  const [levelUp, setLevelUp] = useState(false);
  const d = q.data;
  const cd = useCountdown(!!d && d.s.current > 0 && !d.s.this_week);

  // Streak went up since this device last looked → one short celebration.
  const pop = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!d) return;
    let seen = 0;
    try { seen = Number(store()?.getItem(SEEN) ?? 0); } catch { /* no storage */ }
    try { store()?.setItem(SEEN, String(d.s.current)); } catch { /* no storage */ }
    if (d.s.current > 0 && seen > 0 && d.s.current > seen) {
      setLevelUp(true);
      pop.setValue(0.6); glow.setValue(0);
      Animated.parallel([
        Animated.spring(pop, { toValue: 1, friction: 4, tension: 90, useNativeDriver: Platform.OS !== 'web' }),
        Animated.sequence([
          Animated.timing(glow, { toValue: 1, duration: 450, easing: Easing.out(Easing.quad), useNativeDriver: Platform.OS !== 'web' }),
          Animated.timing(glow, { toValue: 0, duration: 1200, easing: Easing.in(Easing.quad), useNativeDriver: Platform.OS !== 'web' }),
        ]),
      ]).start();
    }
  }, [d, pop, glow]);

  useEffect(() => {
    if (!d || Platform.OS !== 'web' || d.s.current < 1) return;
    let live = true, made: RenderedCard | null = null;
    renderStreakCard({ weeks: d.s.current, best: d.s.best, badge: streakBadge(d.s.current), name: account?.fullName ?? 'TAPP',
      avatarUrl: account?.avatarUrl ?? null, recent: d.weeks.map((w) => w.clips > 0) })
      .then((c) => { made = c; if (live) setImg(c); }).catch(() => {});
    return () => { live = false; if (made) URL.revokeObjectURL(made.url); };
  }, [d, account?.fullName, account?.avatarUrl]);

  if (!d) return <Screen width="narrow"><TopBar title="Streak" back /><LoadState error={q.error} onRetry={q.reload} /></Screen>;
  const { s, weeks } = d;
  const badge = streakBadge(s.current);
  const next = nextBadge(s.current);
  const thisWeek = weeks.at(-1)?.week;
  const active = weeks.filter((w) => w.clips > 0).length;

  return (
    <Screen width="narrow">
      <TopBar title="Streak" back />

      <View style={styles.hero}>
        <Text style={styles.kicker}>STREAK</Text>
        <View style={styles.numRow}>
          <Animated.View pointerEvents="none" style={[styles.glow, { opacity: glow, transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.4] }) }] }]} />
          <Animated.Text style={[styles.big, { transform: [{ scale: pop }] }]} accessibilityRole="header" accessibilityLabel={`${s.current} minggu beruntun`}>{s.current}</Animated.Text>
          <Text style={styles.weeks}>weeks</Text>
        </View>
        {levelUp ? <Text style={styles.up}>+1 minggu. Mantap, lanjutkan.</Text> : null}
        {badge ? <Text style={styles.badge}>{badge.toUpperCase()}</Text> : null}
      </View>

      <View style={styles.rule} />
      {s.current > 0 && !s.this_week ? (
        <View style={styles.count} accessibilityLabel={`Sisa ${cd.d} hari ${cd.h} jam ${cd.m} menit untuk menjaga streak`}>
          <Text style={styles.countLabel}>Sisa waktu minggu ini</Text>
          <View style={styles.countRow}>
            {[[cd.d, 'hari'], [cd.h, 'jam'], [cd.m, 'menit'], [cd.s, 'detik']].map(([v, l]) => (
              <View key={l as string} style={styles.countCell}>
                <Text style={styles.countNum}>{pad(v as number)}</Text>
                <Text style={styles.countUnit}>{l}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.note}>Kirim klip sebelum Minggu 23.59 WIB. Dihitung kalau nanti diterima.</Text>
        </View>
      ) : (
        <Text style={styles.status}>{s.current === 0 ? 'Kirim klip yang diterima minggu ini untuk mulai streak.' : '✓  Minggu ini aman. Sampai minggu depan.'}</Text>
      )}
      <View style={styles.rule} />

      <View style={styles.stats}>
        <Stat label="Terbaik" value={`${s.best}`} unit="weeks" />
        <View style={styles.vrule} />
        <Stat label={next ? next.name : 'Badge'} value={next ? `${next.at - s.current}` : '—'} unit={next ? 'weeks lagi' : 'tertinggi'} />
        <View style={styles.vrule} />
        <Stat label="26 minggu" value={`${active}`} unit="aktif" />
      </View>
      <View style={styles.rule} />

      <Text style={styles.section}>26 MINGGU TERAKHIR</Text>
      <View style={styles.grid} accessibilityLabel={`${active} dari ${weeks.length} minggu ada klip diterima`}>
        {weeks.map((w) => {
          const dt = new Date(`${w.week}T00:00:00`);
          return (
            <View key={w.week} style={styles.slot}>
              <View style={[styles.cell, w.clips > 0 && styles.cellOn, w.week === thisWeek && styles.cellNow]}
                accessibilityLabel={`Minggu ${dt.getDate()} ${MON[dt.getMonth()]}: ${w.clips} klip`} />
            </View>
          );
        })}
      </View>
      <View style={styles.axis}>
        <Text style={styles.axisText}>{weeks[0] ? label(weeks[0].week) : ''}</Text>
        <Text style={styles.axisText}>minggu ini</Text>
      </View>

      {Platform.OS === 'web' && s.current > 0 ? (
        <>
          <Text style={[styles.section, { marginTop: space.xxl }]}>KARTU STORY</Text>
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

function Stat({ label: l, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel} numberOfLines={1}>{l}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statUnit} numberOfLines={1}>{unit}</Text>
    </View>
  );
}

const HAIR = 'rgba(255,255,255,0.10)';
const styles = StyleSheet.create({
  hero: { alignItems: 'center', paddingTop: space.xl, paddingBottom: space.lg },
  kicker: { ...type.caption, fontSize: 12, letterSpacing: 4, color: ACCENT, fontWeight: '600' },
  numRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: space.sm },
  glow: { position: 'absolute', alignSelf: 'center', left: '10%', width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,122,69,0.35)' },
  big: { fontSize: 136, lineHeight: 140, fontWeight: '200', color: '#FFFFFF', letterSpacing: -6, fontVariant: ['tabular-nums'] },
  weeks: { ...type.body, fontSize: 18, color: color.textMuted, marginBottom: 22 },
  up: { ...type.label, color: ACCENT, marginTop: space.xs },
  badge: { ...type.caption, fontSize: 12, letterSpacing: 3, color: color.textSecondary, marginTop: space.sm },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: HAIR },
  vrule: { width: StyleSheet.hairlineWidth, backgroundColor: HAIR, alignSelf: 'stretch' },
  status: { ...type.body, color: color.textSecondary, textAlign: 'center', paddingVertical: space.lg },
  count: { alignItems: 'center', paddingVertical: space.lg, gap: space.sm },
  countLabel: { ...type.caption, fontSize: 12, letterSpacing: 1, color: color.textMuted },
  countRow: { flexDirection: 'row', gap: space.lg },
  countCell: { alignItems: 'center', minWidth: 48 },
  countNum: { fontSize: 30, fontWeight: '300', color: '#FFFFFF', fontVariant: ['tabular-nums'] },
  countUnit: { ...type.caption, fontSize: 11, color: color.textMuted },
  note: { ...type.caption, fontSize: 12, color: color.textMuted, textAlign: 'center' },
  stats: { flexDirection: 'row', paddingVertical: space.lg },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statLabel: { ...type.caption, fontSize: 11, letterSpacing: 1, color: color.textMuted },
  statValue: { fontSize: 28, fontWeight: '300', color: '#FFFFFF', fontVariant: ['tabular-nums'] },
  statUnit: { ...type.caption, fontSize: 11, color: color.textMuted },
  section: { ...type.caption, fontSize: 11, letterSpacing: 3, color: color.textMuted, marginTop: space.xl, marginBottom: space.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -2 },
  slot: { width: `${100 / 13}%`, padding: 2 },
  cell: { width: '100%', aspectRatio: 1, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.06)' },
  cellOn: { backgroundColor: '#FFFFFF' },
  cellNow: { borderWidth: 1.5, borderColor: ACCENT },
  axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space.sm },
  axisText: { ...type.caption, fontSize: 11, color: color.textMuted },
  card: { width: '100%', aspectRatio: 960 / 1344, borderRadius: radius.xl },
});
