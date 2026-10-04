import { Stack } from 'expo-router';
import { LoadState } from '@/components/LoadState';
import { Screen } from '@/components/Screen';
import { useAuth } from '@/providers/AuthProvider';
import { color } from '@/theme/tokens';

export default function AppLayout() {
  const { account, accountError, refreshAccount } = useAuth();
  if (!account) {
    return <Screen scroll={false}>
      <LoadState error={accountError ? 'Gagal memuat akun. Periksa koneksi internet.' : null} onRetry={refreshAccount} />
    </Screen>;
  }
  // Two homes: brand accounts get the read-only brand portal, everyone else the creator app.
  const isBrand = account.role === 'brand';
  const needsOnboarding = !isBrand && !account.onboarded && account.status === 'pending';
  const creator = !isBrand && !needsOnboarding;
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.canvas } }}>
      <Stack.Protected guard={isBrand}>
        <Stack.Screen name="brand" />
        <Stack.Screen name="brand-campaign/[id]" />
      </Stack.Protected>
      <Stack.Protected guard={needsOnboarding}>
        <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
      </Stack.Protected>
      <Stack.Protected guard={creator}>
        <Stack.Screen name="dashboard" />
        <Stack.Screen name="campaign/[id]" />
        <Stack.Screen name="workspace/[id]" />
        <Stack.Screen name="performance" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="payouts" />
        <Stack.Screen name="help" />
        <Stack.Screen name="dispute" options={{ presentation: 'modal' }} />
        <Stack.Screen name="submit/[campaignId]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="take/[id]" />
        <Stack.Screen name="profile/edit" />
        <Stack.Screen name="profile/socials" />
        <Stack.Screen name="profile/payout" />
      </Stack.Protected>
    </Stack>
  );
}
