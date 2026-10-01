import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { color, radius, space, type } from '@/theme/tokens';

type Props = { title: string; subtitle?: string; back?: boolean; right?: ReactNode };

// Reference style: a quiet top bar (chevron back, optional right action) with a bold title beneath.
export function Header({ title, subtitle, back = true, right }: Props) {
  // On web a page can be opened directly (no history); back then returns to the role's home instead of vanishing.
  const canBack = back;
  return (
    <View style={styles.wrap}>
      {canBack || right ? (
        <View style={styles.bar}>
          {canBack ? (
            <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} hitSlop={12} accessibilityRole="button" accessibilityLabel="Kembali"
              style={({ pressed }) => [styles.icon, pressed && { backgroundColor: color.surfaceRaised }]}>
              <Feather name="chevron-left" size={24} color={color.text} />
            </Pressable>
          ) : <View />}
          {right ?? null}
        </View>
      ) : null}
      {title ? <Text style={styles.title} accessibilityRole="header">{title}</Text> : null}
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm, marginBottom: space.xxl },
  bar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space.md, marginLeft: -8 },
  icon: { width: 40, height: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  title: { ...type.title, color: color.text },
  subtitle: { ...type.body, color: color.textSecondary },
});
