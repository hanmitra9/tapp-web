import Feather from '@expo/vector-icons/Feather';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { color, radius, space, type } from '@/theme/tokens';

export function Checkbox({ checked, onChange, label, error }: { checked: boolean; onChange: (v: boolean) => void; label: string; error?: string | null }) {
  return (
    <View style={{ gap: space.xs }}>
      <Pressable onPress={() => onChange(!checked)} accessibilityRole="checkbox" accessibilityState={{ checked }} style={styles.row} hitSlop={6}>
        <View style={[styles.box, checked && styles.on, !!error && !checked && styles.err]}>
          {checked ? <Feather name="check" size={14} color={color.onAccent} /> : null}
        </View>
        <Text style={styles.label}>{label}</Text>
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  box: { width: 22, height: 22, borderRadius: radius.sm - 1, borderWidth: 1.5, borderColor: color.borderStrong, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  on: { backgroundColor: color.blue, borderColor: color.blue },
  err: { borderColor: color.danger },
  label: { ...type.body, color: color.text, flex: 1 },
  error: { ...type.caption, color: color.danger, marginLeft: 34 },
});
