import Feather from '@expo/vector-icons/Feather';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { WebSidebar } from '@/components/WebSidebar';
import { useLayout } from '@/lib/useLayout';
import { color, font, radius } from '@/theme/tokens';

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
        tabBarActiveTintColor: color.blue,
        tabBarInactiveTintColor: color.textMuted,
        tabBarStyle: {
          backgroundColor: color.surface, borderTopWidth: 0, elevation: 0,
          borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, height: 84, paddingTop: 10, position: 'absolute',
        },
        tabBarLabelStyle: { fontFamily: font.semibold, fontSize: 11, marginTop: 2 },
        tabBarActiveBackgroundColor: 'transparent',
        sceneStyle: { backgroundColor: color.canvas },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Beranda', tabBarIcon: icon('home') }} />
      <Tabs.Screen name="campaigns" options={{ title: 'Campaign', tabBarIcon: icon('compass') }} />
      <Tabs.Screen name="activity" options={{ title: 'Aktivitas', tabBarIcon: icon('repeat') }} />
      <Tabs.Screen name="earnings" options={{ title: 'Penghasilan', tabBarIcon: icon('credit-card') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profil', tabBarIcon: icon('user') }} />
    </Tabs>
  );
}
