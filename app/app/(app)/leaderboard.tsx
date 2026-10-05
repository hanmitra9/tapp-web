import Feather from '@expo/vector-icons/Feather';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Image, RefreshControl, StyleSheet, Text, View } from 'react-native';
import Svg, { Ellipse, G, Path } from 'react-native-svg';
import { Avatar } from '@/components/Avatar';
import { LoadState } from '@/components/LoadState';
import { Screen } from '@/components/Screen';
import { TopBar } from '@/components/TopBar';
import { idr } from '@/lib/format';
import { useQuery } from '@/lib/useQuery';
import { color, radius, space, type } from '@/theme/tokens';
import { fetchAllTimeBoard, type AllTimeRow } from '@/features/campaigns/leaderboard';

const LEVEL: Record<string, string> = { new: 'New', rising: 'Rising', verified: 'Verified', proven: 'Proven', elite: 'Elite' };
const BLUE = '#6E8BFF';
type Place = 1 | 2 | 3;
// Per place: pillar body, glowing edge, glow, laurel/logo metal, height.
const TIER: Record<Place, { body: readonly [string, string, string]; edge: string; glow: string; metal: readonly [string, string, string]; h: number }> = {
  1: { body: ['#16224D', '#0A1233', '#060A1C'], edge: '#5B7CFF', glow: 'rgba(91,124,255,0.65)', metal: ['#8FB8FF', '#3D6BFF', '#2337C9'], h: 236 },
  2: { body: ['#2E3440', '#171B23', '#0C0E13'], edge: '#C3CCDA', glow: 'rgba(195,204,218,0.4)', metal: ['#F2F5FA', '#AEB7C5', '#6E7787'], h: 196 },
  3: { body: ['#3E281F', '#21150F', '#110A07'], edge: '#D99A6C', glow: 'rgba(217,154,108,0.45)', metal: ['#FFD7B5', '#C9855A', '#7E4A2A'], h: 176 },
};

// All-time leaderboard: blue-lit stage with glass podiums (TAPP logo + laurel), your standing, then the ranked table.
export default function LeaderboardScreen() {
  const q = useQuery(() => fetchAllTimeBoard(30), []);
  if (!q.data) return <Screen scroll={false}><TopBar title="" back /><LoadState error={q.error} onRetry={q.reload} /></Screen>;
  const rows = q.data;
  const byRank = (n: number) => rows.find((r) => r.rank === n) ?? null;
  const rest = rows.filter((r) => r.rank > 3);
  const me = rows.find((r) => r.is_me) ?? null;
  const above = me && me.rank > 1 ? byRank(me.rank - 1) : null;

  return (
    <Screen refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={q.refresh} tintColor={BLUE} />}>
      <TopBar title="" back />

      <View style={styles.hero}>
        <View style={[StyleSheet.absoluteFill, css(BACKDROP)]} pointerEvents="none" />
        <View style={[styles.beamL, css(BEAM_L)]} pointerEvents="none" />
        <View style={[styles.beamR, css(BEAM_R)]} pointerEvents="none" />
        <Text style={styles.title} accessibilityRole="header">
          LEADER<Text style={css(BLUE_TEXT)}>BOARD</Text>
        </Text>
        <Text style={styles.sub}>Ranking para clipper terbaik di TAPP</Text>

        {rows.length ? (
          <View style={styles.stageWrap}>
            <View style={[styles.halo, css(HALO)]} pointerEvents="none" />
            <View style={styles.stage}>
              <Podium r={byRank(2)} place={2} delay={150} />
              <Podium r={byRank(1)} place={1} delay={0} />
              <Podium r={byRank(3)} place={3} delay={300} />
            </View>
            <View style={[styles.floorLine, css({ backgroundImage: 'linear-gradient(90deg, transparent, rgba(140,165,255,0.95), transparent)', boxShadow: '0 0 28px 6px rgba(91,124,255,0.5)' })]} />
            <View style={styles.reflect} pointerEvents="none">
              {([2, 1, 3] as const).map((p) => (
                <LinearGradient key={p} colors={[`${TIER[p].edge}40`, `${TIER[p].edge}0D`, 'rgba(0,0,0,0)']} locations={[0, 0.4, 1]} style={styles.reflectCol} />
              ))}
            </View>
          </View>
        ) : null}
      </View>

      {rows.length ? (
        <>
          {me ? (
            <LinearGradient colors={['rgba(91,124,255,0.25)', 'rgba(91,124,255,0.06)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.me}>
              <View style={styles.meRank}><Text style={styles.meRankText}>#{me.rank}</Text></View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.meTitle}>Posisi kamu</Text>
                <Text style={styles.meSub} numberOfLines={2}>
                  {above ? `${idr(Math.max(0, above.payout - me.payout + 1))} lagi untuk naik ke #${above.rank}` : 'Kamu di puncak. Pertahankan!'}
                </Text>
              </View>
              <Text style={styles.mePay}>{idr(me.payout)}</Text>
            </LinearGradient>
          ) : null}

          {rest.length ? (
            <View style={styles.table}>
              <View style={styles.thead}>
                <Text style={[styles.th, { width: 44 }]}>No</Text>
                <Text style={[styles.th, { flex: 1 }]}>Creator</Text>
                <Text style={[styles.th, { width: 100, textAlign: 'right' }]}>Total payout</Text>
                <Text style={[styles.th, { width: 66, textAlign: 'right' }]}>Campaign</Text>
              </View>
              {rest.map((r) => (
                <View key={r.rank} style={[styles.tr, r.is_me && styles.trMe]}>
                  <Text style={styles.no}>#{r.rank}</Text>
                  <View style={styles.who}>
                    <Avatar uri={r.avatar_url} name={r.name} size={36} />
                    <Text style={styles.name} numberOfLines={1}>{r.is_me ? 'Kamu' : r.name}</Text>
                  </View>
                  <Text style={styles.pay} numberOfLines={1}>{idr(r.payout)}</Text>
                  <Text style={styles.camps}>{r.campaigns}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </>
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Panggung masih kosong</Text>
          <Text style={styles.emptyText}>Klip pertama yang diterima langsung di puncak.</Text>
        </View>
      )}
    </Screen>
  );
}

function Podium({ r, place, delay }: { r: AllTimeRow | null; place: Place; delay: number }) {
  const t = TIER[place];
  const first = place === 1;
  const rise = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(rise, { toValue: 1, duration: 750, delay, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [rise, delay]);
  return (
    <View style={[styles.col, first && { zIndex: 2 }]}>
      <Animated.View style={[styles.person, { opacity: rise, transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }]}>
        {first ? <FontAwesome6 name="crown" size={18} color={BLUE} style={css({ filter: 'drop-shadow(0 0 8px rgba(91,124,255,0.9))' })} /> : null}
        <View style={[styles.ring, { borderColor: t.edge }, css({ boxShadow: `0 0 0 3px rgba(5,8,20,0.9), 0 0 22px ${t.glow}` })]}>
          <Avatar uri={r?.avatar_url ?? null} name={r?.name ?? '?'} size={first ? 58 : 50} />
        </View>
        {r ? (
          <>
            <View style={styles.badge}><Feather name="shield" size={11} color="#AFC0FF" /><Text style={styles.badgeText}>{LEVEL[r.tier ?? ''] ?? 'Creator'} Clipper</Text></View>
            <Text style={[styles.podName, first && { fontSize: 17 }]} numberOfLines={1}>{r.is_me ? 'Kamu' : r.name}</Text>
          </>
        ) : <Text style={styles.badgeText}>—</Text>}
      </Animated.View>

      <Animated.View style={{ width: '100%', height: rise.interpolate({ inputRange: [0, 1], outputRange: [40, t.h] }) }}>
        <View style={[styles.pillar, { borderColor: `${t.edge}AA` }, css({ boxShadow: `0 0 26px ${t.glow}, inset 0 0 18px ${t.edge}33` })]}>
          <LinearGradient colors={t.body} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
          <View style={[styles.rail, { left: '14%', backgroundColor: `${t.edge}33` }]} />
          <View style={[styles.rail, { right: '14%', backgroundColor: `${t.edge}33` }]} />
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, css({ backgroundImage: 'linear-gradient(100deg, transparent 40%, rgba(255,255,255,0.18) 50%, transparent 60%)',
            backgroundSize: '300% 100%', animation: `tapp-shine 5.5s ease-in-out ${delay + 900}ms infinite` })]} />
          <View style={styles.face}>
            <Logo place={place} />
            {first ? null : <Laurel place={place} />}
          </View>
        </View>
        <View style={[styles.cap, { borderColor: `${t.edge}CC` }, css({ boxShadow: `0 0 18px ${t.glow}, inset 0 1px 0 rgba(255,255,255,0.15)` })]}>
          <Text style={styles.capLabel}>PAYOUT</Text>
          <Text style={[styles.capValue, { color: first ? '#A9BBFF' : t.metal[0] }]} numberOfLines={1} adjustsFontSizeToFit>{r ? idr(r.payout) : '—'}</Text>
        </View>
      </Animated.View>
    </View>
  );
}

// TAPP logo on the podium face: the real blue logo glowing on #1, metal-cast (silver/bronze) on #2 and #3.
function Logo({ place }: { place: Place }) {
  const t = TIER[place];
  const size = place === 1 ? 74 : 46;
  return (
    <View style={[{ width: size, height: size }, css({ ...maskOf(MARK_URI), backgroundImage: `linear-gradient(160deg, ${t.metal[0]} 0%, ${t.metal[1]} 55%, ${t.metal[2]} 100%)`,
      filter: place === 1 ? 'drop-shadow(0 0 14px rgba(91,124,255,0.95)) drop-shadow(0 0 3px rgba(160,180,255,0.9))' : `drop-shadow(0 0 6px ${t.glow})` })]} />
  );
}

// Laurel wreath around the rank number (two arcs of leaves), in the podium's metal.
function Laurel({ place }: { place: Place }) {
  const t = TIER[place];
  // Leaves climb the left side from the bottom (110°) to the top (235°), screen coords; the right side is mirrored.
  const leaves = Array.from({ length: 7 }, (_, i) => {
    const deg = 110 + i * 20.8;
    const a = deg * (Math.PI / 180);
    return { x: 40 + Math.cos(a) * 27, y: 42 + Math.sin(a) * 27, deg: deg + 90 };
  });
  return (
    <View style={{ width: 80, height: 74, alignItems: 'center', justifyContent: 'center', marginTop: 6 }}>
      <Svg width={80} height={74} viewBox="0 0 80 80" style={StyleSheet.absoluteFill}>
        {[1, -1].map((side) => (
          <G key={side} transform={side === -1 ? 'translate(80,0) scale(-1,1)' : undefined}>
            <Path d="M33 68 Q8 50 22 20" stroke={t.metal[1]} strokeWidth={1.6} fill="none" strokeLinecap="round" />
            {leaves.map((l, i) => (
              <Ellipse key={i} cx={l.x} cy={l.y} rx={6.2} ry={2.6} fill={i % 2 ? t.metal[1] : t.metal[0]} opacity={0.95}
                transform={`rotate(${l.deg} ${l.x} ${l.y})`} />
            ))}
          </G>
        ))}
      </Svg>
      <Text style={[styles.laurelNum, { color: t.metal[0] }, css({ textShadow: `0 0 10px ${t.glow}` })]}>{place}</Text>
    </View>
  );
}

// Keyframes for the light sweep (web).
if (typeof document !== 'undefined' && !document.getElementById('tapp-stage-kf')) {
  const el = document.createElement('style');
  el.id = 'tapp-stage-kf';
  el.textContent = '@keyframes tapp-shine{0%{background-position:150% 0}55%,100%{background-position:-50% 0}}';
  document.head.appendChild(el);
}
const MARK = require('../../assets/tapp-mark-white.png');
const MARK_URI: string = (() => { const m = MARK as unknown; return typeof m === 'string' ? m : (m as { uri?: string })?.uri ?? (m as { default?: string })?.default ?? Image.resolveAssetSource?.(MARK)?.uri ?? ''; })();
const maskOf = (uri: string) => ({ maskImage: `url(${uri})`, WebkitMaskImage: `url(${uri})`, maskSize: 'contain', WebkitMaskSize: 'contain',
  maskRepeat: 'no-repeat', WebkitMaskRepeat: 'no-repeat', maskPosition: 'center', WebkitMaskPosition: 'center' });
// Web-only CSS merged into a style.
const css = (o: object) => o as object;
const BACKDROP = { backgroundImage: 'radial-gradient(ellipse 80% 60% at 50% 62%, rgba(40,70,200,0.35) 0%, rgba(15,25,80,0.25) 45%, transparent 75%)' };
const BEAM_L = { backgroundImage: 'linear-gradient(100deg, transparent 30%, rgba(80,120,255,0.22) 50%, transparent 70%)', filter: 'blur(6px)', transform: 'rotate(-28deg)' };
const BEAM_R = { backgroundImage: 'linear-gradient(80deg, transparent 30%, rgba(80,120,255,0.22) 50%, transparent 70%)', filter: 'blur(6px)', transform: 'rotate(28deg)' };
const HALO = { backgroundImage: 'radial-gradient(circle, rgba(91,124,255,0.45) 0%, rgba(60,90,230,0.15) 35%, transparent 65%)' };
const BLUE_TEXT = { backgroundImage: 'linear-gradient(90deg, #8FB0FF 0%, #5B7CFF 60%, #6E5BFF 100%)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' };

const styles = StyleSheet.create({
  hero: { marginHorizontal: -space.xl, marginTop: space.md, paddingTop: space.xl, overflow: 'hidden', alignItems: 'center' },
  beamL: { position: 'absolute', left: -120, top: 180, width: 360, height: 120 },
  beamR: { position: 'absolute', right: -120, top: 180, width: 360, height: 120 },
  title: { fontFamily: type.display.fontFamily, fontWeight: '700', fontSize: 44, lineHeight: 50, letterSpacing: -1, color: '#F4F6FF', textAlign: 'center' },
  sub: { ...type.body, color: 'rgba(220,226,255,0.7)', marginTop: space.sm, textAlign: 'center' },
  stageWrap: { width: '100%', alignItems: 'center', marginTop: space.xl },
  halo: { position: 'absolute', width: 520, height: 520, top: -120, left: '50%', marginLeft: -260 },
  stage: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 10, width: '100%', maxWidth: 460, paddingHorizontal: space.md },
  floorLine: { width: '94%', height: 2, borderRadius: 2 },
  reflect: { flexDirection: 'row', gap: 10, width: '100%', maxWidth: 460, paddingHorizontal: space.md, height: 70 },
  reflectCol: { flex: 1, borderBottomLeftRadius: 10, borderBottomRightRadius: 10 },

  col: { flex: 1, alignItems: 'center' },
  person: { alignItems: 'center', gap: 4, marginBottom: space.md, width: '100%' },
  ring: { borderWidth: 2, borderRadius: 999, padding: 2, backgroundColor: '#050814' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  badgeText: { ...type.caption, fontSize: 11, color: 'rgba(220,226,255,0.75)' },
  podName: { ...type.label, fontSize: 15, color: '#FFFFFF', maxWidth: '100%' },
  pillar: { flex: 1, marginTop: 26, borderWidth: 1, borderTopWidth: 0, borderBottomLeftRadius: 6, borderBottomRightRadius: 6, overflow: 'hidden', alignItems: 'center' },
  rail: { position: 'absolute', top: 0, bottom: 0, width: 1 },
  face: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, paddingTop: space.lg },
  cap: { position: 'absolute', top: 0, left: -4, right: -4, height: 46, borderRadius: 12, borderWidth: 1, backgroundColor: '#070B1A',
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  capLabel: { ...type.caption, fontSize: 9, lineHeight: 11, letterSpacing: 1.2, color: 'rgba(220,226,255,0.55)' },
  capValue: { ...type.label, fontSize: 14, lineHeight: 18, fontVariant: ['tabular-nums'] },
  laurelNum: { fontFamily: type.display.fontFamily, fontWeight: '700', fontSize: 28, lineHeight: 32 },

  me: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.lg, padding: space.md, borderRadius: radius.lg,
    borderWidth: 1, borderColor: 'rgba(110,139,255,0.4)' },
  meRank: { minWidth: 48, height: 48, paddingHorizontal: 8, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#4C6BFF' },
  meRankText: { ...type.heading, color: '#FFFFFF', fontVariant: ['tabular-nums'] },
  meTitle: { ...type.label, color: color.text },
  meSub: { ...type.caption, color: color.textSecondary },
  mePay: { ...type.label, color: '#A9BBFF', fontVariant: ['tabular-nums'] },

  table: { marginTop: space.lg, borderRadius: radius.lg, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: '#0A0C14', overflow: 'hidden' },
  thead: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.md, paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  th: { ...type.label, fontSize: 12, color: 'rgba(220,226,255,0.75)' },
  tr: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.md, paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  trMe: { backgroundColor: 'rgba(91,124,255,0.12)' },
  no: { width: 44, fontFamily: type.display.fontFamily, fontWeight: '700', fontSize: 20, color: '#FFFFFF', fontVariant: ['tabular-nums'] },
  who: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm },
  name: { ...type.label, fontSize: 13, color: color.text, flexShrink: 1 },
  pay: { width: 100, textAlign: 'right', ...type.label, color: '#A9BBFF', fontVariant: ['tabular-nums'] },
  camps: { width: 66, textAlign: 'right', ...type.label, color: color.text, fontVariant: ['tabular-nums'] },

  empty: { marginTop: space.xl, gap: space.sm, alignItems: 'center' },
  emptyTitle: { ...type.heading, color: color.text },
  emptyText: { ...type.body, color: color.textMuted, textAlign: 'center', maxWidth: 320 },
});
