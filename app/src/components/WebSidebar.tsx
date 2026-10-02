import Feather from '@expo/vector-icons/Feather';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { goToSite } from '@/lib/site';
import { color, radius, space, type } from '@/theme/tokens';

// Desktop replacement for the floating tab bar: logo, then the same five destinations as a vertical list.
export function WebSidebar({ state, descriptors, navigation, product = 'TAPP Creators' }: BottomTabBarProps & { product?: string }) {
  return (
    <View style={styles.bar} accessibilityRole="menu" {...({ dataSet: { tapp: 'glass' } } as object)}>
      <Pressable style={styles.brand} onPress={() => goToSite('/')} accessibilityRole="link" accessibilityLabel="TAPP beranda">
        <Image source={require('../../assets/tapp-logo.png')} style={styles.logo} />
        <Text style={styles.brandText}>{product}</Text>
      </Pressable>
      {state.routes.map((route, i) => {
        const { options } = descriptors[route.key]!;
        const focused = state.index === i;
        const label = typeof options.title === 'string' ? options.title : route.name;
        const tint = focused ? color.onAccent : color.textMuted;
        return (
          <Pressable key={route.key} accessibilityRole="menuitem" accessibilityState={{ selected: focused }} {...(focused ? ({ dataSet: { tapp: 'navon' } } as object) : {})}
            onPress={() => {
              const e = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !e.defaultPrevented) navigation.navigate(route.name, route.params);
            }}
            style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [styles.item, focused && styles.itemOn, !focused && (hovered || pressed) && styles.itemHover]}>
            {options.tabBarIcon?.({ focused, color: tint, size: 20 }) ?? <Feather name="circle" color={tint} size={20} />}
            <Text style={[styles.label, { color: focused ? color.onAccent : color.textSecondary }]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { width: 248, backgroundColor: color.surface, margin: space.md, marginRight: 0, borderRadius: radius.lg, padding: space.md, gap: 4 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.sm, paddingTop: space.sm, paddingBottom: space.xl },
  logo: { width: 28, height: 28 },
  brandText: { ...type.heading, fontSize: 17, color: color.text },
  item: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.md, height: 46, borderRadius: radius.md },
  itemOn: { backgroundColor: color.blue },
  itemHover: { backgroundColor: color.surfaceRaised },
  label: { ...type.label },
});
