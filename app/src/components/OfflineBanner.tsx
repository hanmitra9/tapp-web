import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, Text } from 'react-native';
import { useOnline } from '@/providers/NetworkProvider';
import { color, space, type } from '@/theme/tokens';

// Persistent top banner while offline; auto-hides on reconnect. Screens still handle their own
// per-action errors (this is ambient status, not a substitute for inline error handling).
export function OfflineBanner() {
  const online = useOnline();
  const [show, setShow] = useState(false);
  const h = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!online) setShow(true);
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      Animated.timing(h, { toValue: online ? 0 : 1, duration: reduce ? 0 : 200, useNativeDriver: false })
        .start(() => { if (online) setShow(false); });
    });
  }, [online, h]);
  if (!show) return null;
  return (
    <Animated.View style={[styles.wrap, { height: h.interpolate({ inputRange: [0, 1], outputRange: [0, 32] }) }]}
      accessibilityLiveRegion="polite">
      <Text style={styles.text}>Tidak ada koneksi internet</Text>
    </Animated.View>
  );
}
const styles = StyleSheet.create({
  wrap: { backgroundColor: color.text, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  text: { ...type.caption, color: color.text, fontFamily: type.label.fontFamily },
});
