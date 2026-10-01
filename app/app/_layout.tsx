import {
  InstrumentSans_400Regular, InstrumentSans_500Medium, InstrumentSans_600SemiBold, InstrumentSans_700Bold, useFonts,
} from '@expo-google-fonts/instrument-sans';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { openedProtectedPage, rememberReturn, takeReturn } from '@/lib/returnTo';
import { AppState } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { OfflineBanner } from '@/components/OfflineBanner';
import { AuthProvider, useAuth } from '@/providers/AuthProvider';
import { NetworkProvider } from '@/providers/NetworkProvider';
import { color } from '@/theme/tokens';
import { trackAppOpened } from '@/lib/analytics';

SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ duration: 250, fade: true });

function RootNavigator() {
  const { ready, session, recovering } = useAuth();
  const [fontsLoaded, fontError] = useFonts({
    InstrumentSans_400Regular, InstrumentSans_500Medium, InstrumentSans_600SemiBold, InstrumentSans_700Bold,
  });
  const loaded = ready && (fontsLoaded || !!fontError);   // font failure falls back to system font, never blocks

  useEffect(() => { if (loaded) SplashScreen.hideAsync(); }, [loaded]);
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
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.bg }, animation: 'slide_from_right' }}>
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
      <NetworkProvider>
      <AuthProvider>
        <StatusBar style="light" />
        <RootNavigator />
      </AuthProvider>
      </NetworkProvider>
    </SafeAreaProvider>
  );
}
