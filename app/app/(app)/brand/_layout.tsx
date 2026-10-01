import Feather from '@expo/vector-icons/Feather';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { WebSidebar } from '@/components/WebSidebar';
import { useLayout } from '@/lib/useLayout';
import { color, font, radius } from '@/theme/tokens';

type Icon = ComponentProps<typeof Feather>['name'];
const icon = (name: Icon) => ({ color: c }: { color: string }) => <Feather name={name} color={c} size={21} />;

// Brand home: same shell as the creator app, three read-only destinations.
export default function BrandTabs() {
  const { isWide } = useLayout();
  return (
    <Tabs
      tabBar={isWide ? (props) => <WebSidebar {...props} product="TAPP for Brands" /> : undefined}
      screenOptions={{
        headerShown: false,
        tabBarPosition: isWide ? 'left' : 'bottom',
        tabBarActiveTintColor: color.blue,
        tabBarInactiveTintColor: color.textMuted,
        tabBarStyle: {
          backgroundColor: color.surface, borderTopWidth: 0, elevation: 0,
          borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, height: 84, paddingTop: 10, position: 'absolute',
        },
        tabBarLabelStyle: { fontFamily: font.semibold, fontSize: 11, marginTop: 2 },
        sceneStyle: { backgroundColor: color.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Ringkasan', tabBarIcon: icon('pie-chart') }} />
      <Tabs.Screen name="campaigns" options={{ title: 'Campaign', tabBarIcon: icon('layers') }} />
      <Tabs.Screen name="account" options={{ title: 'Akun', tabBarIcon: icon('briefcase') }} />
    </Tabs>
  );
}
