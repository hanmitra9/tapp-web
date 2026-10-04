import Feather from '@expo/vector-icons/Feather';
import type React from 'react';
import { useEffect } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { EmptyState } from '@/components/EmptyState';
import { Header } from '@/components/Header';
import { PushToggle } from '@/components/PushToggle';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { SkeletonBlock } from '@/components/Skeleton';
import { useQuery } from '@/lib/useQuery';
import { color, space, type, card, radius } from '@/theme/tokens';
import { fetchNotifications, markAllRead, type AppNotification } from '@/features/notifications/api';
import { openNotification } from '@/features/notifications/route';

const when = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'Baru saja';
  if (m < 60) return `${m} mnt lalu`;
  if (m < 1440) return `${Math.round(m / 60)} jam lalu`;
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
};

export default function Notifications() {
  const q = useQuery(() => fetchNotifications(), []);
  // Opening the inbox marks everything read; unread styling stays for this visit.
  useEffect(() => { if (q.data?.some((n) => !n.read_at)) markAllRead().catch(() => {}); }, [q.data]);

  return (
    <Screen refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={q.refresh} tintColor={color.blue} />}>
      <Header title="Notifikasi" />
      <View style={{ marginBottom: space.lg }}><PushToggle /></View>
      {q.error && !q.data ? <Notice tone="error" message={q.error} /> : null}
      {!q.data && !q.error ? [0, 1, 2].map((i) => <View key={i} style={styles.row}><SkeletonBlock width="60%" height={16} /><SkeletonBlock width="90%" height={14} /></View>) : null}
      {q.data && !q.data.length ? <EmptyState title="Belum ada notifikasi" body="Kabar soal submission dan pembayaran akan muncul di sini." /> : null}
      {q.data?.map((n) => <Row key={n.id} n={n} />)}
    </Screen>
  );
}

type Look = { icon: React.ComponentProps<typeof Feather>['name']; fg: string; bg: string };
const LOOK: Record<string, Look> = {
  earnings_update: { icon: 'dollar-sign', fg: color.success, bg: color.successSoft },
  payout_update: { icon: 'send', fg: color.success, bg: color.successSoft },
  submission_approved: { icon: 'check', fg: color.link, bg: color.accentSoft },
  submission_rejected: { icon: 'x', fg: color.danger, bg: color.dangerSoft },
  submission_needs_changes: { icon: 'edit-3', fg: color.warning, bg: color.warningSoft },
  campaign_deadline: { icon: 'clock', fg: color.warning, bg: color.warningSoft },
  referral: { icon: 'gift', fg: '#F5C451', bg: 'rgba(245,196,81,0.14)' },
  performance_milestone: { icon: 'trending-up', fg: color.link, bg: color.accentSoft },
};
const DEFAULT_LOOK: Look = { icon: 'bell', fg: color.link, bg: color.accentSoft };

function Row({ n }: { n: AppNotification }) {
  const look = LOOK[n.type] ?? DEFAULT_LOOK;
  return (
    <Pressable onPress={() => openNotification({ ...n.data, type: n.type })} accessibilityRole="button"
      style={({ pressed }) => [styles.row, !n.read_at && styles.rowUnread, pressed && { opacity: 0.7 }]}>
      <View style={[styles.icon, { backgroundColor: look.bg }]}><Feather name={look.icon} size={17} color={look.fg} /></View>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={styles.head}>
          <Text style={[styles.title, !n.read_at && styles.unread]} numberOfLines={1}>{n.title}</Text>
          <Text style={styles.time}>{when(n.created_at)}</Text>
        </View>
        <Text style={styles.body} numberOfLines={3}>{n.body}</Text>
      </View>
      {!n.read_at ? <View style={styles.dot} accessibilityLabel="Belum dibaca" /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { ...card, flexDirection: 'row', alignItems: 'flex-start', padding: space.lg, gap: space.md, borderRadius: radius.lg, marginBottom: space.sm },
  rowUnread: { borderColor: 'rgba(117,178,244,0.28)' },
  icon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: color.blueLight, marginTop: 6 },
  title: { ...type.label, color: color.text, flex: 1 },
  unread: { color: color.text, fontFamily: type.heading.fontFamily },
  time: { ...type.caption, color: color.textMuted },
  body: { ...type.caption, color: color.textSecondary, lineHeight: 19 },
});
