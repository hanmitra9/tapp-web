import { Stack } from 'expo-router';
import { View } from 'react-native';
import { SiteHeader } from '@/components/SiteHeader';
import { color } from '@/theme/tokens';

// The landing page (site/) is the front door; signed-out app routes start at login.
export const unstable_settings = { initialRouteName: 'login' };

export default function AuthLayout() {
  return (
    <View style={{ flex: 1 }}>
      <SiteHeader />
      <Stack initialRouteName="login" screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.canvas } }} />
    </View>
  );
}
