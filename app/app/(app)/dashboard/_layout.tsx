import Feather from '@expo/vector-icons/Feather';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { WebSidebar } from '@/components/WebSidebar';
import { tabChrome } from '@/components/tabChrome';
import { useLayout } from '@/lib/useLayout';
import { color } from '@/theme/tokens';

type Icon = ComponentProps<typeof Feather>['name'];
const icon = (name: Icon) => ({ color: c }: { color: string }) => <Feather name={name} color={c} size={21} />;

// Reference style: a raised dark bar with rounded top corners, blue active icon, white active label.
export default function TabsLayout() {
  const { isWide } = useLayout();
  return (
    <Tabs
      tabBar={isWide ? (props) => <WebSidebar {...props} /> : undefined}
      screenOptions={{
        tabBarPosition: isWide ? 'left' : 'bottom',
        headerShown: false,
        ...tabChrome,
        sceneStyle: { backgroundColor: color.canvas },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Beranda', tabBarIcon: icon('home') }} />
      <Tabs.Screen name="campaigns" options={{ title: 'Campaign', tabBarIcon: icon('compass') }} />
      <Tabs.Screen name="activity" options={{ title: 'Aktivitas', tabBarIcon: icon('repeat') }} />
      <Tabs.Screen name="earnings" options={{ title: 'Pembayaran', tabBarIcon: icon('credit-card') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profil', tabBarIcon: icon('user') }} />
    </Tabs>
  );
}
