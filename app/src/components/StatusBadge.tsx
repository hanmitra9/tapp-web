import { StyleSheet, Text, View } from 'react-native';
import { color, radius, type } from '@/theme/tokens';

export type Tone = 'neutral' | 'blue' | 'success' | 'warning' | 'danger';
const TONES: Record<Tone, { fg: string; bg: string }> = {
  neutral: { fg: color.textSecondary, bg: color.surfaceRaised },
  blue: { fg: color.blue, bg: color.accentSoft },
  success: { fg: color.success, bg: color.successSoft },
  warning: { fg: color.warning, bg: color.warningSoft },
  danger: { fg: color.danger, bg: color.dangerSoft },
};

export function StatusBadge({ label, tone }: { label: string; tone: Tone }) {
  const t = TONES[tone];
  return (
    <View style={[styles.badge, { backgroundColor: t.bg, borderColor: t.fg + '33' }]}>
      <View style={[styles.dot, { backgroundColor: t.fg, boxShadow: `0 0 6px ${t.fg}` }]} />
      <Text style={[styles.text, { color: t.fg }]}>{label}</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, borderWidth: 1, alignSelf: 'flex-start' },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { ...type.caption, fontSize: 12, lineHeight: 15, fontFamily: type.label.fontFamily },
});
