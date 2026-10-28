import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Image, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { SkeletonBlock } from '@/components/Skeleton';
import Feather from '@expo/vector-icons/Feather';
import { compact, idr, pickGreeting } from '@/lib/format';
import { useQuery } from '@/lib/useQuery';
import { useAuth } from '@/providers/AuthProvider';
import { PushToggle } from '@/components/PushToggle';
import { fetchTierProgress, type TierProgress } from '@/features/creator/tier';
import { color, gradient, radius, space, type, card } from '@/theme/tokens';
import { EMPTY_FILTERS, fetchFeed, fetchMyCampaigns, type FeedItem, type MyCampaign, type Sort } from '@/features/campaigns/api';
import { CampaignCard } from '@/features/campaigns/CampaignCard';
import { Dropdown } from '@/components/Dropdown';
import { FEED_SORTS, FILTER_CATEGORIES, FILTER_TYPES } from '@/features/campaigns/copy';
import { SubmissionRow } from '@/features/submissions/SubmissionRow';
import type { MySubmission } from '@/features/submissions/api';
import { useLayout } from '@/lib/useLayout';
import { fetchAvailable } from '@/features/campaigns/earnings';
import { fetchMySubmissions } from '@/features/submissions/api';
import { Avatar } from '@/components/Avatar';
import { MenuButton } from '@/components/SideMenu';
import { unreadCount } from '@/features/notifications/api';
import { CommunityModal } from '@/features/community/CommunityModal';

const STATUS_NOTE: Record<string, string> = {
  verified: 'Akun sedang ditinjau (maks. 1x24 jam).',
  suspended: 'Akun ditangguhkan. Hubungi admin.',
  banned: 'Akunmu ditutup.',
};
const LEVEL: Record<string, string> = { new: 'New', rising: 'Rising', verified: 'Verified', proven: 'Proven', elite: 'Elite' };
const PENDING = ['pending_review', 'needs_changes', 'flagged'];
const DONE = ['approved', 'tracking', 'completed'];
const CATEGORIES = FILTER_CATEGORIES, TYPES = FILTER_TYPES, SORTS = FEED_SORTS;

// Home: balance and what to do with it, this week's results, campaigns in progress, then new campaigns.
export default function Home() {
  const { account } = useAuth();
  const q = useQuery(async () => {
    const [mine, unread, balance, subs, level] = await Promise.all([fetchMyCampaigns().catch(() => [] as MyCampaign[]),
      unreadCount().catch(() => 0), fetchAvailable().catch(() => 0), fetchMySubmissions(undefined, 200).catch(() => []),
      fetchTierProgress().catch(() => null)]);
    return {
      unread, balance, level, subs,
      reviewing: subs.filter((s) => s.status === 'pending_review').length,
      campaigns: mine.filter((m) => m.status === 'joined' && m.campaign).map((m) => ({ value: m.campaign!.id, label: m.campaign!.title })),
    };
  }, []);
  const [hello] = useState(() => pickGreeting());   // a new greeting each time the app is opened
  const d = q.data;

  return (
    <Screen inTabs refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={q.refresh} tintColor={color.blue} />}>
      <CommunityModal />
      <View style={styles.top}>
        <MenuButton />
        <Pressable onPress={() => router.navigate('/dashboard/profile')} accessibilityRole="button" accessibilityLabel="Profil">
          <Avatar uri={account?.avatarUrl ?? null} name={account?.fullName ?? null} size={46} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.hello}>{hello}</Text>
          <Text style={styles.name} accessibilityRole="header" numberOfLines={1}>{account?.fullName ?? 'Creator'}</Text>
        </View>
        <Pressable onPress={() => router.push('/notifications')} hitSlop={8} accessibilityRole="button"
          accessibilityLabel={d?.unread ? `Notifikasi, ${d.unread} belum dibaca` : 'Notifikasi'} style={styles.iconBtn}>
          <Feather name="bell" size={20} color={color.text} />
          {d?.unread ? <View style={styles.badge}><Text style={styles.badgeText}>{d.unread > 9 ? '9+' : d.unread}</Text></View> : null}
        </Pressable>
      </View>

      <Hero balance={d?.balance ?? null} level={d?.level ?? null} reviewing={d?.reviewing ?? 0} />

      <View style={styles.stats}>
        <Stat icon="eye" tint={color.link} label="Views" value={d?.level ? compact(d.level.views) : null} onPress={() => router.push('/performance')} />
        <Stat icon="check-circle" tint={color.success} label="Diterima" value={d ? String(d.subs.filter((s) => DONE.includes(s.status)).length) : null} onPress={() => router.navigate('/dashboard/activity')} />
        <Stat icon="zap" tint="#F5C451" label="Campaign" value={d ? String(d.campaigns.length) : null} onPress={() => router.navigate('/dashboard/campaigns')} />
      </View>
      <Pressable onPress={() => router.push('/referral')} accessibilityRole="button" style={({ pressed }) => [styles.invite, pressed && { opacity: 0.85 }]}>
        <View style={styles.inviteIcon}><Feather name="gift" size={16} color="#F5C451" /></View>
        <Text style={styles.inviteText} numberOfLines={1}>Ajak teman, dapat bonus</Text>
        <Feather name="chevron-right" size={18} color={color.textMuted} />
      </Pressable>

      {account && STATUS_NOTE[account.status] ? <View style={styles.notice}><Notice tone="info" message={STATUS_NOTE[account.status]!} /></View> : null}
      {q.error && !d ? <View style={styles.notice}><Notice tone="error" message={`${q.error} Tarik ke bawah untuk memuat ulang.`} /></View> : null}

      <Videos subs={d?.subs ?? null} campaigns={d?.campaigns ?? []} />

      <AllCampaigns />

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
        <Pressable onPress={() => router.push('/rank')} accessibilityRole="button" accessibilityLabel="Rank & Rewards" style={styles.heroLevel}>
          <View style={styles.heroTrack}><View style={[styles.heroFill, { width: `${ratio * 100}%` }]} /></View>
          <Text style={styles.heroLevelText} numberOfLines={1}>
            {done ? 'Level tertinggi' : `${compact(level.toNext ?? 0)} views lagi ke ${LEVEL[level.next!]} ${level.nextBonusPct ? ` (+${level.nextBonusPct}%)` : ''}`}
          </Text>
        </Pressable>
      ) : null}
    </LinearGradient>
  );
}


// One tappable number under the hero: lifetime qualified views, accepted clips, campaigns joined.
function Stat({ icon, tint, label, value, onPress }: { icon: 'eye' | 'check-circle' | 'zap'; tint: string; label: string; value: string | null; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label} ${value ?? ''}`} style={({ pressed }) => [styles.stat, pressed && { opacity: 0.8 }]}>
      <View style={styles.statHead}><Feather name={icon} size={13} color={tint} /><Text style={styles.statLabel} numberOfLines={1}>{label}</Text></View>
      {value == null ? <SkeletonBlock width="50%" height={22} /> : <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>}
    </Pressable>
  );
}

// "Video kamu": every clip with a status tab, campaign filter and sort, plus when views refresh next.
function Videos({ subs, campaigns }: { subs: MySubmission[] | null; campaigns: { value: string; label: string }[] }) {
  const [tab, setTab] = useState<'all' | 'pending' | 'done'>('all');
  const [camp, setCamp] = useState('');
  const [sort, setSort] = useState('newest');
  const list = (subs ?? [])
    .filter((s) => (tab === 'all' ? true : tab === 'pending' ? PENDING.includes(s.status) : DONE.includes(s.status)))
    .filter((s) => !camp || s.campaign_id === camp)
    .sort((a, b) => (sort === 'views' ? (b.raw_views ?? b.qualified_views) - (a.raw_views ?? a.qualified_views)
      : sort === 'earned' ? b.earned - a.earned : b.created_at.localeCompare(a.created_at)));
  return (
    <View style={styles.videos}>
      <Text style={styles.cardTitle} accessibilityRole="header">Video kamu</Text>
      <Countdown />
      <View style={styles.tabs}>
        {([['all', 'Semua'], ['pending', 'Pending'], ['done', 'Diterima']] as const).map(([k, label]) => (
          <Pressable key={k} onPress={() => setTab(k)} accessibilityRole="tab" accessibilityState={{ selected: tab === k }} style={[styles.tab, tab === k && styles.tabOn]}>
            <Text style={[styles.tabText, tab === k && styles.tabTextOn]}>{label}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.filters}>
        <View style={{ flex: 1.3 }}><Dropdown label="Semua campaign" value={camp} options={[{ value: '', label: 'Semua campaign' }, ...campaigns]} onChange={setCamp} /></View>
        <View style={{ flex: 1 }}><Dropdown label="Urutkan" icon="sliders" value={sort} onChange={setSort}
          options={[{ value: 'newest', label: 'Terbaru' }, { value: 'views', label: 'Views terbanyak' }, { value: 'earned', label: 'Penghasilan' }]} /></View>
      </View>
      {subs == null ? <SkeletonBlock width="100%" height={96} /> : list.length ? (
        <>
          {list.slice(0, 5).map((s) => (
            <SubmissionRow key={s.id} s={s} showCampaign onPress={() => router.push({ pathname: '/workspace/[id]', params: { id: s.campaign_id } })} />
          ))}
          {list.length > 5 ? (
            <Pressable onPress={() => router.navigate('/dashboard/activity')} accessibilityRole="button" style={styles.more}>
              <Text style={styles.link}>Lihat semua ({list.length})</Text><Feather name="chevron-right" size={16} color={color.link} />
            </Pressable>
          ) : null}
        </>
      ) : (
        <View style={styles.empty}><Text style={styles.emptyText}>{subs.length ? 'Belum ada video di filter ini.' : 'Belum ada video.'}</Text></View>
      )}
    </View>
  );
}

// Views are re-fetched every 3 hours (fetch-metrics-sweep, 0 */3 UTC).
function Countdown() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const step = 3 * 3600e3;
  const left = Math.ceil(now / step) * step - now;
  const pad = (n: number) => String(Math.floor(n)).padStart(2, '0');
  return (
    <View style={styles.refresh}>
      <Feather name="refresh-cw" size={16} color="#F5C451" />
      <Text style={styles.refreshText}>Update views dalam <Text style={styles.refreshTime}>{pad(left / 3600e3)}:{pad((left % 3600e3) / 60e3)}:{pad((left % 60e3) / 1e3)}</Text></Text>
    </View>
  );
}

// "Semua campaign aktif": sort, category and type filters over the live feed.
function AllCampaigns() {
  const { isWide } = useLayout();
  const [sort, setSort] = useState<Sort>('recommended');
  const [cat, setCat] = useState('');
  const [kind, setKind] = useState('');
  const [items, setItems] = useState<FeedItem[] | null>(null);
  useEffect(() => {
    let live = true;
    setItems(null);
    fetchFeed(sort, { ...EMPTY_FILTERS, categories: cat ? [cat] : [], contentTypes: kind ? [kind] : [] })
      .then((r) => live && setItems(r)).catch(() => live && setItems([]));
    return () => { live = false; };
  }, [sort, cat, kind]);
  return (
    <>
      <SectionHead title="Semua campaign aktif" action={{ label: 'Semua', onPress: () => router.navigate('/dashboard/campaigns') }} />
      <View style={styles.filters}>
        <View style={{ flex: 1 }}><Dropdown label="Urutkan" icon="sliders" value={sort} options={SORTS} onChange={(v) => setSort(v as Sort)} /></View>
        <View style={{ flex: 1 }}><Dropdown label="Kategori" value={cat} options={CATEGORIES} onChange={setCat} /></View>
        <View style={{ flex: 1 }}><Dropdown label="Tipe" value={kind} options={TYPES} onChange={setKind} /></View>
      </View>
      <View style={[styles.grid, { marginTop: space.md }]}>
        {items == null ? <SkeletonBlock width="100%" height={260} /> : items.length ? items.slice(0, 6).map((c) => (
          <View key={c.id} style={isWide ? styles.gridItem : { width: '100%' }}>
            <CampaignCard item={c} onPress={() => router.push({ pathname: '/campaign/[id]', params: { id: c.id } })} />
          </View>
        )) : <View style={[styles.empty, { width: '100%' }]}><Text style={styles.emptyText}>Belum ada campaign di filter ini.</Text></View>}
      </View>
    </>
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

  stats: { flexDirection: 'row', gap: space.sm, marginTop: space.lg },
  stat: { flex: 1, ...card, borderRadius: radius.lg, paddingVertical: space.md, paddingHorizontal: space.md, gap: 6 },
  statHead: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statLabel: { ...type.caption, fontSize: 12, color: color.textMuted, flexShrink: 1 },
  statValue: { ...type.metric, fontSize: 22, lineHeight: 28, letterSpacing: -0.5, color: color.text },
  invite: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.sm, paddingHorizontal: space.md, height: 52, borderRadius: radius.lg,
    borderWidth: 1, borderColor: 'rgba(245,196,81,0.22)', backgroundColor: 'rgba(245,196,81,0.06)' },
  inviteIcon: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(245,196,81,0.12)' },
  inviteText: { ...type.label, fontSize: 14, color: color.text, flex: 1 },

  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: space.xxl, marginBottom: space.md },
  sectionTitle: { ...type.heading, color: color.text },
  link: { ...type.label, color: color.link, fontSize: 14 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  gridItem: { flexBasis: '48%', flexGrow: 1 },

  push: { marginTop: space.xxl },
  videos: { ...card, borderRadius: radius.lg, padding: space.lg, gap: space.md, marginTop: space.xl },
  cardTitle: { ...type.heading, fontSize: 20, color: color.text },
  refresh: { flexDirection: 'row', alignItems: 'center', gap: space.sm, alignSelf: 'flex-start', paddingHorizontal: space.md, height: 40,
    borderRadius: radius.pill, borderWidth: 1, borderColor: color.border, backgroundColor: '#0E0E13' },
  refreshText: { ...type.caption, color: color.textSecondary },
  refreshTime: { fontFamily: type.label.fontFamily, color: color.text, fontVariant: ['tabular-nums'] },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: color.border },
  tab: { flex: 1, alignItems: 'center', paddingVertical: space.sm, borderBottomWidth: 2, borderBottomColor: 'transparent', marginBottom: -1 },
  tabOn: { borderBottomColor: color.blueLight },
  tabText: { ...type.label, color: color.textMuted },
  tabTextOn: { color: color.text },
  filters: { flexDirection: 'row', gap: space.sm },
  empty: { borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.14)', borderRadius: radius.md, paddingVertical: space.xl, paddingHorizontal: space.lg, alignItems: 'center' },
  emptyText: { ...type.caption, color: color.textSecondary, textAlign: 'center' },
  more: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
});
