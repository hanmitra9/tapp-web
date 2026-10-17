import { Image, StyleSheet, View } from 'react-native';
import Svg, { Defs, Ellipse, LinearGradient, Path, Polygon, RadialGradient, Stop } from 'react-native-svg';
import type { Tier } from '@/features/creator/tier';

// Same gems as the landing page level ladder (site/src/landing.dc.html #level): highlight → body → shadow per level.
export const RANK_METAL: Record<Tier, { hi: string; mid: string; lo: string; glow: string }> = {
  new: { hi: '#F4F4F7', mid: '#9A9AA6', lo: '#3A3A44', glow: 'rgba(154,154,166,0.4)' },
  rising: { hi: '#D9FBE8', mid: '#34D07A', lo: '#0E4A2C', glow: 'rgba(52,208,122,0.45)' },
  verified: { hi: '#E4F0FD', mid: '#66AAF3', lo: '#0A325D', glow: 'rgba(102,170,243,0.5)' },
  proven: { hi: '#EFE8FF', mid: '#A78BFA', lo: '#3B2577', glow: 'rgba(167,139,250,0.5)' },
  elite: { hi: '#FFF4C7', mid: '#F0B429', lo: '#6B4207', glow: 'rgba(240,180,41,0.55)' },
};

const OUTER = '32.0,10.5 50.6,21.2 50.6,42.8 32.0,53.5 13.4,42.8 13.4,21.2';
const INNER = '32.0,17.5 44.6,24.8 44.6,39.2 32.0,46.5 19.4,39.2 19.4,24.8';
// Bevel facets: top two lit, sides mid, bottom two in shadow.
const FACETS: [string, 'hi' | 'mid' | 'lo', number][] = [
  ['32.0,12.0 49.3,22.0 44.6,24.8 32.0,17.5', 'hi', 0.55], ['49.3,22.0 49.3,42.0 44.6,39.2 44.6,24.8', 'mid', 0.35],
  ['49.3,42.0 32.0,52.0 32.0,46.5 44.6,39.2', 'lo', 0.6], ['32.0,52.0 14.7,42.0 19.4,39.2 32.0,46.5', 'lo', 0.6],
  ['14.7,42.0 14.7,22.0 19.4,24.8 19.4,39.2', 'mid', 0.35], ['14.7,22.0 32.0,12.0 32.0,17.5 19.4,24.8', 'hi', 0.55],
];
// Proven's laurel: five leaves each side climbing from the bottom.
const LAUREL = [[27.5, 57.6, 190, 0.95], [18.6, 54.3, 211, 0.83], [11.5, 48.0, 232, 0.71], [7.1, 39.6, 253, 0.59], [6.1, 30.2, 274, 0.47],
  [36.5, 57.6, -10, 0.95], [45.4, 54.3, -31, 0.83], [52.5, 48.0, -52, 0.71], [56.9, 39.6, -73, 0.59], [57.9, 30.2, -94, 0.47]] as const;

// Faceted hex gem with the TAPP mark; Rising adds a chevron, Proven a laurel, Elite a crown (as on the landing page).
export function RankBadge({ tier, size = 96, dim = false }: { tier: Tier; size?: number; dim?: boolean }) {
  const m = RANK_METAL[tier];
  const g = `rb-${tier}`;
  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, dim && { opacity: 0.4 },
      css({ filter: `drop-shadow(0 0 ${Math.round(size * 0.1)}px ${m.glow})` })]}>
      <Svg width={size} height={size} viewBox="0 0 64 64" style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={g} x1="0.15" y1="0" x2="0.85" y2="1">
            <Stop offset="0" stopColor={m.hi} /><Stop offset="0.45" stopColor={m.mid} /><Stop offset="1" stopColor={m.lo} />
          </LinearGradient>
          <RadialGradient id={`${g}c`} cx="0.35" cy="0.3" r="0.8">
            <Stop offset="0" stopColor={m.mid} /><Stop offset="1" stopColor="#07070A" />
          </RadialGradient>
        </Defs>
        {tier === 'proven' ? LAUREL.map(([cx, cy, r, o], i) => (
          <Ellipse key={i} cx={cx} cy={cy} rx={2.6} ry={5.6} transform={`rotate(${r} ${cx} ${cy})`} fill={`url(#${g})`} opacity={o} />
        )) : null}
        {tier === 'rising' ? <Path d="M22 54 L32 60 L42 54" fill="none" stroke={`url(#${g})`} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" /> : null}
        {tier === 'elite' ? <Path d="M23 9 L26 2 L29.5 7 L32 0.5 L34.5 7 L38 2 L41 9 Z" fill={`url(#${g})`} stroke={m.lo} strokeWidth={0.6} strokeLinejoin="round" /> : null}
        <Polygon points={OUTER} fill={`url(#${g})`} />
        {FACETS.map(([pts, k, o], i) => <Polygon key={i} points={pts} fill={m[k]} fillOpacity={o} />)}
        <Polygon points={INNER} fill={`url(#${g}c)`} stroke={m.hi} strokeOpacity={0.5} strokeWidth={0.8} />
        <Polygon points={OUTER} fill="none" stroke={m.hi} strokeOpacity={0.65} strokeWidth={0.9} />
      </Svg>
      <Image source={MARK} style={{ width: size * 18 / 64, height: size * 18 / 64 }} resizeMode="contain" accessibilityIgnoresInvertColors />
    </View>
  );
}

const MARK = require('../../assets/tapp-mark-white.png');
const css = (o: object) => o as object;
