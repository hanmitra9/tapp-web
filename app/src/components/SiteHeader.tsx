import { usePathname, useRouter } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLayout } from '@/lib/useLayout';
import { goToSite } from '@/lib/site';
import { color, space, type } from '@/theme/tokens';

// Signed-out pages wear the landing page's top bar, so login/sign-up read as part of the same website.
export function SiteHeader() {
  const { isWide } = useLayout();
  const router = useRouter();
  const onRegister = usePathname().startsWith('/register');
  return (
    <View style={[styles.bar, isWide && styles.barWide]}>
      <Pressable onPress={() => goToSite('/')} accessibilityRole="link" accessibilityLabel="TAPP beranda" hitSlop={8}>
        <Image source={require('../../assets/tapp-logo.png')} style={styles.logo} />
      </Pressable>
      <View style={styles.right}>
        {isWide ? (
          <>
            <Pressable onPress={() => goToSite('/campaigns')} accessibilityRole="link"><Text style={styles.link}>Campaigns</Text></Pressable>
            <Pressable onPress={() => goToSite('/#faq')} accessibilityRole="link"><Text style={styles.link}>FAQ</Text></Pressable>
          </>
        ) : null}
        <Pressable onPress={() => router.replace(onRegister ? '/login' : '/register')} accessibilityRole="button" style={styles.cta}>
          <Text style={styles.ctaText}>{onRegister ? 'Log In' : 'Sign Up'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { height: 64, paddingHorizontal: space.xl, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  barWide: { height: 76, paddingHorizontal: 64 },
  logo: { width: 30, height: 30 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 26 },
  link: { ...type.label, color: color.textSecondary },
  cta: { height: 40, paddingHorizontal: 18, borderRadius: 12, justifyContent: 'center', borderWidth: 1, borderColor: color.border, backgroundColor: color.surface },
  ctaText: { ...type.label, color: color.text },
});
