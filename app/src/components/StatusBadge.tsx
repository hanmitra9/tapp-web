import { StyleSheet, Text } from 'react-native';
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
  return <Text style={[styles.badge, { color: t.fg, backgroundColor: t.bg }]}>{label}</Text>;
}
const styles = StyleSheet.create({
  badge: { ...type.caption, fontFamily: type.label.fontFamily, paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.pill, overflow: 'hidden', alignSelf: 'flex-start' },
});
