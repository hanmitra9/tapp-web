import { Stack } from 'expo-router';
import { color } from '@/theme/tokens';

// Signed-out visitors land on the welcome screen (not the first route alphabetically).
export const unstable_settings = { initialRouteName: 'welcome' };

export default function AuthLayout() {
  return (
    <Stack initialRouteName="welcome" screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.bg } }} />
  );
}
