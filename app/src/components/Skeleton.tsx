import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, type DimensionValue, StyleSheet, View } from 'react-native';
import { color, radius, space } from '@/theme/tokens';

export function SkeletonBlock({ width = '100%', height = 14 }: { width?: DimensionValue; height?: number }) {
  const o = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (reduce) return;
      loop = Animated.loop(Animated.sequence([
        Animated.timing(o, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(o, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ]));
      loop.start();
    });
    return () => loop?.stop();
  }, [o]);
  return <Animated.View style={[styles.block, { width, height, opacity: o }]} />;
}

export function CardSkeleton() {
  return (
    <View style={styles.card} accessibilityLabel="Memuat">
      <SkeletonBlock width="40%" height={12} />
      <SkeletonBlock width="85%" height={18} />
      <SkeletonBlock width="60%" height={12} />
    </View>
  );
}

const styles = StyleSheet.create({
  block: { backgroundColor: color.border, borderRadius: radius.sm },
  card: { gap: space.md, paddingVertical: space.xl, borderBottomWidth: 1, borderBottomColor: color.border },
});
