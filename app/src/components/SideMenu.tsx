import Feather from '@expo/vector-icons/Feather';
import { router, usePathname } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { Animated, Image, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLayout } from '@/lib/useLayout';
import { useAuth } from '@/providers/AuthProvider';
import { fetchMyCampaigns, type MyCampaign } from '@/features/campaigns/api';
import { unreadCount } from '@/features/notifications/api';
import { color, radius, space, type } from '@/theme/tokens';

type Icon = ComponentProps<typeof Feather>['name'];
const WA = 'https://wa.me/6282314049440?text=' + encodeURIComponent('Halo Admin TAPP, saya creator dan butuh bantuan.');
const W = 300;

const Ctx = createContext<{ open: () => void }>({ open: () => {} });
export const useSideMenu = () => useContext(Ctx);

// Phone navigation drawer (konten-style): main pages, learn card, joined campaigns, help, account.
export function SideMenuProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  const open = useCallback(() => setVisible(true), []);
  return (
    <Ctx.Provider value={{ open }}>
      {children}
      {visible ? <Drawer onClose={() => setVisible(false)} /> : null}
    </Ctx.Provider>
  );
}

// Hamburger shown on phone tab screens (desktop keeps the sidebar).
export function MenuButton() {
  const { isWide } = useLayout();
  const { open } = useSideMenu();
  if (isWide) return null;
  return (
    <Pressable onPress={open} hitSlop={8} accessibilityRole="button" accessibilityLabel="Buka menu"
      style={({ pressed }) => [styles.menuBtn, pressed && { backgroundColor: color.surfaceRaised }]}>
      <Feather name="menu" size={22} color={color.text} />
    </Pressable>
  );
}

function Drawer({ onClose }: { onClose: () => void }) {
  const { signOut } = useAuth();
  const path = usePathname();
  const x = useRef(new Animated.Value(-W)).current;
  const [campaigns, setCampaigns] = useState<MyCampaign[]>([]);
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    Animated.timing(x, { toValue: 0, duration: 220, useNativeDriver: false }).start();
    fetchMyCampaigns().then((r) => setCampaigns(r.filter((c) => c.status === 'joined' && c.campaign && ['active', 'paused', 'ending'].includes(c.campaign.status)))).catch(() => {});
    unreadCount().then(setUnread).catch(() => {});
  }, [x]);
  const close = (then?: () => void) => Animated.timing(x, { toValue: -W, duration: 180, useNativeDriver: false }).start(() => { onClose(); then?.(); });
  const go = (to: string) => close(() => (to.startsWith('/dashboard') ? router.navigate(to as never) : router.push(to as never)));

  const item = (icon: Icon, label: string, to: string, badge?: number) => {
    const on = path === to || (to === '/dashboard' && path === '/dashboard/index');
    return (
      <Pressable key={to} onPress={() => go(to)} accessibilityRole="menuitem" accessibilityState={{ selected: on }}
        style={({ pressed }) => [styles.item, on && styles.itemOn, pressed && !on && { backgroundColor: 'rgba(255,255,255,0.04)' }]}>
        <Feather name={icon} size={20} color={on ? color.text : color.textSecondary} />
        <Text style={[styles.itemText, on && { color: color.text }]}>{label}</Text>
        {badge ? <View style={styles.badge}><Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text></View> : null}
      </Pressable>
    );
  };

  return (
    <Modal visible transparent animationType="none" onRequestClose={() => close()}>
      <Animated.View style={[styles.backdrop, { opacity: x.interpolate({ inputRange: [-W, 0], outputRange: [0, 1] }) }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => close()} accessibilityLabel="Tutup menu" />
      </Animated.View>
      <Animated.View style={[styles.panel, { transform: [{ translateX: x }] }]} accessibilityViewIsModal>
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
          <View style={styles.head}>
            <Pressable onPress={() => close()} hitSlop={8} accessibilityRole="button" accessibilityLabel="Tutup menu" style={styles.menuBtn}>
              <Feather name="menu" size={22} color={color.text} />
            </Pressable>
            <Image source={require('../../assets/tapp-logo.png')} style={styles.logo} accessibilityIgnoresInvertColors />
            <Text style={styles.brand}>TAPP</Text>
          </View>
          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            {item('home', 'Beranda', '/dashboard')}
            {item('compass', 'Campaign', '/dashboard/campaigns')}
            {item('repeat', 'Aktivitas', '/dashboard/activity')}
            {item('bar-chart-2', 'Performa', '/performance')}
            {item('credit-card', 'Saldo', '/dashboard/earnings')}
            {item('award', 'Leaderboard', '/leaderboard')}
            {item('gift', 'Ajak teman', '/referral')}

            <Pressable onPress={() => go('/help')} accessibilityRole="button" style={({ pressed }) => [styles.learn, pressed && { opacity: 0.85 }]}>
              <View style={styles.learnArt} {...({ dataSet: { tapp: 'art' } } as object)}>
                <Image source={require('../../assets/tapp-mark-white.png')} style={styles.learnMark} accessibilityIgnoresInvertColors />
              </View>
              <View style={{ padding: space.md, gap: 4 }}>
                <Text style={styles.learnTitle}>Mulai dari sini</Text>
                <Text style={styles.learnSub}>Cara kerja campaign dari ambil sampai cair.</Text>
              </View>
              <View style={styles.learnFoot}><Text style={styles.learnLink}>Pelajari</Text><Feather name="arrow-right" size={16} color={color.link} /></View>
            </Pressable>

            {campaigns.length ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Campaign diikuti</Text>
                {campaigns.slice(0, 5).map((c) => (
                  <Pressable key={c.id} onPress={() => go(`/workspace/${c.campaign!.id}`)} accessibilityRole="button" style={({ pressed }) => [styles.camp, pressed && { opacity: 0.7 }]}>
                    <View style={styles.mono}><Text style={styles.monoText}>{(c.campaign!.brand?.name ?? c.campaign!.title).slice(0, 1).toUpperCase()}</Text></View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.campTitle} numberOfLines={1}>{c.campaign!.title}</Text>
                      {c.campaign!.brand?.name ? <Text style={styles.campSub} numberOfLines={1}>{c.campaign!.brand.name}</Text> : null}
                    </View>
                  </Pressable>
                ))}
              </View>
            ) : null}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Butuh bantuan?</Text>
              <Pressable onPress={() => close(() => void Linking.openURL(WA))} accessibilityRole="link" style={({ pressed }) => [styles.item, pressed && { opacity: 0.7 }]}>
                <Feather name="message-circle" size={20} color={color.textSecondary} />
                <Text style={styles.itemText}>Hubungi admin</Text>
              </Pressable>
              {item('help-circle', 'FAQ & aturan', '/help')}
            </View>

            <View style={styles.section}>
              {item('user', 'Profil', '/dashboard/profile')}
              {item('bell', 'Notifikasi', '/notifications', unread)}
              <Pressable onPress={() => close(() => void signOut())} accessibilityRole="button" style={({ pressed }) => [styles.item, pressed && { opacity: 0.7 }]}>
                <Feather name="log-out" size={20} color={color.danger} />
                <Text style={[styles.itemText, { color: color.danger }]}>Keluar</Text>
              </Pressable>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  menuBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  panel: { position: 'absolute', left: 0, top: 0, bottom: 0, width: W, maxWidth: '86%', backgroundColor: '#08080B',
    borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.08)' },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, paddingVertical: space.md },
  logo: { width: 28, height: 28, marginLeft: space.xs },
  brand: { ...type.heading, fontSize: 20, color: color.text, letterSpacing: -0.4 },
  body: { paddingHorizontal: space.md, paddingBottom: space.xxl, gap: 2 },
  item: { flexDirection: 'row', alignItems: 'center', gap: space.md, height: 48, paddingHorizontal: space.md, borderRadius: radius.md },
  itemOn: { backgroundColor: 'rgba(12,101,196,0.16)', borderWidth: 1, borderColor: 'rgba(117,178,244,0.25)' },
  itemText: { ...type.body, fontSize: 16, color: color.textSecondary, flex: 1 },
  badge: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: color.blue, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  badgeText: { color: '#FFFFFF', fontSize: 11, fontFamily: type.label.fontFamily },
  learn: { marginTop: space.lg, borderRadius: radius.lg, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: '#111116', overflow: 'hidden' },
  learnArt: { height: 92, backgroundColor: color.blueDeep, alignItems: 'center', justifyContent: 'center' },
  learnMark: { width: 40, height: 40 },
  learnTitle: { ...type.label, fontSize: 15, color: color.text },
  learnSub: { ...type.caption, color: color.textSecondary },
  learnFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.md, paddingVertical: space.md,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' },
  learnLink: { ...type.label, color: color.link },
  section: { marginTop: space.lg, paddingTop: space.lg, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)', gap: 2 },
  sectionTitle: { ...type.label, fontSize: 15, color: color.text, paddingHorizontal: space.md, marginBottom: space.sm },
  camp: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.md, paddingVertical: space.sm },
  mono: { width: 34, height: 34, borderRadius: 17, backgroundColor: color.accentSoft, borderWidth: 1, borderColor: 'rgba(117,178,244,0.3)', alignItems: 'center', justifyContent: 'center' },
  monoText: { ...type.label, color: color.link },
  campTitle: { ...type.label, color: color.text },
  campSub: { ...type.caption, fontSize: 12, color: color.textMuted },
});
