import { router } from 'expo-router';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { EmptyState } from '@/components/EmptyState';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { CardSkeleton } from '@/components/Skeleton';
import Feather from '@expo/vector-icons/Feather';
import { deadlineLabel, greeting, idr } from '@/lib/format';
import { useQuery } from '@/lib/useQuery';
import { useAuth } from '@/providers/AuthProvider';
import { LevelProgress } from '@/components/LevelProgress';
import { PushToggle } from '@/components/PushToggle';
import { fetchTierProgress } from '@/features/creator/tier';
import { color, radius, space, type, card } from '@/theme/tokens';
import { EMPTY_FILTERS, fetchFeed, fetchHome, fetchMyCampaigns } from '@/features/campaigns/api';
import { CampaignCard } from '@/features/campaigns/CampaignCard';
import { fetchAvailable } from '@/features/campaigns/earnings';
import { fetchMySubmissions } from '@/features/submissions/api';
import { ActionCircle } from '@/components/ActionCircle';
import { Avatar } from '@/components/Avatar';
import { BalanceCard, cardFootText } from '@/components/BalanceCard';
import { CAMPAIGN_STATUS } from '@/features/campaigns/copy';
import { unreadCount } from '@/features/notifications/api';

const STATUS_NOTE: Record<string, string> = {
  verified: 'Akunmu sedang ditinjau. Kamu sudah bisa melihat campaign, dan bisa bergabung setelah disetujui.',
  suspended: 'Akunmu ditangguhkan. Kamu tidak bisa bergabung ke campaign atau submit konten.',
  banned: 'Akunmu ditutup.',
};

// Answers, in order: what can I join, what am I working on, how am I performing, how much have I earned.
export default function Home() {
  const { account, session } = useAuth();
  const q = useQuery(async () => {
    const [home, recs, mine, unread, balance, subs, level] = await Promise.all([fetchHome(), fetchFeed('recommended', EMPTY_FILTERS), fetchMyCampaigns(),
      unreadCount().catch(() => 0), fetchAvailable().catch(() => 0), fetchMySubmissions(undefined, 200).catch(() => []), fetchTierProgress().catch(() => null)]);
    return {
      home, unread, balance, level,
      accepted: subs.filter((s) => s.status === 'approved' || s.status === 'tracking').length,
      reviewing: subs.filter((s) => s.status === 'pending_review').length,
      recs: recs.filter((r) => !r.joined).slice(0, 3),
      joinedAll: recs.length > 0 && recs.every((r) => r.joined),
      active: mine.filter((m) => m.status === 'joined' && m.campaign && ['active', 'paused', 'ending'].includes(m.campaign.status)).slice(0, 3),
    };
  }, []);
  const first = account?.fullName?.split(' ')[0];
  const d = q.data;

  return (
    <Screen inTabs refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={q.refresh} tintColor={color.blue} />}>
      <View style={styles.top}>
        <View style={{ flex: 1 }}>
          <Text style={styles.hello}>{greeting()}{first ? `, ${first}` : ''}</Text>
          <Text style={styles.name} accessibilityRole="header" numberOfLines={1}>{account?.fullName ?? 'Creator'}</Text>
        </View>
        <View style={styles.topIcons}>
          <Pressable onPress={() => router.push('/notifications')} hitSlop={8} accessibilityRole="button"
            accessibilityLabel={d?.unread ? `Notifikasi, ${d.unread} belum dibaca` : 'Notifikasi'} style={styles.iconBtn}>
            <Feather name="bell" size={20} color={color.text} />
            {d?.unread ? <View style={styles.badge}><Text style={styles.badgeText}>{d.unread > 9 ? '9+' : d.unread}</Text></View> : null}
          </Pressable>
          <Pressable onPress={() => router.navigate('/dashboard/profile')} accessibilityRole="button" accessibilityLabel="Profil">
            <Avatar uri={account?.avatarUrl ?? null} name={account?.fullName ?? null} size={44} />
          </Pressable>
        </View>
      </View>

      <View style={styles.cardWrap}>
        <BalanceCard label="Saldo kamu" amount={d ? idr(d.balance) : null}
          footLeft={<Text style={cardFootText}>{d ? (d.accepted ? `${d.accepted} klip menunggu masuk saldo` : `${d.reviewing} klip sedang direview`) : ' '}</Text>}
          footRight={<Text style={cardFootText}>TAPP Creators</Text>} />
      </View>

      <View style={styles.actions}>
        <ActionCircle icon="compass" label="Campaign" onPress={() => router.navigate('/dashboard/campaigns')} />
        <ActionCircle icon="bar-chart-2" label="Performa" onPress={() => router.push('/performance')} />
        <ActionCircle icon="credit-card" label="Saldo" onPress={() => router.navigate('/dashboard/earnings')} />
        <ActionCircle icon="grid" label="Lainnya" onPress={() => router.push('/help')} />
      </View>

      {account && STATUS_NOTE[account.status] ? <View style={styles.notice}><Notice tone="info" message={STATUS_NOTE[account.status]!} /></View> : null}
      {q.error && !d ? <View style={styles.notice}><Notice tone="error" message={`${q.error} Tarik ke bawah untuk memuat ulang.`} /></View> : null}

      {d ? (
        <View style={styles.pills}>
          <Pressable style={styles.pill} onPress={() => router.navigate('/dashboard/campaigns')}>
            <Text style={styles.pillValue}>{d.home.available >= 50 ? '50+' : d.home.available}</Text><Text style={styles.pillLabel}>campaign tersedia</Text>
          </Pressable>
          <Pressable style={styles.pill} onPress={() => router.navigate('/dashboard/activity')}>
            <Text style={styles.pillValue}>{d.home.active}</Text><Text style={styles.pillLabel}>campaign aktif</Text>
          </Pressable>
        </View>
      ) : null}
      {d?.level ? <Pressable style={styles.level} onPress={() => router.navigate('/dashboard/earnings')} accessibilityRole="button"><LevelProgress p={d.level} /></Pressable> : null}
      {d ? <View style={styles.level}><PushToggle compact /></View> : null}

      <SectionHead title="Rekomendasi untukmu" action={{ label: 'Lihat semua', onPress: () => router.navigate('/dashboard/campaigns') }} />
      {!d ? <><CardSkeleton /><CardSkeleton /></> : d.recs.length ? d.recs.map((c) => (
        <View key={c.id} style={{ marginBottom: space.md }}><CampaignCard item={c} onPress={() => router.push({ pathname: '/campaign/[id]', params: { id: c.id } })} /></View>
      )) : (
d.joinedAll ? (
        <EmptyState title="Kamu sudah ikut semua campaign yang cocok" body="Campaign baru akan muncul di sini. Sementara itu, lanjutkan klip di campaign yang sedang kamu kerjakan."
          action={{ label: 'Lihat aktivitas', onPress: () => router.navigate('/dashboard/activity') }} />
      ) : (
        <EmptyState title="Belum ada campaign yang cocok" body="Campaign hanya muncul untuk platform yang sudah kamu hubungkan. Tambah akun lain untuk melihat lebih banyak."
          action={{ label: 'Kelola akun sosial', onPress: () => router.push('/profile/socials') }} />
      )
      )}

      {d && d.active.length ? (
        <>
          <SectionHead title="Sedang kamu kerjakan" action={{ label: 'Semua', onPress: () => router.navigate('/dashboard/activity') }} />
          {d.active.map((m) => (
            <Pressable key={m.id} style={({ pressed }) => [styles.activeRow, pressed && { opacity: 0.6 }]} accessibilityRole="button"
              onPress={() => router.push({ pathname: '/workspace/[id]', params: { id: m.campaign!.id } })}>
              <View style={styles.mono}><Feather name="play" size={16} color={color.blueLight} /></View>
              <View style={styles.activeText}>
                <Text style={styles.activeTitle} numberOfLines={1}>{m.campaign!.title}</Text>
                <Text style={styles.activeMeta}>
                  {m.campaign!.brand?.name ?? ''}{m.campaign!.status !== 'active' ? ` · ${CAMPAIGN_STATUS[m.campaign!.status]}` : ''}
                  {deadlineLabel(m.campaign!.submission_deadline) ? ` · ${deadlineLabel(m.campaign!.submission_deadline)}` : ''}
                </Text>
              </View>
              <Feather name="chevron-right" size={18} color={color.textMuted} />
            </Pressable>
          ))}
        </>
      ) : null}
    </Screen>
  );
}

function SectionHead({ title, action }: { title: string; action?: { label: string; onPress: () => void } }) {
  return (
    <View style={styles.sectionHead}>
      <Text style={styles.sectionTitle} accessibilityRole="header">{title}</Text>
      {action ? <Pressable onPress={action.onPress} hitSlop={10}><Text style={styles.link}>{action.label}</Text></Pressable> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginTop: space.md, gap: space.md },
  hello: { ...type.caption, color: color.textMuted, marginBottom: space.md },
  name: { ...type.title, color: color.text },
  topIcons: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  iconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: color.surface, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: color.blue, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeText: { color: color.onAccent, fontSize: 11, fontFamily: type.label.fontFamily, fontVariant: ['tabular-nums'] },
  notice: { marginTop: space.lg },
  cardWrap: { marginTop: space.xl },
  actions: { flexDirection: 'row', marginTop: space.xl },
  level: { marginTop: space.sm },
  pills: { flexDirection: 'row', gap: space.sm, marginTop: space.xl },
  pill: { flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: 6, ...card, borderRadius: radius.md, paddingVertical: space.md, paddingHorizontal: space.lg },
  pillValue: { ...type.heading, color: color.text, fontVariant: ['tabular-nums'] },
  pillLabel: { ...type.caption, color: color.textMuted },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: space.xxl, marginBottom: space.md },
  sectionTitle: { ...type.heading, color: color.text },
  link: { ...type.label, color: color.link },
  activeRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  mono: { width: 44, height: 44, borderRadius: 22, backgroundColor: color.surface, alignItems: 'center', justifyContent: 'center' },
  activeText: { gap: 2, flex: 1 },
  activeTitle: { ...type.heading, color: color.text },
  activeMeta: { ...type.caption, color: color.textMuted },
});
