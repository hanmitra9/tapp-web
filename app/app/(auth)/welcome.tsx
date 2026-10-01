import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, G, LinearGradient, Mask, Path, Rect, Stop } from 'react-native-svg';
import { track } from '@/lib/analytics';
import { color, radius, space, type } from '@/theme/tokens';

const SLIDES = [
  'Distribusikan konten brand. Dibayar dari setiap qualified view.',
  'Gabung campaign, buat klip, posting di TikTok, Instagram, atau YouTube.',
  'Submit link-nya. TAPP verifikasi, lacak views, dan kirim penghasilanmu.',
];

// Reference onboarding: oversized TAPP-blue ribbons, headline anchored bottom-left, dots + round arrow.
export default function Welcome() {
  const { width, height } = useWindowDimensions();
  const wide = width >= 900;
  const [i, setI] = useState(0);
  const fade = useRef(new Animated.Value(1)).current;
  const reduce = useRef(false);
  useEffect(() => { AccessibilityInfo.isReduceMotionEnabled().then((r) => { reduce.current = r; }); }, []);

  function next() {
    if (i === SLIDES.length - 1) { track('signup_started'); return router.push('/register'); }
    if (reduce.current) return setI(i + 1);
    Animated.timing(fade, { toValue: 0, duration: 140, useNativeDriver: true }).start(() => {
      setI(i + 1);
      Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    });
  }

  // Ribbons live in their own box: full-bleed on phones, a right-hand panel on desktop (no stretching/clipping).
  const w = wide ? Math.min(width * 0.55, 820) : width;
  const h = wide ? height * 0.9 : height * 0.62;
  const x0 = wide ? width - w * 0.95 : 0;
  const clipX = wide ? width * 0.44 : 0;   // desktop: ribbons fade in right of the headline column
  return (
    <View style={styles.root}>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Defs>
          <LinearGradient id="a" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={color.blueDeep} />
            <Stop offset="0.55" stopColor={color.blue} />
            <Stop offset="1" stopColor={color.blueLight} />
          </LinearGradient>
          <LinearGradient id="b" x1="1" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color.blueLight} stopOpacity="0.95" />
            <Stop offset="1" stopColor={color.blue} stopOpacity="0.2" />
          </LinearGradient>
          {/* Soft left edge on desktop so the ribbons fade in instead of being cut off */}
          <LinearGradient id="fade" x1={clipX} y1="0" x2={clipX + (wide ? 160 : 1)} y2="0" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#fff" stopOpacity="0" />
            <Stop offset="1" stopColor="#fff" stopOpacity="1" />
          </LinearGradient>
          <Mask id="panel" x="0" y="0" width={width} height={height} maskUnits="userSpaceOnUse">
            <Rect x={0} y={0} width={width} height={height} fill="url(#fade)" />
          </Mask>
        </Defs>
        {/* Thick ribbon sweeping from the top-left, echoing the reference's arc */}
        <G mask={wide ? "url(#panel)" : undefined}><G transform={`translate(${x0}, ${wide ? height * 0.05 : 0})`}>
        <Path d={`M ${-w * 0.25} ${h * 0.05} C ${w * 0.55} ${-h * 0.25}, ${w * 1.25} ${h * 0.25}, ${w * 0.55} ${h * 0.62}
                  S ${-w * 0.1} ${h * 0.95}, ${-w * 0.25} ${h * 0.72}`}
          stroke="url(#a)" strokeWidth={w * 0.13} strokeLinecap="round" fill="none" />
        <Path d={`M ${w * 1.15} ${h * 0.3} C ${w * 0.7} ${h * 0.35}, ${w * 0.2} ${h * 0.5}, ${-w * 0.05} ${h * 0.95}`}
          stroke="url(#b)" strokeWidth={w * 0.09} strokeLinecap="round" fill="none" />
        </G></G>
      </Svg>

      <SafeAreaView style={[styles.safe, wide && styles.safeWide]} edges={['top', 'bottom']}>
        <View style={styles.spacer} />
        <Animated.Text style={[styles.headline, wide && styles.headlineWide, { opacity: fade }]} accessibilityRole="header" accessibilityLiveRegion="polite">
          {SLIDES[i]}
        </Animated.Text>
        <View style={[styles.bottom, wide && styles.narrowCol]}>
          <View style={styles.dots} accessibilityLabel={`Halaman ${i + 1} dari ${SLIDES.length}`}>
            {SLIDES.map((_, k) => <View key={k} style={[styles.dot, k === i && styles.dotOn]} />)}
          </View>
          <Pressable onPress={next} accessibilityRole="button" accessibilityLabel={i === SLIDES.length - 1 ? 'Buat akun' : 'Lanjut'}
            style={({ pressed }) => [styles.arrow, pressed && { backgroundColor: color.bluePressed }]}>
            <Feather name="chevron-right" size={26} color={color.onAccent} />
          </Pressable>
        </View>
        <Pressable onPress={() => router.push('/login')} hitSlop={10} style={[styles.login, wide && styles.loginWide]} accessibilityRole="button">
          <Text style={styles.loginText}>Sudah punya akun? <Text style={styles.loginLink}>Masuk</Text></Text>
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  safe: { flex: 1, paddingHorizontal: space.xl },
  safeWide: { paddingHorizontal: 72, paddingBottom: 56, justifyContent: 'center' },
  spacer: { flex: 1 },
  headline: { ...type.display, fontSize: 32, lineHeight: 40, color: color.text, maxWidth: 330, minHeight: 120 },
  headlineWide: { fontSize: 52, lineHeight: 60, maxWidth: 560, minHeight: 200 },
  narrowCol: { maxWidth: 560, width: '100%' },
  loginWide: { alignSelf: 'flex-start' },
  bottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space.xxl },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: color.borderStrong },
  dotOn: { backgroundColor: color.text, width: 18 },
  arrow: { width: 64, height: 64, borderRadius: radius.pill, backgroundColor: color.blue, alignItems: 'center', justifyContent: 'center' },
  login: { alignSelf: 'center', marginTop: space.xl, marginBottom: space.sm },
  loginText: { ...type.label, color: color.textMuted },
  loginLink: { color: color.text },
});
