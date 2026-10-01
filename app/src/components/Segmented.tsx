import { Pressable, StyleSheet, Text, View } from 'react-native';
import { color, radius, space, type } from '@/theme/tokens';

type Opt = { value: string; label: string };

// Reference "Day / Month / Year" control: one dark track, the active segment sits darker inside it.
export function Segmented({ options, value, onChange }: { options: Opt[]; value: string; onChange: (v: string) => void }) {
  return (
    <View style={styles.track} accessibilityRole="tablist">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={o.value} onPress={() => onChange(o.value)} accessibilityRole="tab" accessibilityState={{ selected: on }}
            style={[styles.seg, on && styles.segOn]}>
            <Text style={[styles.label, on && styles.labelOn]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
const styles = StyleSheet.create({
  track: { flexDirection: 'row', backgroundColor: color.surface, borderRadius: radius.md, padding: 4, gap: 4 },
  seg: { flex: 1, height: 40, borderRadius: radius.sm + 2, alignItems: 'center', justifyContent: 'center' },
  segOn: { backgroundColor: color.bg },
  label: { ...type.label, color: color.textMuted },
  labelOn: { color: color.text },
});
