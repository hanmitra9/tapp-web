import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, Text, View } from 'react-native';
import { color, space, type } from '@/theme/tokens';

// Segmented rail: completed segments fill in TAPP Blue; the current one animates in.
export function StepProgress({ step, total, title }: { step: number; total: number; title: string }) {
  const fill = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    fill.setValue(0);
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (reduce) return fill.setValue(1);
      Animated.timing(fill, { toValue: 1, duration: 360, useNativeDriver: false }).start();
    });
  }, [step, fill]);

  return (
    <View style={styles.wrap} accessible accessibilityLabel={`Langkah ${step + 1} dari ${total}: ${title}`}>
      <View style={styles.rail}>
        {Array.from({ length: total }, (_, i) => (
          <View key={i} style={styles.seg}>
            {i < step ? <View style={[styles.fill, { width: '100%' }]} /> : null}
            {i === step ? (
              <Animated.View style={[styles.fill, { width: fill.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
            ) : null}
          </View>
        ))}
      </View>
      <Text style={styles.count}>Langkah {step + 1} dari {total}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm, marginBottom: space.xl },
  rail: { flexDirection: 'row', gap: 4 },
  seg: { flex: 1, height: 3, backgroundColor: color.border, borderRadius: 2, overflow: 'hidden' },
  fill: { height: 3, backgroundColor: color.blue },
  count: { ...type.caption, color: color.textMuted, fontVariant: ['tabular-nums'] },
});
