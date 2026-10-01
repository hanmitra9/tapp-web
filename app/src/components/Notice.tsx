import { StyleSheet, Text, View } from 'react-native';
import { color, radius, space, type } from '@/theme/tokens';

// Inline result of an action. Errors say what happened and what to do; no apologies.
export function Notice({ tone, message }: { tone: 'error' | 'info'; message: string | null }) {
  if (!message) return null;
  return (
    <View accessibilityRole="alert" style={[styles.box, tone === 'error' ? styles.error : styles.info]}>
      <Text style={[styles.text, { color: tone === 'error' ? color.danger : color.textSecondary }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: radius.md, paddingVertical: space.md, paddingHorizontal: space.lg },
  error: { backgroundColor: color.dangerSoft },
  info: { backgroundColor: color.accentSoft },
  text: { ...type.caption },
});
