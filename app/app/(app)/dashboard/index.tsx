import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { SkeletonBlock } from '@/components/Skeleton';
import Feather from '@expo/vector-icons/Feather';
import { compact, deadlineLabel, greeting, idr, idrCompact, isUrgent } from '@/lib/format';
import { useQuery } from '@/lib/useQuery';
import { useAuth } from '@/providers/AuthProvider';
import { PushToggle } from '@/components/PushToggle';
import { fetchTierProgress, type TierProgress } from '@/features/creator/tier';
import { color, gradient, radius, space, type, card } from '@/theme/tokens';
import { fetchHome, fetchMyCampaigns, type MyCampaign } from '@/features/campaigns/api';
import { fetchAvailable } from '@/features/campaigns/earnings';
import { fetchMySubmissions } from '@/features/submissions/api';
import { fetchDaily } from '@/features/performance/api';
import { fetchCityBoard, fetchWeeklyBoard, type CityRow, type CreatorRow } from '@/features/campaigns/leaderboard';
import { ActionCircle } from '@/components/ActionCircle';
import { Avatar } from '@/components/Avatar';
import { CAMPAIGN_STATUS } from '@/features/campaigns/copy';
import { MenuButton } from '@/components/SideMenu';
import { unreadCount } from '@/features/notifications/api';
import { web } from '@/theme/web';

const STATUS_NOTE: Record<string, string> = {
  verified: 'Akunmu sedang ditinjau. Kamu sudah bisa melihat campaign, dan bisa bergabung setelah disetujui.',
  suspended: 'Akunmu ditangguhkan. Kamu tidak bisa bergabung ke campaign atau submit konten.',
  banned: 'Akunmu ditutup.',
};
const LEVEL: Record<string, string> = { new: 'New', rising: 'Rising', verified: 'Verified', proven: 'Proven', elite: 'Elite' };
const DAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

// Home: balance and what to do with it, this week's results, campaigns in progress, then new campaigns.
export default function Home() {
  const { account } = useAuth();
  const q = useQuery(async () => {
    const [home, mine, unread, balance, subs, level, daily, board, cities] = await Promise.all([fetchHome(), fetchMyCampaigns(),
      unreadCount().catch(() => 0), fetchAvailable().catch(() => 0), fetchMySubmissions(undefined, 200).catch(() => []),
      fetchTierProgress().catch(() => null), fetchDaily(14).catch(() => []),
      fetchWeeklyBoard().catch(() => []), fetchCityBoard().catch(() => [])]);
    const last7 = daily.slice(-7), prev7 = daily.slice(-14, -7);
    const sum = (a: typeof daily, k: 'qualified_gain' | 'earned') => a.reduce((t, x) => t + x[k], 0);
    return {
      home, unread, balance, level,
      rank: { me: board.find((r) => r.is_me) ?? null, top: board[0] ?? null, city: cities.find((r) => r.is_mine) ?? null, topCity: cities[0] ?? null },
      week: { views: sum(last7, 'qualified_gain'), prev: sum(prev7, 'qualified_gain'), earned: sum(last7, 'earned'), days: last7 },
      accepted: subs.filter((s) => s.status === 'approved' || s.status === 'tracking' || s.status === 'completed').length,
      reviewing: subs.filter((s) => s.status === 'pending_review').length,
      active: mine.filter((m) => m.status === 'joined' && m.campaign && ['active', 'paused', 'ending'].includes(m.campaign.status)).slice(0, 6),
    };
  }, []);
  const first = account?.fullName?.split(' ')[0];
  const d = q.data;

  return (
    <Screen inTabs refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={q.refresh} tintColor={color.blue} />}>
      <View style={styles.top}>
        <MenuButton />
        <Pressable onPress={() => router.navigate('/dashboard/profile')} accessibilityRole="button" accessibilityLabel="Profil">
          <Avatar uri={account?.avatarUrl ?? null} name={account?.fullName ?? null} size={46} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.hello}>{greeting()}{first ? `, ${first}` : ''}</Text>
          <Text style={styles.name} accessibilityRole="header" numberOfLines={1}>{account?.fullName ?? 'Creator'}</Text>
        </View>
        <Pressable onPress={() => router.push('/notifications')} hitSlop={8} accessibilityRole="button"
          accessibilityLabel={d?.unread ? `Notifikasi, ${d.unread} belum dibaca` : 'Notifikasi'} style={styles.iconBtn}>
          <Feather name="bell" size={20} color={color.text} />
          {d?.unread ? <View style={styles.badge}><Text style={styles.badgeText}>{d.unread > 9 ? '9+' : d.unread}</Text></View> : null}
        </Pressable>
      </View>

      <Hero balance={d?.balance ?? null} level={d?.level ?? null} reviewing={d?.reviewing ?? 0} />

      <View style={styles.actions}>
        <ActionCircle icon="compass" label="Campaign" onPress={() => router.navigate('/dashboard/campaigns')} />
        <ActionCircle icon="bar-chart-2" label="Performa" onPress={() => router.push('/performance')} />
        <ActionCircle icon="gift" label="Ajak teman" onPress={() => router.push('/referral')} />
        <ActionCircle icon="help-circle" label="Bantuan" onPress={() => router.push('/help')} />
      </View>

      {account && STATUS_NOTE[account.status] ? <View style={styles.notice}><Notice tone="info" message={STATUS_NOTE[account.status]!} /></View> : null}
      {q.error && !d ? <View style={styles.notice}><Notice tone="error" message={`${q.error} Tarik ke bawah untuk memuat ulang.`} /></View> : null}

      <SectionHead title="7 hari terakhir" action={{ label: 'Detail', onPress: () => router.push('/performance') }} />
      {d ? <Week week={d.week} accepted={d.accepted} /> : <SkeletonBlock width="100%" height={168} />}

      {d ? <RankCard rank={d.rank} /> : null}

      {d && d.active.length ? (
        <>
          <SectionHead title="Lanjutkan" action={{ label: 'Semua', onPress: () => router.navigate('/dashboard/activity') }} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail} style={styles.railWrap}>
            {d.active.map((m) => <ActiveCard key={m.id} m={m} />)}
          </ScrollView>
        </>
      ) : null}

      {d ? <View style={styles.push}><PushToggle compact /></View> : null}
    </Screen>
  );
}

// Balance hero: amount, level and what's in review, the two things to do with it, progress to the next level.
function Hero({ balance, level, reviewing }: { balance: number | null; level: TierProgress | null; reviewing: number }) {
  const done = !level?.next || level.to == null;
  const ratio = !level ? 0 : done ? 1 : Math.min(1, Math.max(0.03, (level.views - level.from) / Math.max(1, level.to! - level.from)));
  return (
    <LinearGradient colors={gradient.card} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={styles.hero} {...({ dataSet: { tapp: 'balance' } } as object)}>
      <View style={styles.heroTop}>
        <Text style={styles.heroLabel}>Saldo bisa ditarik</Text>
        <Image source={require('../../../assets/tapp-mark-white.png')} style={styles.heroMark} accessibilityIgnoresInvertColors />
      </View>
      {balance == null ? <View style={styles.heroSkeleton} /> : (
        <Text style={styles.heroAmount} numberOfLines={1} adjustsFontSizeToFit>{idr(balance)}</Text>
      )}
      <View style={styles.chips}>
        {level ? <Text style={styles.chip}>Level {LEVEL[level.tier]}{level.bonusPct ? ` · +${level.bonusPct}%` : ''}</Text> : null}
        {reviewing ? <Text style={styles.chip}>{reviewing} klip direview</Text> : null}
      </View>
      <View style={styles.heroBtns}>
        <Pressable onPress={() => router.navigate('/dashboard/earnings')} style={({ pressed }) => [styles.heroBtn, styles.heroBtnSolid, pressed && { opacity: 0.85 }]} accessibilityRole="button">
          <Feather name="arrow-down-left" size={16} color="#0A2A4D" /><Text style={styles.heroBtnSolidText}>Tarik saldo</Text>
        </Pressable>
        <Pressable onPress={() => router.navigate('/dashboard/activity')} style={({ pressed }) => [styles.heroBtn, styles.heroBtnGlass, pressed && { opacity: 0.8 }]} accessibilityRole="button">
          <Feather name="film" size={16} color="#FFFFFF" /><Text style={styles.heroBtnGlassText}>Klip saya</Text>
        </Pressable>
      </View>
      {level ? (
        <View style={styles.heroLevel}>
          <View style={styles.heroTrack}><View style={[styles.heroFill, { width: `${ratio * 100}%` }]} /></View>
          <Text style={styles.heroLevelText} numberOfLines={1}>
            {done ? 'Level tertinggi' : `${compact(level.toNext ?? 0)} views lagi ke ${LEVEL[level.next!]} (+${level.nextBonusPct}%)`}
          </Text>
        </View>
      ) : null}
    </LinearGradient>
  );
}

// This week: qualified views with the change vs last week, a 7-day bar strip, earnings and accepted clips.
function Week({ week, accepted }: { week: { views: number; prev: number; earned: number; days: { day: string; qualified_gain: number }[] }; accepted: number }) {
  const max = Math.max(1, ...week.days.map((x) => x.qualified_gain));
  const change = week.prev > 0 ? Math.round(((week.views - week.prev) / week.prev) * 100) : null;
  return (
    <View style={styles.week}>
      <View style={styles.weekTop}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.weekBig}>+{compact(week.views)}</Text>
          <Text style={styles.weekLabel}>qualified views</Text>
        </View>
        {change != null ? (
          <View style={[styles.trend, change < 0 && styles.trendDown]}>
            <Feather name={change >= 0 ? 'trending-up' : 'trending-down'} size={13} color={change >= 0 ? color.success : color.danger} />
            <Text style={[styles.trendText, change < 0 && { color: color.danger }]}>{change >= 0 ? '+' : ''}{change}%</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.bars}>
        {week.days.map((x, i) => {
          const today = i === week.days.length - 1;
          return (
            <View key={x.day} style={styles.barCol}>
              <View style={styles.barTrack}>
                <View style={[styles.bar, { height: `${Math.max(6, (x.qualified_gain / max) * 100)}%` }, today && styles.barToday]} />
              </View>
              <Text style={[styles.barDay, today && { color: color.text }]}>{DAYS[new Date(`${x.day}T00:00:00`).getDay()]}</Text>
            </View>
          );
        })}
      </View>
      <View style={styles.weekFoot}>
        <View style={styles.weekStat}><Text style={styles.weekStatValue}>{idrCompact(week.earned)}</Text><Text style={styles.weekLabel}>penghasilan</Text></View>
        <View style={styles.weekDivider} />
        <View style={styles.weekStat}><Text style={styles.weekStatValue}>{accepted}</Text><Text style={styles.weekLabel}>klip diterima</Text></View>
      </View>
    </View>
  );
}

type Rank = { me: CreatorRow | null; top: CreatorRow | null; city: CityRow | null; topCity: CityRow | null };
// Weekly standing teaser → the full stage.
function RankCard({ rank }: { rank: Rank }) {
  const title = rank.me ? `Kamu #${rank.me.rank} minggu ini` : rank.top ? 'Siapa di panggung minggu ini?' : 'Panggung minggu ini masih kosong';
  const sub = rank.city ? `${rank.city.city} peringkat #${rank.city.rank} kota` : rank.topCity ? `Kota teratas: ${rank.topCity.city}` : 'Lihat peringkat minggu ini';
  return (
    <Pressable onPress={() => router.push('/leaderboard')} accessibilityRole="button" style={({ pressed }) => [styles.rankCard, pressed && { opacity: 0.88 }]}>
      <LinearGradient colors={['#2A1F05', '#141008']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={styles.rankIcon}><Feather name="award" size={22} color="#F5C451" /></View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.rankTitle}>{title}</Text>
        <Text style={styles.rankSub} numberOfLines={1}>{sub}</Text>
      </View>
      <Feather name="chevron-right" size={18} color="#F5C451" />
    </Pressable>
  );
}

function ActiveCard({ m }: { m: MyCampaign }) {
  const c = m.campaign!;
  const dl = deadlineLabel(c.submission_deadline);
  return (
    <Pressable onPress={() => router.push({ pathname: '/workspace/[id]', params: { id: c.id } })} accessibilityRole="button"
      style={({ pressed }) => [styles.active, pressed && { opacity: 0.85 }]}>
      <View style={styles.activeArt} {...web('art')}>
        <Text style={styles.activeBrand} numberOfLines={1}>{c.brand?.name ?? 'Campaign'}</Text>
        {dl ? <Text style={[styles.activeDl, isUrgent(c.submission_deadline) && { color: color.warning }]}>{dl}</Text> : null}
      </View>
      <View style={styles.activeBody}>
        <Text style={styles.activeTitle} numberOfLines={2}>{c.title}</Text>
        <Text style={styles.activeMeta}>{c.status !== 'active' ? CAMPAIGN_STATUS[c.status as keyof typeof CAMPAIGN_STATUS] : `${idr(c.cpm)} / 1.000 views`}</Text>
        <View style={styles.activeCta}><Text style={styles.activeCtaText}>Buka workspace</Text><Feather name="arrow-right" size={14} color={color.link} /></View>
      </View>
    </Pressable>
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
  top: { flexDirection: 'row', alignItems: 'center', marginTop: space.md, gap: space.md },
  hello: { ...type.caption, color: color.textMuted },
  name: { ...type.heading, fontSize: 20, lineHeight: 26, color: color.text },
  iconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: color.surface, borderWidth: 1, borderColor: color.border, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: color.blue, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeText: { color: color.onAccent, fontSize: 11, fontFamily: type.label.fontFamily, fontVariant: ['tabular-nums'] },
  notice: { marginTop: space.lg },

  hero: { marginTop: space.xl, borderRadius: radius.xl, padding: space.xl, gap: space.md, overflow: 'hidden' },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroLabel: { ...type.caption, color: 'rgba(255,255,255,0.82)' },
  heroMark: { width: 26, height: 26 },
  heroAmount: { ...type.display, fontSize: 40, lineHeight: 46, color: '#FFFFFF', fontVariant: ['tabular-nums'] },
  heroSkeleton: { height: 46, width: '60%', borderRadius: radius.sm, backgroundColor: 'rgba(255,255,255,0.12)' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: { ...type.caption, color: '#FFFFFF', backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, overflow: 'hidden' },
  heroBtns: { flexDirection: 'row', gap: space.sm, marginTop: space.xs },
  heroBtn: { flex: 1, height: 46, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  heroBtnSolid: { backgroundColor: '#FFFFFF' },
  heroBtnSolidText: { ...type.label, color: '#0A2A4D' },
  heroBtnGlass: { backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' },
  heroBtnGlassText: { ...type.label, color: '#FFFFFF' },
  heroLevel: { gap: 6, marginTop: space.xs },
  heroTrack: { height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.18)', overflow: 'hidden' },
  heroFill: { height: 5, borderRadius: 3, backgroundColor: '#FFFFFF' },
  heroLevelText: { ...type.caption, fontSize: 12, color: 'rgba(255,255,255,0.78)' },

  actions: { flexDirection: 'row', marginTop: space.xl },

  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: space.xxl, marginBottom: space.md },
  sectionTitle: { ...type.heading, color: color.text },
  link: { ...type.label, color: color.link, fontSize: 14 },

  week: { ...card, borderRadius: radius.lg, padding: space.lg, gap: space.lg },
  weekTop: { flexDirection: 'row', alignItems: 'flex-start' },
  weekBig: { ...type.display, fontSize: 30, lineHeight: 34, color: color.text, fontVariant: ['tabular-nums'] },
  weekLabel: { ...type.caption, color: color.textMuted },
  trend: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: color.successSoft },
  trendDown: { backgroundColor: color.dangerSoft },
  trendText: { ...type.caption, color: color.success, fontVariant: ['tabular-nums'] },
  bars: { flexDirection: 'row', gap: 8, height: 92 },
  barCol: { flex: 1, alignItems: 'center', gap: 6 },
  barTrack: { flex: 1, width: '100%', justifyContent: 'flex-end', borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.04)', overflow: 'hidden' },
  bar: { width: '100%', borderRadius: 6, backgroundColor: 'rgba(117,178,244,0.45)' },
  barToday: { backgroundColor: color.blueLight },
  barDay: { ...type.caption, fontSize: 11, color: color.textMuted },
  weekFoot: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: color.border, paddingTop: space.md },
  weekStat: { flex: 1, gap: 2 },
  weekStatValue: { ...type.heading, color: color.text, fontVariant: ['tabular-nums'] },
  weekDivider: { width: 1, height: 32, backgroundColor: color.border, marginHorizontal: space.lg },

  railWrap: { marginHorizontal: -space.xl },
  rail: { paddingHorizontal: space.xl, gap: space.md, alignItems: 'flex-start' },
  recItem: { width: 280 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  gridItem: { flexBasis: '48%', flexGrow: 1 },

  active: { width: 220, ...card, borderRadius: radius.lg, overflow: 'hidden' },
  activeArt: { height: 84, padding: space.md, justifyContent: 'space-between', backgroundColor: color.blueDeep },
  activeBrand: { ...type.label, color: '#FFFFFF', fontSize: 13 },
  activeDl: { ...type.caption, fontSize: 12, color: 'rgba(255,255,255,0.85)', alignSelf: 'flex-start', backgroundColor: 'rgba(0,0,0,0.28)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, overflow: 'hidden' },
  activeBody: { padding: space.md, gap: 4 },
  activeTitle: { ...type.label, color: color.text, minHeight: 40 },
  activeMeta: { ...type.caption, color: color.success, fontVariant: ['tabular-nums'] },
  activeCta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: space.xs },
  activeCtaText: { ...type.caption, color: color.link, fontFamily: type.label.fontFamily },

  info: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.lg, ...card },
  infoIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: color.accentSoft, alignItems: 'center', justifyContent: 'center' },
  infoTitle: { ...type.label, color: color.text },
  infoBody: { ...type.caption, color: color.textSecondary, lineHeight: 18 },

  push: { marginTop: space.xxl },
  rankCard: { marginTop: space.lg, flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.lg, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(245,196,81,0.28)' },
  rankIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(245,196,81,0.14)', alignItems: 'center', justifyContent: 'center' },
  rankTitle: { ...type.label, color: '#FFF4D6' },
  rankSub: { ...type.caption, color: 'rgba(255,236,190,0.7)' },
});
