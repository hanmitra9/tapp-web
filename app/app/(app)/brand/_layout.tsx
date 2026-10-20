import Feather from '@expo/vector-icons/Feather';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { tabChrome } from '@/components/tabChrome';
import { useLayout } from '@/lib/useLayout';
import { color } from '@/theme/tokens';

type Icon = ComponentProps<typeof Feather>['name'];
const icon = (name: Icon) => ({ color: c }: { color: string }) => <Feather name={name} color={c} size={21} />;

// Brand home: three read-only destinations. Desktop uses BrandSidebar (app layout); phones keep the bottom tabs.
export default function BrandTabs() {
  const { isWide } = useLayout();
  return (
    <Tabs
      tabBar={isWide ? () => null : undefined}
      screenOptions={{
        headerShown: false,
        tabBarPosition: isWide ? 'left' : 'bottom',
        ...tabChrome,
        sceneStyle: { backgroundColor: color.canvas },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Ringkasan', tabBarIcon: icon('pie-chart') }} />
      <Tabs.Screen name="campaigns" options={{ title: 'Campaign', tabBarIcon: icon('layers') }} />
      <Tabs.Screen name="account" options={{ title: 'Akun', tabBarIcon: icon('briefcase') }} />
    </Tabs>
  );
}
