import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { color, space, type } from '@/theme/tokens';

// Label + control + helper/error, for non-text controls (chips, pickers).
export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string | null; children: ReactNode }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      {children}
      {error ? <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  label: { ...type.label, color: color.text },
  hint: { ...type.caption, color: color.textMuted, marginTop: -2 },
  error: { ...type.caption, color: color.danger },
});
