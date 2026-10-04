import '@/lib/webStyles';
import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { openedProtectedPage, rememberReturn, takeReturn } from '@/lib/returnTo';
import { AppState } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { OfflineBanner } from '@/components/OfflineBanner';
import { AuthProvider, useAuth } from '@/providers/AuthProvider';
import { NetworkProvider } from '@/providers/NetworkProvider';
import { color } from '@/theme/tokens';
import { trackAppOpened } from '@/lib/analytics';
import { captureReferral } from '@/features/referral/api';

captureReferral();

// Navigation containers stay transparent so the page background (src/lib/webStyles.ts) shows through.
const NAV_THEME = { ...DarkTheme, colors: { ...DarkTheme.colors, background: 'transparent', card: 'transparent', primary: color.blue } };

function RootNavigator() {
  const { ready, session, recovering } = useAuth();
  const loaded = ready;   // fonts load through CSS (src/lib/webStyles.ts) with font-display: swap, never blocking

  useEffect(() => {
    trackAppOpened();
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') trackAppOpened(); });
    return () => sub.remove();
  }, []);
  const signedIn = !!session && !recovering;
  const router = useRouter();
  const handled = useRef(false);
  useEffect(() => {
    if (!loaded) return;
    if (!signedIn) {
      // Opened a page inside the app while signed out: go to login, come back after.
      if (openedProtectedPage && !handled.current) { handled.current = true; rememberReturn(); router.replace('/login'); }
      return;
    }
    const next = takeReturn();
    if (next) router.replace(next as never);
  }, [loaded, signedIn, router]);
  if (!loaded) return null;

  return (
    <>
    <OfflineBanner />
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.canvas }, animation: 'slide_from_right' }}>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(app)" options={{ animation: 'fade' }} />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
      </Stack.Protected>
    </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider value={NAV_THEME}>
      <NetworkProvider>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
      </NetworkProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
