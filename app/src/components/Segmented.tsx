import { Pressable, StyleSheet, Text, View } from 'react-native';
import { color, radius, space, type } from '@/theme/tokens';

type Opt = { value: string; label: string };

// Reference "Day / Month / Year" control: one dark track, the active segment sits darker inside it.
export function Segmented({ options, value, onChange }: { options: Opt[]; value: string; onChange: (v: string) => void }) {
  return (
    <View style={styles.track} accessibilityRole="tablist" {...({ dataSet: { tapp: 'seg-track' } } as object)}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={o.value} onPress={() => onChange(o.value)} accessibilityRole="tab" accessibilityState={{ selected: on }}
            style={[styles.seg, on && styles.segOn]} {...(on ? ({ dataSet: { tapp: 'seg-on' } } as object) : {})}>
            <Text style={[styles.label, on && styles.labelOn]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
const styles = StyleSheet.create({
  track: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: radius.md, padding: 4, gap: 4 },
  seg: { flex: 1, height: 40, borderRadius: radius.sm + 2, alignItems: 'center', justifyContent: 'center' },
  segOn: { backgroundColor: color.blue },
  label: { ...type.label, color: color.textMuted },
  labelOn: { color: '#FFFFFF' },
});
