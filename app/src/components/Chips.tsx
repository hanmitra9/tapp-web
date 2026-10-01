import { Pressable, StyleSheet, Text, View } from 'react-native';
import { color, radius, space, type } from '@/theme/tokens';

type Opt = { value: string; label: string };
type Props = {
  options: Opt[];
  value: string[];
  onChange: (next: string[]) => void;
  multiple?: boolean;
  max?: number;
  disabled?: boolean;
};

// Selection chips. Single mode behaves like a radio group; multi mode enforces an optional max.
export function Chips({ options, value, onChange, multiple = false, max, disabled }: Props) {
  const atMax = multiple && max != null && value.length >= max;
  function toggle(v: string) {
    if (!multiple) return onChange([v]);
    if (value.includes(v)) return onChange(value.filter((x) => x !== v));
    if (!atMax) onChange([...value, v]);
  }
  return (
    <View style={styles.wrap} accessibilityRole={multiple ? undefined : 'radiogroup'}>
      {options.map((o) => {
        const on = value.includes(o.value);
        const blocked = disabled || (!on && atMax);
        return (
          <Pressable
            key={o.value}
            onPress={() => toggle(o.value)}
            disabled={blocked}
            accessibilityRole={multiple ? 'checkbox' : 'radio'}
            accessibilityState={{ checked: on, disabled: blocked }}
            style={({ pressed }) => [styles.chip, on && styles.on, pressed && !on && styles.pressed, blocked && styles.blocked]}
          >
            <Text style={[styles.label, on && styles.labelOn]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    minHeight: 40, paddingHorizontal: 16, justifyContent: 'center', borderRadius: radius.pill,
    borderWidth: 1, borderColor: color.surface, backgroundColor: color.surface,
  },
  on: { backgroundColor: color.blue, borderColor: color.blue },
  pressed: { backgroundColor: color.surfaceRaised },
  blocked: { opacity: 0.4 },
  label: { ...type.label, color: color.textSecondary },
  labelOn: { color: color.onAccent },
});
