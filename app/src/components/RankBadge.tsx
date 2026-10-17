import { Image, StyleSheet, View } from 'react-native';
import Svg, { Defs, G, LinearGradient, Path, Polygon, RadialGradient, Stop } from 'react-native-svg';
import type { Tier } from '@/features/creator/tier';

// One metal per level: highlight → body → shadow, plus the glow used around it.
export const RANK_METAL: Record<Tier, { hi: string; mid: string; lo: string; glow: string; wings?: boolean; halo?: boolean }> = {
  new: { hi: '#F2C29A', mid: '#A8673A', lo: '#4B2711', glow: 'rgba(214,140,90,0.45)' },
  rising: { hi: '#E3E8EF', mid: '#7D8794', lo: '#2C3139', glow: 'rgba(190,200,215,0.35)' },
  verified: { hi: '#E8DE9C', mid: '#968C45', lo: '#3B3716', glow: 'rgba(214,200,110,0.35)' },
  proven: { hi: '#B9D6FF', mid: '#3F78E0', lo: '#142C66', glow: 'rgba(80,140,255,0.55)', wings: true },
  elite: { hi: '#FFD2A1', mid: '#E2642A', lo: '#6E1F0C', glow: 'rgba(255,120,50,0.6)', wings: true, halo: true },
};

const HEX = (cx: number, cy: number, r: number) =>
  Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 180) * (60 * i - 90);
    return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
  }).join(' ');

// Feathered wing (left side; mirrored for the right).
const WING = 'M38 52 C26 40 12 38 2 42 C10 44 16 47 20 51 C10 50 4 53 0 58 C9 57 15 58 21 61 C13 62 8 66 6 71 C14 68 22 68 30 70 C24 72 21 75 20 79 C28 74 34 72 40 70 Z';

// Hexagonal rank badge with the TAPP mark cast into it; Proven and Elite get wings, Elite a halo.
export function RankBadge({ tier, size = 96, dim = false }: { tier: Tier; size?: number; dim?: boolean }) {
  const m = RANK_METAL[tier];
  const id = `rb-${tier}`;
  const mark = size * 0.34;
  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, dim && { opacity: 0.45 },
      css({ filter: `drop-shadow(0 0 ${size * 0.12}px ${m.glow})` })]}>
      <Svg width={size} height={size} viewBox="0 0 100 100" style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={`${id}-b`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={m.hi} /><Stop offset="0.45" stopColor={m.mid} /><Stop offset="1" stopColor={m.lo} />
          </LinearGradient>
          <LinearGradient id={`${id}-i`} x1="1" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={m.lo} /><Stop offset="0.55" stopColor={m.mid} /><Stop offset="1" stopColor={m.hi} />
          </LinearGradient>
          <LinearGradient id={`${id}-w`} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={m.hi} /><Stop offset="1" stopColor={m.mid} />
          </LinearGradient>
          <RadialGradient id={`${id}-h`} cx="0.5" cy="0.5" r="0.5">
            <Stop offset="0.55" stopColor={m.mid} stopOpacity="0" /><Stop offset="0.75" stopColor={m.hi} stopOpacity="0.55" /><Stop offset="1" stopColor={m.mid} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        {m.halo ? <Path d="M50 4 A46 46 0 1 1 49.9 4 Z" fill={`url(#${id}-h)`} /> : null}
        {m.wings ? (
          <G opacity={0.95}>
            <Path d={WING} fill={`url(#${id}-w)`} stroke={m.lo} strokeWidth={0.6} />
            <G transform="translate(100,0) scale(-1,1)"><Path d={WING} fill={`url(#${id}-w)`} stroke={m.lo} strokeWidth={0.6} /></G>
          </G>
        ) : null}
        <Polygon points={HEX(50, 50, m.wings ? 33 : 42)} fill={`url(#${id}-b)`} stroke={m.lo} strokeWidth={1} />
        <Polygon points={HEX(50, 50, m.wings ? 26 : 33)} fill={`url(#${id}-i)`} stroke={m.hi} strokeOpacity={0.6} strokeWidth={0.8} />
        <Polygon points={HEX(50, 50, m.wings ? 33 : 42)} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={0.6} />
      </Svg>
      <View style={[{ width: mark * (m.wings ? 0.8 : 1), height: mark * (m.wings ? 0.8 : 1) }, css({
        ...maskOf(MARK_URI), backgroundImage: `linear-gradient(160deg, ${m.hi} 0%, #FFFFFF 35%, ${m.mid} 100%)`,
        filter: `drop-shadow(0 1px 1px ${m.lo})`,
      })]} />
    </View>
  );
}

const MARK = require('../../assets/tapp-mark-white.png');
const MARK_URI: string = (() => { const x = MARK as unknown; return typeof x === 'string' ? x : (x as { uri?: string })?.uri ?? (x as { default?: string })?.default ?? Image.resolveAssetSource?.(MARK)?.uri ?? ''; })();
const maskOf = (uri: string) => ({ maskImage: `url(${uri})`, WebkitMaskImage: `url(${uri})`, maskSize: 'contain', WebkitMaskSize: 'contain',
  maskRepeat: 'no-repeat', WebkitMaskRepeat: 'no-repeat', maskPosition: 'center', WebkitMaskPosition: 'center' });
const css = (o: object) => o as object;
