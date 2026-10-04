import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, Pressable, StyleSheet, Text, type PressableProps } from 'react-native';
import { color, gradient, radius, type } from '@/theme/tokens';

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
      {variant === 'primary' ? <LinearGradient colors={gradient.button} locations={[0, 0.48, 1]} style={StyleSheet.absoluteFill} pointerEvents="none" /> : null}
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? color.onAccent : color.blue} />
      ) : (
        <Text style={[styles.label, labels[variant], inactive && variant === 'quiet' && { color: color.textMuted }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22, overflow: 'hidden' },
  primary: { backgroundColor: color.blue, borderWidth: 1, borderColor: 'rgba(194,221,250,0.28)', boxShadow: '0 10px 30px -14px rgba(73,154,240,0.95), inset 0 1px 0 rgba(255,255,255,0.28)' },
  secondary: { backgroundColor: color.surface, borderWidth: 1, borderColor: color.border },
  quiet: { minHeight: 40, paddingHorizontal: 0, alignSelf: 'center' },
  inactive: { opacity: 0.4 },
  label: { ...type.heading },
});
const pressed = StyleSheet.create({
  primary: { opacity: 0.92, transform: [{ scale: 0.99 }] },
  secondary: { backgroundColor: color.surfaceRaised },
  quiet: { opacity: 0.6 },
});
const labels = StyleSheet.create({
  primary: { color: color.onAccent },
  secondary: { color: color.text },
  quiet: { ...type.label, color: color.link },
});
