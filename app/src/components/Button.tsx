import { ActivityIndicator, Pressable, StyleSheet, Text, type PressableProps } from 'react-native';
import { color, radius, type } from '@/theme/tokens';

type Variant = 'primary' | 'secondary' | 'quiet';
type Props = Omit<PressableProps, 'children'> & { label: string; variant?: Variant; loading?: boolean };

export function Button({ label, variant = 'primary', loading = false, disabled, style, ...rest }: Props) {
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: loading }}
      disabled={inactive}
      hitSlop={variant === 'quiet' ? 8 : 0}
      style={(state) => [
        styles.base, styles[variant],
        state.pressed && pressed[variant],
        inactive && variant !== 'quiet' && styles.inactive,
        typeof style === 'function' ? style(state) : style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? color.onAccent : color.blue} />
      ) : (
        <Text style={[styles.label, labels[variant], inactive && variant === 'quiet' && { color: color.textMuted }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: 54, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22 },
  primary: { backgroundColor: color.blue },
  secondary: { backgroundColor: color.surface },
  quiet: { minHeight: 40, paddingHorizontal: 0, alignSelf: 'center' },
  inactive: { opacity: 0.4 },
  label: { ...type.heading },
});
const pressed = StyleSheet.create({
  primary: { backgroundColor: color.bluePressed, transform: [{ scale: 0.99 }] },
  secondary: { backgroundColor: color.surfaceRaised },
  quiet: { opacity: 0.6 },
});
const labels = StyleSheet.create({
  primary: { color: color.onAccent },
  secondary: { color: color.text },
  quiet: { ...type.label, color: color.blue },
});
