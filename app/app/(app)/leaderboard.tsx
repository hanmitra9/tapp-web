import Feather from '@expo/vector-icons/Feather';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Image, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '@/components/Avatar';
import { LoadState } from '@/components/LoadState';
import { Screen } from '@/components/Screen';
import { TopBar } from '@/components/TopBar';
import { idr } from '@/lib/format';
import { useQuery } from '@/lib/useQuery';
import { color, radius, space, type } from '@/theme/tokens';
import { fetchAllTimeBoard, type AllTimeRow } from '@/features/campaigns/leaderboard';

const LEVEL: Record<string, string> = { new: 'New', rising: 'Rising', verified: 'Verified', proven: 'Proven', elite: 'Elite' };
const GOLD = '#F5C451';
type Place = 1 | 2 | 3;
// Metal per place: body gradient, top face, engraved number, ring glow.
const METAL: Record<Place, { body: readonly [string, string, ...string[]]; face: readonly [string, string]; pit: readonly [string, string, string]; ink: string; ring: string; glow: string; h: number }> = {
  1: { body: ['#F9E7A8', '#E0B54A', '#A9801F', '#5A400C'], face: ['#FFF6D6', '#E9C766'], pit: ['#6E4F10', '#A07A26', '#CDA544'], ink: 'rgba(90,62,8,0.85)', ring: GOLD, glow: 'rgba(245,196,81,0.55)', h: 226 },
  2: { body: ['#F1F4F9', '#BCC4D0', '#848D9C', '#454B57'], face: ['#FFFFFF', '#CDD4DF'], pit: ['#565D69', '#838C9A', '#AAB3C0'], ink: 'rgba(60,66,78,0.85)', ring: '#D5DCE7', glow: 'rgba(213,220,231,0.35)', h: 178 },
  3: { body: ['#FBD3AE', '#CF8D57', '#8F5328', '#4E2A13'], face: ['#FFE3C9', '#DDA16F'], pit: ['#5E3214', '#8E552A', '#B57A48'], ink: 'rgba(84,44,16,0.85)', ring: '#E0A06A', glow: 'rgba(224,160,106,0.35)', h: 148 },
};

// All-time leaderboard: a lit gold stage with metal podiums for the top three, your standing, then the ranked list.
export default function LeaderboardScreen() {
  const q = useQuery(() => fetchAllTimeBoard(30), []);
  if (!q.data) return <Screen scroll={false}><TopBar title="" back /><LoadState error={q.error} onRetry={q.reload} /></Screen>;
  const rows = q.data;
  const byRank = (n: number) => rows.find((r) => r.rank === n) ?? null;
  const rest = rows.filter((r) => r.rank > 3);
  const me = rows.find((r) => r.is_me) ?? null;
  const above = me && me.rank > 1 ? byRank(me.rank - 1) : null;
  const max = rows[0]?.payout || 1;

  return (
    <Screen refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={q.refresh} tintColor={GOLD} />}>
      <TopBar title="" back />

      <View style={styles.hero}>
        <View style={[styles.beam, webStyle({ background: 'conic-gradient(from 180deg at 50% 0%, transparent 160deg, rgba(245,196,81,0.16) 174deg, rgba(255,236,180,0.3) 180deg, rgba(245,196,81,0.16) 186deg, transparent 200deg)' })]} />
        <Text style={[styles.title, webStyle(goldText)]} accessibilityRole="header">Leaderboard</Text>
        <Text style={styles.sub}>Creator dengan payout terbesar di TAPP</Text>

        {rows.length ? (
          <View style={styles.stageWrap}>
          <View style={[styles.rays, webStyle(RAYS)]} pointerEvents="none" />
          <View style={[styles.halo, webStyle(HALO)]} pointerEvents="none" />
          {SPARKS.map(([x, y, sz, d], i) => (
            <View key={i} pointerEvents="none" style={[styles.spark, { left: `${x}%`, top: y, width: sz, height: sz, borderRadius: sz },
              webStyle({ animation: `tapp-twinkle ${2.4 + (i % 4) * 0.7}s ease-in-out ${d}s infinite` })]} />
          ))}
          <View style={styles.stage}>
            <Podium r={byRank(2)} place={2} delay={150} />
            <Podium r={byRank(1)} place={1} delay={0} />
            <Podium r={byRank(3)} place={3} delay={300} />
          </View>
          <View style={styles.reflect} pointerEvents="none">
            {([2, 1, 3] as const).map((p) => (
              <LinearGradient key={p} colors={[`${METAL[p].body[1]}55`, `${METAL[p].body[2]}14`, 'rgba(0,0,0,0)']} locations={[0, 0.45, 1]} style={styles.reflectCol} />
            ))}
          </View>
          <View style={[styles.floorLine, webStyle({ backgroundImage: 'linear-gradient(90deg, transparent, rgba(255,226,150,0.9), transparent)', boxShadow: '0 0 24px 4px rgba(245,196,81,0.45)' })]} />
          <View style={[styles.floorGlow, webStyle({ backgroundImage: 'radial-gradient(ellipse at 50% 0%, rgba(245,196,81,0.28), transparent 70%)' })]} pointerEvents="none" />
          </View>
        ) : null}
      </View>

      {rows.length ? (
        <>
          {me ? (
            <LinearGradient colors={['rgba(12,101,196,0.28)', 'rgba(12,101,196,0.08)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.me}>
              <View style={styles.meRank}><Text style={styles.meRankText}>#{me.rank}</Text></View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.meTitle}>Posisi kamu</Text>
                <Text style={styles.meSub} numberOfLines={2}>
                  {above ? `${idr(Math.max(0, above.payout - me.payout + 1))} lagi untuk naik ke #${above.rank}` : 'Kamu di puncak. Pertahankan!'}
                </Text>
              </View>
              <Text style={styles.mePay}>{idr(me.payout)}</Text>
            </LinearGradient>
          ) : (
            <View style={[styles.me, styles.meEmpty]}>
              <Feather name="trending-up" size={18} color={color.link} />
              <Text style={[styles.meSub, { flex: 1 }]}>Klip pertamamu yang diterima langsung masuk papan.</Text>
            </View>
          )}

          {rest.length ? (
            <View style={styles.list}>
              {rest.map((r) => <Row key={r.rank} r={r} max={max} />)}
            </View>
          ) : null}
        </>
      ) : (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}><FontAwesome6 name="crown" size={22} color={GOLD} /></View>
          <Text style={styles.emptyTitle}>Panggung masih kosong</Text>
          <Text style={styles.emptyText}>Klip pertama yang diterima langsung di puncak.</Text>
        </View>
      )}
    </Screen>
  );
}

function Podium({ r, place, delay }: { r: AllTimeRow | null; place: Place; delay: number }) {
  const m = METAL[place];
  const rise = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(rise, { toValue: 1, duration: 700, delay, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [rise, delay]);
  const first = place === 1;
  return (
    <View style={[styles.col, first && { zIndex: 2 }]}>
      <Animated.View style={[styles.who, { opacity: rise, transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }]}>
        {first ? <FontAwesome6 name="crown" size={20} color={GOLD} style={styles.crown} /> : null}
        <View style={[styles.ring, { borderColor: m.ring }, webStyle({ boxShadow: `0 0 0 4px rgba(0,0,0,0.6), 0 0 28px ${m.glow}` })]}>
          {r ? <Avatar uri={r.avatar_url} name={r.name} size={first ? 64 : 52} /> : <View style={{ width: first ? 64 : 52, height: first ? 64 : 52 }} />}
        </View>
        {r ? (
          <>
            <Text style={[styles.podName, first && { fontSize: 15 }]} numberOfLines={1}>{r.is_me ? 'Kamu' : r.name}</Text>
            {r.tier ? <Text style={styles.podLevel}>{LEVEL[r.tier] ?? r.tier}</Text> : null}
            <View style={[styles.payChip, first && styles.payChipGold]}>
              <Text style={[styles.payChipText, first && { color: '#2A1C00' }]} numberOfLines={1}>{idr(r.payout)}</Text>
            </View>
          </>
        ) : <Text style={styles.podLevel}>—</Text>}
      </Animated.View>
      <Animated.View style={{ width: '100%', height: rise.interpolate({ inputRange: [0, 1], outputRange: [12, m.h] }) }}>
        <LinearGradient colors={m.face} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.face} />
        <LinearGradient colors={m.body} locations={[0, 0.28, 0.7, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.body}>
          <View style={[StyleSheet.absoluteFill, webStyle(BRUSHED)]} pointerEvents="none" />
          <View style={[StyleSheet.absoluteFill, webStyle(NOISE)]} pointerEvents="none" />
          <LinearGradient colors={['rgba(255,255,255,0.35)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.sheen} />
          <View style={styles.edgeL} /><View style={styles.edgeR} />
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, webStyle({ backgroundImage: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.6) 50%, transparent 60%)',
            backgroundSize: '300% 100%', animation: `tapp-shine 5s ease-in-out ${delay + 900}ms infinite`, mixBlendMode: 'overlay' })]} />
          {/* Engraved TAPP mark: light copy 1px below, dark copy on top = carved into the metal. */}
          <Engraved pit={m.pit} top={place === 1 ? 4 : 0} />
          <View style={[styles.medal, { borderColor: m.ink }]}>
            <Text style={[styles.num, { color: m.ink }, webStyle({ textShadow: '0 1px 0 rgba(255,255,255,0.65)' })]}>{place}</Text>
          </View>
        </LinearGradient>
      </Animated.View>
    </View>
  );
}

// The TAPP mark carved into the metal: a light rim where the cut catches light (bottom), a dark lip where it falls
// into shadow (top), and a darker brushed fill shaded from deep at the top edge to lighter at the floor of the cut.
function Engraved({ pit, top }: { pit: readonly [string, string, string]; top: number }) {
  return (
    <View style={{ width: T, height: T, marginTop: top }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Image source={MARK} style={[styles.mark, { tintColor: 'rgba(255,255,255,0.7)', top: 1.4, left: 0.6 }]} />
      <Image source={MARK} style={[styles.mark, { tintColor: 'rgba(0,0,0,0.6)', top: -1.2, left: -0.4 }]} />
      <View style={[styles.mark, webStyle({
        ...maskOf(MARK_URI),
        backgroundImage: `repeating-linear-gradient(90deg, rgba(255,255,255,0.08) 0px, rgba(255,255,255,0.08) 1px, transparent 1px, transparent 3px), linear-gradient(180deg, ${pit[0]} 0%, ${pit[1]} 55%, ${pit[2]} 100%)`,
      })]} />
    </View>
  );
}

function Row({ r, max }: { r: AllTimeRow; max: number }) {
  return (
    <View style={[styles.row, r.is_me && styles.rowMe]}>
      <Text style={styles.rank}>{r.rank}</Text>
      <Avatar uri={r.avatar_url} name={r.name} size={40} />
      <View style={{ flex: 1, gap: 6 }}>
        <View style={styles.rowTop}>
          <Text style={styles.name} numberOfLines={1}>{r.is_me ? 'Kamu' : r.name}</Text>
          {r.tier ? <Text style={styles.level} numberOfLines={1}>{LEVEL[r.tier] ?? r.tier}</Text> : null}
        </View>
        <View style={styles.track}><View style={[styles.fill, { width: `${Math.max(4, (r.payout / max) * 100)}%` }]} /></View>
      </View>
      <Text style={styles.pay}>{idr(r.payout)}</Text>
    </View>
  );
}

// Web-only CSS (gradients on text, conic light, glows) merged into a style.
const webStyle = (css: object) => css as object;
const MARK = require('../../assets/tapp-mark-white.png');
const T = 48;
const MARK_URI: string = (() => { const m = MARK as unknown; return typeof m === 'string' ? m : (m as { uri?: string; default?: string })?.uri ?? (m as { default?: string })?.default ?? Image.resolveAssetSource?.(MARK)?.uri ?? ''; })();
const maskOf = (uri: string) => ({ maskImage: `url(${uri})`, WebkitMaskImage: `url(${uri})`, maskSize: 'contain', WebkitMaskSize: 'contain',
  maskRepeat: 'no-repeat', WebkitMaskRepeat: 'no-repeat', maskPosition: 'center', WebkitMaskPosition: 'center' });
// Brushed-metal streaks, film grain, and a faint stage grid that fades out from the centre.
const BRUSHED = { backgroundImage: 'repeating-linear-gradient(90deg, rgba(255,255,255,0.07) 0px, rgba(255,255,255,0.07) 1px, transparent 1px, transparent 3px, rgba(0,0,0,0.05) 3px, rgba(0,0,0,0.05) 4px)', mixBlendMode: 'overlay' };
const NOISE = { backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/></filter><rect width='100%25' height='100%25' filter='url(%23n)' opacity='0.55'/></svg>\")", mixBlendMode: 'overlay', opacity: 0.6 };
const GRID = { backgroundImage: 'linear-gradient(rgba(245,196,81,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(245,196,81,0.07) 1px, transparent 1px)',
  backgroundSize: '28px 28px', maskImage: 'radial-gradient(ellipse at 50% 60%, black 0%, transparent 70%)', WebkitMaskImage: 'radial-gradient(ellipse at 50% 60%, black 0%, transparent 70%)' };
// Keyframes for the stage (web): slow ray spin, twinkling sparks, light sweeping across the metal.
if (typeof document !== 'undefined' && !document.getElementById('tapp-stage-kf')) {
  const el = document.createElement('style');
  el.id = 'tapp-stage-kf';
  el.textContent = '@keyframes tapp-spin{to{transform:rotate(360deg)}}'
    + '@keyframes tapp-twinkle{0%,100%{opacity:.15;transform:scale(.6)}50%{opacity:1;transform:scale(1)}}'
    + '@keyframes tapp-shine{0%{background-position:150% 0}55%,100%{background-position:-50% 0}}';
  document.head.appendChild(el);
}
const RAYS = { backgroundImage: 'repeating-conic-gradient(from 0deg, rgba(255,214,120,0.16) 0deg 3deg, transparent 3deg 12deg)',
  maskImage: 'radial-gradient(circle, black 0%, rgba(0,0,0,0.6) 25%, transparent 62%)', WebkitMaskImage: 'radial-gradient(circle, black 0%, rgba(0,0,0,0.6) 25%, transparent 62%)',
  animation: 'tapp-spin 90s linear infinite' };
const HALO = { backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(255,222,140,0.55) 0%, rgba(245,166,35,0.22) 28%, rgba(245,166,35,0.06) 50%, transparent 68%)' };
// [left %, top px, size px, delay s]
const SPARKS: [number, number, number, number][] = [[12, 60, 3, 0], [22, 140, 2, 1.1], [30, 30, 2, 0.5], [41, 95, 3, 1.8], [58, 20, 2, 0.9], [66, 120, 3, 0.2],
  [74, 55, 2, 1.4], [84, 150, 3, 0.7], [90, 80, 2, 2.1], [8, 190, 2, 1.6], [50, 170, 2, 2.4], [36, 210, 3, 0.4], [70, 220, 2, 1.2]];
const goldText = { filter: 'drop-shadow(0 0 22px rgba(245,196,81,0.45))', backgroundImage: 'linear-gradient(180deg, #FFF4CF 0%, #F5C451 55%, #B8862A 100%)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' };

const styles = StyleSheet.create({
  hero: { marginHorizontal: -space.xl, marginTop: space.md, paddingTop: space.xl, overflow: 'hidden', alignItems: 'center' },
  beam: { position: 'absolute', top: -40, left: 0, right: 0, height: 520 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  eyebrowLine: { width: 28, height: 1, backgroundColor: 'rgba(245,196,81,0.5)' },
  eyebrow: { ...type.caption, fontSize: 11, letterSpacing: 2.4, color: GOLD, fontFamily: type.label.fontFamily },
  title: { fontFamily: type.display.fontFamily, fontWeight: '600', fontSize: 44, lineHeight: 52, letterSpacing: -1.6, color: GOLD, marginTop: space.sm },
  sub: { ...type.caption, color: 'rgba(255,236,190,0.6)', marginTop: 2 },
  stageWrap: { width: '100%', alignItems: 'center', marginTop: space.lg, paddingBottom: space.sm },
  rays: { position: 'absolute', width: 820, height: 820, top: -300, left: '50%', marginLeft: -410 },
  halo: { position: 'absolute', width: 520, height: 520, top: -150, left: '50%', marginLeft: -260 },
  spark: { position: 'absolute', backgroundColor: '#FFE7A3', boxShadow: '0 0 8px 2px rgba(255,214,120,0.8)' } as object,
  floorLine: { position: 'absolute', bottom: 92, width: '92%', height: 2, borderRadius: 2 },
  reflect: { flexDirection: 'row', gap: 10, width: '100%', maxWidth: 440, paddingHorizontal: space.lg, height: 90 },
  reflectCol: { flex: 1, borderBottomLeftRadius: 8, borderBottomRightRadius: 8 },
  floorGlow: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 80 },
  stage: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 10, width: '100%', maxWidth: 440,
    paddingHorizontal: space.lg, marginTop: space.md },
  spot: { position: 'absolute', bottom: 40, alignSelf: 'center', left: '25%', right: '25%', height: 220, borderRadius: 220,
    backgroundColor: 'rgba(245,196,81,0.22)', filter: 'blur(48px)' } as object,
  floor: { width: '100%', height: 36 },
  col: { flex: 1, alignItems: 'center' },
  who: { alignItems: 'center', gap: 4, marginBottom: space.md, width: '100%' },
  crown: { marginBottom: -2 },
  ring: { borderWidth: 2, borderRadius: 999, padding: 3, backgroundColor: '#07070A' },
  podName: { ...type.label, fontSize: 13, color: '#FFFFFF', marginTop: 4, maxWidth: '100%' },
  podLevel: { ...type.caption, fontSize: 10, letterSpacing: 0.6, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase' },
  payChip: { marginTop: 4, paddingHorizontal: 10, height: 26, justifyContent: 'center', borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', maxWidth: '100%' },
  payChipGold: { backgroundColor: GOLD, borderColor: '#FFE7A3' },
  payChipText: { ...type.label, fontSize: 12, color: '#FFFFFF', fontVariant: ['tabular-nums'] },
  face: { height: 12, borderTopLeftRadius: 10, borderTopRightRadius: 10, marginHorizontal: 4 },
  body: { flex: 1, alignItems: 'center', paddingTop: space.md, overflow: 'hidden', borderBottomLeftRadius: 2, borderBottomRightRadius: 2 },
  sheen: { position: 'absolute', left: 0, top: 0, bottom: 0, width: '38%' },
  num: { fontFamily: type.display.fontFamily, fontWeight: '700', fontSize: 20, lineHeight: 24 },
  medal: { width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginTop: space.sm, backgroundColor: 'rgba(255,255,255,0.12)' },
  mark: { position: 'absolute', left: 0, top: 0, width: T, height: T, resizeMode: 'contain' },
  edgeL: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 2, backgroundColor: 'rgba(255,255,255,0.35)' },
  edgeR: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 3, backgroundColor: 'rgba(0,0,0,0.28)' },
  plinthWrap: { width: '100%', maxWidth: 440, paddingHorizontal: space.sm },
  plinth: { height: 22, borderRadius: 6, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(245,196,81,0.18)' },
  trim: { position: 'absolute', top: 0, left: 0, right: 0, height: 1 },

  me: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.lg, padding: space.md, borderRadius: radius.lg,
    borderWidth: 1, borderColor: 'rgba(117,178,244,0.35)' },
  meEmpty: { backgroundColor: color.accentSoft },
  meRank: { minWidth: 48, height: 48, paddingHorizontal: 8, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: color.blue },
  meRankText: { ...type.heading, color: '#FFFFFF', fontVariant: ['tabular-nums'] },
  meTitle: { ...type.label, color: color.text },
  meSub: { ...type.caption, color: color.textSecondary },
  mePay: { ...type.label, color: color.success, fontVariant: ['tabular-nums'] },

  list: { marginTop: space.lg, gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.md, paddingVertical: space.md, borderRadius: radius.lg,
    backgroundColor: '#0D0D12', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  rowMe: { borderColor: 'rgba(117,178,244,0.45)', backgroundColor: 'rgba(12,101,196,0.12)' },
  rank: { width: 28, ...type.heading, fontSize: 17, color: 'rgba(255,255,255,0.55)', textAlign: 'center', fontVariant: ['tabular-nums'] },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { ...type.label, color: color.text, flexShrink: 1 },
  level: { fontSize: 10, letterSpacing: 0.4, fontFamily: type.label.fontFamily, color: 'rgba(245,196,81,0.85)', flexShrink: 0, paddingHorizontal: 6, paddingVertical: 1,
    borderRadius: radius.pill, backgroundColor: 'rgba(245,196,81,0.1)', overflow: 'hidden' },
  track: { height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' },
  fill: { height: 3, borderRadius: 2, backgroundColor: 'rgba(245,196,81,0.75)' },
  pay: { ...type.label, color: color.success, fontVariant: ['tabular-nums'] },

  empty: { marginTop: space.xl, gap: space.sm, alignItems: 'center' },
  emptyIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(245,196,81,0.12)' },
  emptyTitle: { ...type.heading, color: color.text },
  emptyText: { ...type.body, color: color.textMuted, textAlign: 'center', maxWidth: 320 },
});
