import Feather from '@expo/vector-icons/Feather';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { unreadCount } from '@/features/notifications/api';
import { color, radius, space, type } from '@/theme/tokens';
import { MenuButton } from './SideMenu';
import { useLayout } from '@/lib/useLayout';

// Tab screen header (konten-style): menu, title, "Ajak & cuan" pill, bell with unread dot.
// `back`: pages outside the tabs also get a back arrow on desktop (no side menu there).
export function TopBar({ title, back = false }: { title: string; back?: boolean }) {
  const { isWide } = useLayout();
  const [unread, setUnread] = useState(0);
  useFocusEffect(useCallback(() => { unreadCount().then(setUnread).catch(() => {}); }, []));
  return (
    <View style={styles.top}>
      {back && isWide ? (
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/dashboard'))} hitSlop={8} accessibilityRole="button" accessibilityLabel="Kembali" style={styles.iconBtn}>
          <Feather name="chevron-left" size={22} color={color.text} />
        </Pressable>
      ) : <MenuButton />}
      <Text style={styles.title} accessibilityRole="header" numberOfLines={1}>{title}</Text>
      <Pressable onPress={() => router.push('/referral')} accessibilityRole="button" style={({ pressed }) => [styles.invite, pressed && { opacity: 0.8 }]}>
        <Feather name="gift" size={14} color="#F5C451" />
        <Text style={styles.inviteText}>AJAK & CUAN</Text>
      </Pressable>
      <Pressable onPress={() => router.push('/notifications')} hitSlop={8} accessibilityRole="button"
        accessibilityLabel={unread ? `Notifikasi, ${unread} belum dibaca` : 'Notifikasi'} style={styles.iconBtn}>
        <Feather name="bell" size={19} color={color.text} />
        {unread ? <View style={styles.dot} /> : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  title: { ...type.heading, fontSize: 22, lineHeight: 28, color: color.text, flex: 1 },
  invite: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 34, borderRadius: radius.pill,
    borderWidth: 1, borderColor: 'rgba(245,196,81,0.45)', backgroundColor: 'rgba(245,196,81,0.10)' },
  inviteText: { ...type.label, fontSize: 12, letterSpacing: 0.6, color: '#F5C451' },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: color.surfaceRaised },
  dot: { position: 'absolute', top: 9, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: color.blueLight },
});
