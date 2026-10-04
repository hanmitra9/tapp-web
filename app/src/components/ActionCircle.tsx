import Feather from '@expo/vector-icons/Feather';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { color, space, type } from '@/theme/tokens';

type Props = { icon: ComponentProps<typeof Feather>['name']; label: string; onPress: () => void };

// Reference quick action: outlined circle icon with a caption underneath.
export function ActionCircle({ icon, label, onPress }: Props) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={styles.wrap} hitSlop={4}>
      {({ pressed }) => (
        <>
          <View style={[styles.circle, pressed && styles.pressed]} {...({ dataSet: { tapp: 'action' } } as object)}><Feather name={icon} size={20} color="#C2DDFA" /></View>
          <Text style={styles.label} numberOfLines={1}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}
const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: space.sm, flex: 1 },
  circle: { width: 56, height: 56, borderRadius: 28, borderWidth: 1, borderColor: color.borderStrong, backgroundColor: color.surface,
    alignItems: 'center', justifyContent: 'center' },
  pressed: { backgroundColor: color.surfaceRaised },
  label: { ...type.caption, fontSize: 12, color: color.textSecondary },
});
