import { useId, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { color, space, type } from '@/theme/tokens';

// Label + control + helper/error, for non-text controls (chips, pickers).
export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string | null; children: ReactNode }) {
  const id = `fd${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  // Named group, so screen readers announce "Platform, group" before the chips inside.
  return (
    <View style={styles.wrap} role="group" aria-labelledby={`${id}-label`}>
      <Text style={styles.label} nativeID={`${id}-label`}>{label}</Text>
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
