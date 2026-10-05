import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, RefreshControl, StyleSheet, Text, View } from 'react-native';
import Svg, { Ellipse, G, Path } from 'react-native-svg';
import { Avatar } from '@/components/Avatar';
import { LoadState } from '@/components/LoadState';
import { Screen } from '@/components/Screen';
import { TopBar } from '@/components/TopBar';
import { idr } from '@/lib/format';
import { useQuery } from '@/lib/useQuery';
import { color, radius, space, type } from '@/theme/tokens';
import { fetchMonthlyBoard, type MonthlyRow } from '@/features/campaigns/leaderboard';

const LEVEL: Record<string, string> = { new: 'New', rising: 'Rising', verified: 'Verified', proven: 'Proven', elite: 'Elite' };
const BLUE = '#6E8BFF';
const VALUE = '#8EA6FF';
type Place = 1 | 2 | 3;
// Per place: pillar body, glowing edge, glow, logo/laurel metal, pillar height.
const TIER: Record<Place, { body: readonly [string, string, string]; edge: string; glow: string; metal: readonly [string, string, string]; h: number }> = {
  1: { body: ['#16224D', '#0A1233', '#060A1C'], edge: '#5B7CFF', glow: 'rgba(91,124,255,0.7)', metal: ['#8FB8FF', '#3D6BFF', '#2337C9'], h: 250 },
  2: { body: ['#2B313D', '#161A22', '#0B0D12'], edge: '#C3CCDA', glow: 'rgba(195,204,218,0.45)', metal: ['#F2F5FA', '#AEB7C5', '#6E7787'], h: 196 },
  3: { body: ['#3E281F', '#21150F', '#110A07'], edge: '#D99A6C', glow: 'rgba(217,154,108,0.5)', metal: ['#FFD7B5', '#C9855A', '#7E4A2A'], h: 176 },
};

// Monthly leaderboard (konten-style): countdown to the reset, blue-lit podiums with prizes, then the ranked table.
export default function LeaderboardScreen() {
  const q = useQuery(() => fetchMonthlyBoard(30), []);
  if (!q.data) return <Screen scroll={false}><TopBar title="" back /><LoadState error={q.error} onRetry={q.reload} /></Screen>;
  const { rows, prizes, resetsAt } = q.data;
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
        <Text style={styles.title} accessibilityRole="header">LEADER<Text style={css(BLUE_TEXT)}>BOARD</Text></Text>
        <Text style={styles.sub}>Ranking para clipper terbaik di TAPP</Text>

        <Countdown to={resetsAt} />

        <View style={styles.stageWrap}>
          <View style={[styles.halo, css(HALO)]} pointerEvents="none" />
          <View style={styles.stage}>
            <Podium r={byRank(2)} prize={prizes[1] ?? 0} place={2} delay={150} />
            <Podium r={byRank(1)} prize={prizes[0] ?? 0} place={1} delay={0} />
            <Podium r={byRank(3)} prize={prizes[2] ?? 0} place={3} delay={300} />
          </View>
          <View style={[styles.floorLine, css({ backgroundImage: 'linear-gradient(90deg, transparent, rgba(140,165,255,0.95), transparent)', boxShadow: '0 0 28px 6px rgba(91,124,255,0.5)' })]} />
          <View style={styles.reflect} pointerEvents="none">
            {([2, 1, 3] as const).map((p) => (
              <LinearGradient key={p} colors={[`${TIER[p].edge}40`, `${TIER[p].edge}0D`, 'rgba(0,0,0,0)']} locations={[0, 0.4, 1]} style={styles.reflectCol} />
            ))}
          </View>
        </View>
      </View>

      {me && me.rank > 3 ? (
        <LinearGradient colors={['rgba(91,124,255,0.25)', 'rgba(91,124,255,0.06)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.me}>
          <View style={styles.meRank}><Text style={styles.meRankText}>#{me.rank}</Text></View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.meTitle}>Posisi kamu bulan ini</Text>
            {above ? <Text style={styles.meSub} numberOfLines={2}>{idr(Math.max(0, above.payout - me.payout + 1))} lagi untuk naik ke #{above.rank}</Text> : null}
          </View>
          <Text style={styles.mePay}>{idr(me.payout)}</Text>
        </LinearGradient>
      ) : null}

      <View style={styles.table}>
        <View style={styles.thead}>
          <Text style={[styles.th, { width: 52 }]}>No</Text>
          <Text style={[styles.th, { flex: 1 }]}>Username</Text>
          <Text style={[styles.th, { width: 110, textAlign: 'center' }]}>Total Payout</Text>
          <Text style={[styles.th, { width: 78, textAlign: 'right' }]}>Campaigns</Text>
        </View>
        {rest.length ? rest.map((r) => (
          <View key={r.rank} style={[styles.tr, r.is_me && styles.trMe]}>
            <Text style={styles.no}>#{r.rank}</Text>
            <View style={styles.who}>
              <View style={[styles.rowRing, r.is_me && { borderColor: BLUE }]}><Avatar uri={r.avatar_url} name={r.name} size={40} /></View>
              {r.is_me ? <Text style={styles.youTag}>Kamu</Text> : null}
            </View>
            <Text style={styles.pay} numberOfLines={1}>{idr(r.payout)}</Text>
            <Text style={styles.camps}>{r.campaigns}</Text>
          </View>
        )) : (
          <Text style={styles.emptyRow}>{rows.length ? 'Peringkat #4 dan seterusnya muncul di sini.' : 'Belum ada payout bulan ini. Jadi yang pertama!'}</Text>
        )}
      </View>
    </Screen>
  );
}

// "Ranking reset dalam" DD : HH : MM : SS, ticking every second.
function Countdown({ to }: { to: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const left = Math.max(0, new Date(to).getTime() - now);
  const parts = [[Math.floor(left / 86400e3), 'Hari'], [Math.floor(left / 3600e3) % 24, 'Jam'], [Math.floor(left / 60e3) % 60, 'Menit'], [Math.floor(left / 1e3) % 60, 'Detik']] as const;
  return (
    <View style={styles.cd} accessibilityLabel={`Ranking reset dalam ${parts.map(([v, l]) => `${v} ${l}`).join(' ')}`}>
      <Text style={styles.cdTitle}>Ranking reset dalam</Text>
      <View style={styles.cdRow}>
        {parts.map(([v, l], i) => (
          <View key={l} style={styles.cdRow}>
            {i ? <Text style={styles.cdColon}>:</Text> : null}
            <View style={styles.cdCell}>
              <Text style={styles.cdNum}>{String(v).padStart(2, '0')}</Text>
              <Text style={styles.cdLabel}>{l}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function Podium({ r, prize, place, delay }: { r: MonthlyRow | null; prize: number; place: Place; delay: number }) {
  const t = TIER[place];
  const first = place === 1;
  const rise = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(rise, { toValue: 1, duration: 750, delay, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [rise, delay]);
  return (
    <View style={[styles.col, first && { zIndex: 2 }]}>
      <Animated.View style={[styles.person, { opacity: rise, transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }]}>
        {first ? <FontAwesome6 name="crown" size={20} color={BLUE} style={css({ filter: 'drop-shadow(0 0 8px rgba(91,124,255,0.95))' })} /> : null}
        <View style={[styles.ring, { borderColor: first ? BLUE : t.edge }, css({ boxShadow: `0 0 0 3px rgba(5,8,20,0.9), 0 0 22px ${t.glow}` })]}>
          <Avatar uri={r?.avatar_url ?? null} name={r?.name ?? '?'} size={first ? 60 : 54} />
        </View>
        {r ? (
          <>
            <View style={styles.badge}>
              <FontAwesome6 name="shield-halved" size={11} color="#9FB2FF" />
              <Text style={styles.badgeText} numberOfLines={1}>{LEVEL[r.tier ?? ''] ?? 'Creator'} Clipper</Text>
            </View>
            <Text style={[styles.podName, first && { fontSize: 18 }]} numberOfLines={1}>{r.is_me ? 'Kamu' : r.name}</Text>
            <Text style={styles.podPay} numberOfLines={1}><Text style={styles.podPayLabel}>Payout </Text>{idr(r.payout)}</Text>
          </>
        ) : (
          <>
            <Text style={styles.badgeText}>Kursi kosong</Text>
            <Text style={styles.podName}>—</Text>
          </>
        )}
      </Animated.View>

      <Animated.View style={{ width: '100%', height: rise.interpolate({ inputRange: [0, 1], outputRange: [50, t.h] }) }}>
        <View style={[styles.pillar, { borderColor: `${t.edge}AA` }, css({ boxShadow: `0 0 26px ${t.glow}, inset 0 0 18px ${t.edge}33` })]}>
          <LinearGradient colors={t.body} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
          <LinearGradient colors={['rgba(255,255,255,0.10)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.sideL} />
          <View style={[styles.rail, { left: '15%', backgroundColor: `${t.edge}40` }]} />
          <View style={[styles.rail, { right: '15%', backgroundColor: `${t.edge}40` }]} />
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, css({ backgroundImage: 'linear-gradient(100deg, transparent 40%, rgba(255,255,255,0.16) 50%, transparent 60%)',
            backgroundSize: '300% 100%', animation: `tapp-shine 5.5s ease-in-out ${delay + 900}ms infinite` })]} />
          <View style={styles.face}>
            <Logo place={place} />
            {first ? null : <Laurel place={place} />}
          </View>
        </View>
        <View style={[styles.cap, { borderColor: `${t.edge}CC` }, css({ boxShadow: `0 0 18px ${t.glow}, inset 0 1px 0 rgba(255,255,255,0.18)` })]}>
          <Text style={styles.capText} numberOfLines={1}>
            <Text style={styles.capLabel}>Prize  </Text><Text style={styles.capValue}>{idr(prize)}</Text>
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}

// TAPP logo on the podium face in the podium's metal (glowing blue on #1).
function Logo({ place }: { place: Place }) {
  const t = TIER[place];
  const size = place === 1 ? 78 : 50;
  return (
    <View style={[{ width: size, height: size }, css({ ...maskOf(MARK_URI), backgroundImage: `linear-gradient(160deg, ${t.metal[0]} 0%, ${t.metal[1]} 55%, ${t.metal[2]} 100%)`,
      filter: place === 1 ? 'drop-shadow(0 0 14px rgba(91,124,255,0.95)) drop-shadow(0 0 3px rgba(160,180,255,0.9))' : `drop-shadow(0 0 6px ${t.glow})` })]} />
  );
}

// Laurel wreath: two branches curving up from the bottom, leaves alternating inside/outside the stem, rank in the middle.
const P0 = { x: 37, y: 72 }, P1 = { x: 6, y: 62 }, P2 = { x: 14, y: 20 };
const LEAVES = Array.from({ length: 8 }, (_, i) => {
  const t = 0.1 + i * 0.115;
  const x = (1 - t) ** 2 * P0.x + 2 * (1 - t) * t * P1.x + t * t * P2.x;
  const y = (1 - t) ** 2 * P0.y + 2 * (1 - t) * t * P1.y + t * t * P2.y;
  const dx = 2 * (1 - t) * (P1.x - P0.x) + 2 * t * (P2.x - P1.x), dy = 2 * (1 - t) * (P1.y - P0.y) + 2 * t * (P2.y - P1.y);
  const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
  const out = i % 2 === 0;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (dy / len) * (out ? 3.2 : -3.2), ny = (-dx / len) * (out ? 3.2 : -3.2);
  return { x: x + nx, y: y + ny, rot: ang + (out ? -38 : 38), s: 1 - i * 0.04 };
});
function Laurel({ place }: { place: Place }) {
  const t = TIER[place];
  return (
    <View style={{ width: 84, height: 76, alignItems: 'center', justifyContent: 'center', marginTop: 4 }}>
      <Svg width={84} height={76} viewBox="0 0 80 80" style={StyleSheet.absoluteFill}>
        {[1, -1].map((side) => (
          <G key={side} transform={side === -1 ? 'translate(80,0) scale(-1,1)' : undefined}>
            <Path d={`M${P0.x} ${P0.y} Q${P1.x} ${P1.y} ${P2.x} ${P2.y}`} stroke={t.metal[1]} strokeWidth={1.4} fill="none" strokeLinecap="round" />
            {LEAVES.map((l, i) => (
              <Ellipse key={i} cx={l.x} cy={l.y} rx={6.4 * l.s} ry={2.5 * l.s} fill={i % 2 ? t.metal[1] : t.metal[0]}
                transform={`rotate(${l.rot} ${l.x} ${l.y})`} />
            ))}
          </G>
        ))}
        <Path d="M30 74 L50 66 M50 74 L30 66" stroke={t.metal[1]} strokeWidth={1.4} strokeLinecap="round" />
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
const BACKDROP = { backgroundImage: 'radial-gradient(ellipse 80% 55% at 50% 66%, rgba(40,70,200,0.35) 0%, rgba(15,25,80,0.25) 45%, transparent 75%)' };
const BEAM_L = { backgroundImage: 'linear-gradient(100deg, transparent 30%, rgba(80,120,255,0.25) 50%, transparent 70%)', filter: 'blur(6px)', transform: 'rotate(-26deg)' };
const BEAM_R = { backgroundImage: 'linear-gradient(80deg, transparent 30%, rgba(80,120,255,0.25) 50%, transparent 70%)', filter: 'blur(6px)', transform: 'rotate(26deg)' };
const HALO = { backgroundImage: 'radial-gradient(circle, rgba(91,124,255,0.45) 0%, rgba(60,90,230,0.15) 35%, transparent 65%)' };
const BLUE_TEXT = { backgroundImage: 'linear-gradient(90deg, #8FB0FF 0%, #5B7CFF 60%, #6E5BFF 100%)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' };

const styles = StyleSheet.create({
  hero: { marginHorizontal: -space.xl, marginTop: space.md, paddingTop: space.xl, overflow: 'hidden', alignItems: 'center' },
  beamL: { position: 'absolute', left: -120, top: 330, width: 360, height: 120 },
  beamR: { position: 'absolute', right: -120, top: 330, width: 360, height: 120 },
  title: { fontFamily: type.display.fontFamily, fontWeight: '700', fontSize: 46, lineHeight: 52, letterSpacing: -1, color: '#F4F6FF', textAlign: 'center' },
  sub: { ...type.body, color: 'rgba(220,226,255,0.75)', marginTop: space.sm, textAlign: 'center' },

  cd: { alignItems: 'center', marginTop: space.xl, gap: space.sm },
  cdTitle: { ...type.body, color: '#FFFFFF' },
  cdRow: { flexDirection: 'row', alignItems: 'flex-start' },
  cdCell: { alignItems: 'center', minWidth: 64 },
  cdNum: { fontFamily: type.display.fontFamily, fontWeight: '400', fontSize: 40, lineHeight: 46, color: '#FFFFFF', fontVariant: ['tabular-nums'] },
  cdLabel: { ...type.caption, color: 'rgba(220,226,255,0.6)' },
  cdColon: { fontFamily: type.display.fontFamily, fontSize: 32, lineHeight: 44, color: 'rgba(220,226,255,0.7)', marginHorizontal: 2 },

  stageWrap: { width: '100%', alignItems: 'center', marginTop: space.xl },
  halo: { position: 'absolute', width: 520, height: 520, top: -110, left: '50%', marginLeft: -260 },
  stage: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 10, width: '100%', maxWidth: 460, paddingHorizontal: space.md },
  floorLine: { width: '94%', height: 2, borderRadius: 2 },
  reflect: { flexDirection: 'row', gap: 10, width: '100%', maxWidth: 460, paddingHorizontal: space.md, height: 70 },
  reflectCol: { flex: 1, borderBottomLeftRadius: 10, borderBottomRightRadius: 10 },

  col: { flex: 1, alignItems: 'center' },
  person: { alignItems: 'center', gap: 3, marginBottom: space.md, width: '124%' },
  ring: { borderWidth: 2, borderRadius: 999, padding: 2, backgroundColor: '#050814', marginBottom: 4 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4, maxWidth: '100%' },
  badgeText: { ...type.caption, fontSize: 12, color: 'rgba(220,226,255,0.8)' },
  podName: { fontFamily: type.label.fontFamily, fontSize: 16, color: '#FFFFFF', maxWidth: '100%' },
  podPay: { ...type.label, fontSize: 12, letterSpacing: -0.2, color: VALUE, fontVariant: ['tabular-nums'], maxWidth: '100%' },
  podPayLabel: { ...type.caption, fontSize: 11, color: 'rgba(220,226,255,0.55)' },

  pillar: { flex: 1, marginTop: 26, borderWidth: 1, borderTopWidth: 0, borderBottomLeftRadius: 6, borderBottomRightRadius: 6, overflow: 'hidden', alignItems: 'center' },
  sideL: { position: 'absolute', left: 0, top: 0, bottom: 0, width: '15%' },
  rail: { position: 'absolute', top: 0, bottom: 0, width: 1 },
  face: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, paddingTop: space.xl },
  cap: { position: 'absolute', top: 0, left: -4, right: -4, height: 46, borderRadius: 14, borderWidth: 1, backgroundColor: '#070B1A',
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  capText: { maxWidth: '100%' },
  capLabel: { ...type.caption, fontSize: 12, color: 'rgba(220,226,255,0.65)' },
  capValue: { ...type.label, fontSize: 14, color: VALUE, fontVariant: ['tabular-nums'] },
  laurelNum: { fontFamily: type.display.fontFamily, fontWeight: '700', fontSize: 30, lineHeight: 34 },

  me: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.lg, padding: space.md, borderRadius: radius.lg,
    borderWidth: 1, borderColor: 'rgba(110,139,255,0.4)' },
  meRank: { minWidth: 48, height: 48, paddingHorizontal: 8, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#4C6BFF' },
  meRankText: { ...type.heading, color: '#FFFFFF', fontVariant: ['tabular-nums'] },
  meTitle: { ...type.label, color: color.text },
  meSub: { ...type.caption, color: color.textSecondary },
  mePay: { ...type.label, color: VALUE, fontVariant: ['tabular-nums'] },

  table: { marginTop: space.lg, borderRadius: radius.xl, borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)', backgroundColor: '#090B12', overflow: 'hidden' },
  thead: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, paddingVertical: space.lg, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)', backgroundColor: '#0D1018' },
  th: { ...type.label, fontSize: 13, color: 'rgba(230,234,255,0.85)' },
  tr: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, paddingVertical: space.lg, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  trMe: { backgroundColor: 'rgba(91,124,255,0.12)' },
  no: { width: 52, fontFamily: type.display.fontFamily, fontWeight: '700', fontSize: 24, color: '#FFFFFF', fontVariant: ['tabular-nums'] },
  who: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm },
  rowRing: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', borderRadius: 999, padding: 1 },
  youTag: { ...type.caption, fontSize: 11, color: VALUE },
  pay: { width: 110, textAlign: 'center', ...type.label, fontSize: 15, color: VALUE, fontVariant: ['tabular-nums'] },
  camps: { width: 78, textAlign: 'right', ...type.label, color: color.text, fontVariant: ['tabular-nums'] },
  emptyRow: { ...type.caption, color: color.textMuted, textAlign: 'center', padding: space.xl },
});
