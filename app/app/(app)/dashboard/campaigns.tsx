import Feather from '@expo/vector-icons/Feather';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Dropdown } from '@/components/Dropdown';
import { TopBar } from '@/components/TopBar';
import { CampaignTile } from '@/features/campaigns/CampaignTile';
import { idr } from '@/lib/format';
import { web } from '@/theme/web';
import { useIsFocused } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/Button';
import { Chips } from '@/components/Chips';
import { EmptyState } from '@/components/EmptyState';
import { Field } from '@/components/Field';
import { Notice } from '@/components/Notice';
import { CardSkeleton } from '@/components/Skeleton';
import { errorMessage } from '@/lib/errors';
import { useLayout } from '@/lib/useLayout';
import { color, gradient, radius, space, type } from '@/theme/tokens';
import { activeFilterCount, EMPTY_FILTERS, fetchFeed, PAGE, type FeedItem, type Filters, type Sort } from '@/features/campaigns/api';
import { PLATFORMS, type Platform } from '@/features/creator/options';
import { CAMPAIGN_TYPE_OPTIONS, categoryLabel, FEED_SORTS, FILTER_CATEGORIES, FILTER_TYPES } from '@/features/campaigns/copy';
import { track } from '@/lib/analytics';

const MIN_CPM = [{ value: '0', label: 'Semua' }, { value: '2000', label: '≥ Rp2.000' }, { value: '5000', label: '≥ Rp5.000' }, { value: '10000', label: '≥ Rp10.000' }];
const ENDING = [{ value: '0', label: 'Semua' }, { value: '3', label: '3 hari' }, { value: '7', label: '7 hari' }, { value: '14', label: '14 hari' }];

export default function Campaigns() {
  const focused = useIsFocused();   // transparent screens: an unfocused tab must not paint under the active one
  const [sort, setSort] = useState<Sort>('recommended');
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [items, setItems] = useState<FeedItem[] | null>(null);
  const [featured, setFeatured] = useState<FeedItem[]>([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [done, setDone] = useState(false);
  const [sheet, setSheet] = useState(false);
  const seq = useRef(0);

  const load = useCallback(async (offset: number) => {
    const id = ++seq.current;
    try {
      const page = await fetchFeed(sort, filters, offset);
      if (id !== seq.current) return;                                // a newer sort/filter superseded this request
      setItems((prev) => (offset === 0 ? page : [...(prev ?? []), ...page.filter((p) => !prev?.some((x) => x.id === p.id))]));
      setDone(page.length < PAGE); setError(null);
    } catch (e) { if (id === seq.current) setError(errorMessage(e)); }
  }, [sort, filters]);

  // Reload on focus (joined badges stay current) and whenever sort/filters change.
  useFocusEffect(useCallback(() => { void load(0); }, [load]));
  useFocusEffect(useCallback(() => { fetchFeed('recommended', EMPTY_FILTERS, 0).then((r) => setFeatured(r.slice(0, 5))).catch(() => {}); }, []));
  const changeSort = (s: Sort) => { if (s !== sort) { setItems(null); setSort(s); } };
  const changeFilters = (f: Filters) => {
    setItems(null); setFilters(f);
    track('marketplace_filtered', { platforms: f.platforms.length, categories: f.categories.length, content_types: f.contentTypes.length, min_cpm: f.minCpm ?? null, ending_within_days: f.endingWithinDays ?? null });
  };

  const { isWide } = useLayout();
  const cols = isWide ? 3 : 2;
  const column = isWide ? styles.wideColumn : null;
  const extra = (filters.platforms.length ? 1 : 0) + (filters.minCpm ? 1 : 0) + (filters.endingWithinDays ? 1 : 0);
  const q = query.trim().toLowerCase();
  const shown = items && q ? items.filter((c) => c.title.toLowerCase().includes(q) || c.brand_name.toLowerCase().includes(q)) : items;
  const open = (id: string) => router.push({ pathname: '/campaign/[id]', params: { id } });

  const header = (
    <View style={{ gap: space.md }}>
      <TopBar title="Campaign" />
      {featured.length ? <Featured items={featured} onOpen={open} /> : null}
      <Text style={styles.section} accessibilityRole="header">Explore semua campaign</Text>
      <View style={styles.search}>
        <Feather name="search" size={18} color={color.textMuted} />
        <TextInput value={query} onChangeText={setQuery} placeholder="Cari campaign atau brand…" placeholderTextColor={color.textMuted}
          style={styles.searchInput} returnKeyType="search" accessibilityLabel="Cari campaign" />
        {query ? <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel="Hapus pencarian"><Feather name="x" size={16} color={color.textMuted} /></Pressable> : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
        <Dropdown label="Urutkan" icon="sliders" value={sort} options={FEED_SORTS} onChange={(v) => changeSort(v as Sort)} minWidth={130} />
        <Dropdown label="Kategori" value={filters.categories[0] ?? ''} options={FILTER_CATEGORIES} minWidth={130}
          onChange={(v) => changeFilters({ ...filters, categories: v ? [v] : [] })} />
        <Dropdown label="Tipe" value={filters.contentTypes[0] ?? ''} options={FILTER_TYPES} minWidth={120}
          onChange={(v) => changeFilters({ ...filters, contentTypes: v ? [v] : [] })} />
        <Pressable onPress={() => setSheet(true)} accessibilityRole="button" accessibilityLabel={extra ? `Filter lain, ${extra} aktif` : 'Filter lain'}
          style={({ pressed }) => [styles.more, extra > 0 && styles.moreOn, pressed && { opacity: 0.8 }]}>
          <Feather name="filter" size={15} color={extra ? color.link : color.textSecondary} />
          <Text style={[styles.moreText, extra > 0 && { color: color.link }]}>{extra ? `Filter · ${extra}` : 'Filter'}</Text>
        </Pressable>
      </ScrollView>
      {error ? <Notice tone="error" message={error} /> : null}
    </View>
  );

  return (
    <SafeAreaView style={[styles.safe, !focused && { display: 'none' }]} edges={['top']}>
      <FlatList
        key={cols}
        numColumns={cols}
        columnWrapperStyle={{ gap: space.md }}
        data={shown ?? []}
        keyExtractor={(c) => c.id}
        renderItem={({ item }) => <View style={{ flex: 1 / cols }}><CampaignTile item={item} onPress={() => open(item.id)} /></View>}
        contentContainerStyle={[styles.list, column, isWide && { paddingTop: space.xxxl, paddingBottom: space.xxxl }]}
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={color.blue}
          onRefresh={async () => { setRefreshing(true); await load(0); setRefreshing(false); }} />}
        onEndReachedThreshold={0.4}
        onEndReached={async () => {
          if (done || loadingMore || !items?.length) return;
          setLoadingMore(true); await load(items.length); setLoadingMore(false);
        }}
        ListHeaderComponent={header}
        ListHeaderComponentStyle={{ marginBottom: space.lg }}
        ListEmptyComponent={shown === null ? (error ? null : <><CardSkeleton /><CardSkeleton /></>) : q ? (
          <EmptyState title="Tidak ditemukan" body={`Tidak ada campaign atau brand "${query.trim()}".`} action={{ label: 'Hapus pencarian', onPress: () => setQuery('') }} />
        ) : activeFilterCount(filters) ? (
          <EmptyState title="Tidak ada campaign dengan filter ini" action={{ label: 'Hapus filter', onPress: () => changeFilters(EMPTY_FILTERS) }} />
        ) : (
          <EmptyState title="Belum ada campaign untukmu" body="Campaign muncul sesuai platform yang kamu hubungkan. Cek lagi nanti atau tambah akun sosial."
            action={{ label: 'Kelola akun sosial', onPress: () => router.push('/profile/socials') }} />
        )}
        ListFooterComponent={loadingMore ? <ActivityIndicator color={color.blue} style={{ marginVertical: space.xl }} /> : null}
      />

      <FilterSheet visible={sheet} initial={filters} onClose={() => setSheet(false)}
        onApply={(f) => { changeFilters(f); setSheet(false); }} />
    </SafeAreaView>
  );
}

// Featured carousel: top recommended campaigns, one per slide, with dots.
function Featured({ items, onOpen }: { items: FeedItem[]; onOpen: (id: string) => void }) {
  const [w, setW] = useState(0);
  const [i, setI] = useState(0);
  const ref = useRef<ScrollView>(null);
  useEffect(() => {
    if (!w || items.length < 2) return;
    const t = setInterval(() => setI((k) => { const n = (k + 1) % items.length; ref.current?.scrollTo({ x: n * w, animated: true }); return n; }), 6000);
    return () => clearInterval(t);
  }, [w, items.length]);
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={styles.featWrap}>
      {w ? (
        <ScrollView ref={ref} horizontal pagingEnabled showsHorizontalScrollIndicator={false} scrollEventThrottle={32}
          onScroll={(e) => setI(Math.round(e.nativeEvent.contentOffset.x / w))}>
          {items.map((c) => (
            <View key={c.id} style={[styles.feat, { width: w }]} {...(c.banner_url ? {} : web('art'))}>
              {c.banner_url ? <Image source={{ uri: c.banner_url }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityIgnoresInvertColors /> : null}
              <LinearGradient colors={['rgba(4,6,12,0.1)', 'rgba(4,6,12,0.55)', 'rgba(4,6,12,0.95)']} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />
              <View style={styles.featBody}>
                <Text style={styles.featTag}>UNGGULAN</Text>
                <Text style={styles.featTitle} numberOfLines={2}>{c.title}</Text>
                <View style={styles.featBrand}>
                  <View style={styles.featMono}><Text style={styles.featMonoText}>{c.brand_name.slice(0, 1).toUpperCase()}</Text></View>
                  <Text style={styles.featBrandText} numberOfLines={1}>{c.brand_name}</Text>
                  <Text style={styles.featCat}>{categoryLabel(c.category).toUpperCase()}</Text>
                </View>
                <View style={styles.featLine} />
                <Text style={styles.featRate}>{idr(c.cpm)}<Text style={styles.featUnit}> / 1K views</Text></Text>
                <Pressable onPress={() => onOpen(c.id)} accessibilityRole="button" style={({ pressed }) => [pressed && { opacity: 0.85 }]}>
                  <LinearGradient colors={gradient.button} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.featBtn}>
                    <Text style={styles.featBtnText}>{c.joined ? 'Buka campaign' : 'Ikut campaign'}</Text>
                  </LinearGradient>
                </Pressable>
              </View>
            </View>
          ))}
        </ScrollView>
      ) : <View style={{ height: 420 }} />}
      {items.length > 1 ? (
        <View style={styles.dots}>
          {items.map((c, k) => <View key={c.id} style={[styles.dotI, k === i && styles.dotOn]} />)}
        </View>
      ) : null}
    </View>
  );
}

function FilterSheet({ visible, initial, onClose, onApply }: { visible: boolean; initial: Filters; onClose: () => void; onApply: (f: Filters) => void }) {
  const [f, setF] = useState(initial);
  useEffect(() => { if (visible) setF(initial); }, [visible, initial]);
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.sheetHead}>
          <Text style={styles.title}>Filter</Text>
          <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button"><Text style={styles.closeText}>Tutup</Text></Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.sheetBody}>
          <Field label="Platform">
            <Chips multiple options={PLATFORMS} value={f.platforms} onChange={(v) => setF({ ...f, platforms: v as Platform[] })} />
          </Field>
          <Field label="Jenis campaign">
            <Chips multiple options={CAMPAIGN_TYPE_OPTIONS} value={f.categories} onChange={(categories) => setF({ ...f, categories })} />
          </Field>
          <Field label="Reward (CPM)">
            <Chips options={MIN_CPM} value={[String(f.minCpm ?? 0)]} onChange={([v]) => setF({ ...f, minCpm: Number(v) || null })} />
          </Field>
          <Field label="Berakhir dalam">
            <Chips options={ENDING} value={[String(f.endingWithinDays ?? 0)]} onChange={([v]) => setF({ ...f, endingWithinDays: Number(v) || null })} />
          </Field>
        </ScrollView>
        <View style={styles.sheetFoot}>
          <Button label="Terapkan" onPress={() => onApply(f)} />
          <Button variant="quiet" label="Reset" onPress={() => setF(EMPTY_FILTERS)} />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.canvas },
  title: { ...type.title, color: color.text, flex: 1 },
  section: { ...type.heading, fontSize: 20, color: color.text, marginTop: space.md },
  search: { flexDirection: 'row', alignItems: 'center', gap: space.sm, height: 48, paddingHorizontal: space.md, borderRadius: radius.md,
    borderWidth: 1, borderColor: color.border, backgroundColor: '#0E0E13' },
  searchInput: { flex: 1, ...type.body, color: color.text, outlineStyle: 'none' } as object,
  more: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 42, paddingHorizontal: space.md, borderRadius: radius.md,
    borderWidth: 1, borderColor: color.border, backgroundColor: '#0E0E13' },
  moreOn: { borderColor: 'rgba(117,178,244,0.5)' },
  moreText: { ...type.label, color: color.text },
  featWrap: { marginHorizontal: -space.xl, marginTop: space.sm },
  feat: { height: 440, justifyContent: 'flex-end', backgroundColor: color.blueDeep, overflow: 'hidden' },
  featBody: { padding: space.xl, gap: space.sm },
  featTag: { ...type.label, fontSize: 13, letterSpacing: 1.2, color: '#F5C451' },
  featTitle: { ...type.title, fontSize: 28, lineHeight: 34, color: '#FFFFFF' },
  featBrand: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  featMono: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  featMonoText: { ...type.label, fontSize: 12, color: '#FFFFFF' },
  featBrandText: { ...type.label, color: '#FFFFFF', flexShrink: 1 },
  featCat: { ...type.caption, fontSize: 11, letterSpacing: 0.5, color: 'rgba(255,255,255,0.85)', paddingHorizontal: 10, paddingVertical: 3,
    borderRadius: radius.pill, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', overflow: 'hidden' },
  featLine: { height: 1, backgroundColor: 'rgba(255,255,255,0.14)', marginVertical: space.xs },
  featRate: { ...type.display, fontSize: 30, lineHeight: 36, color: '#FFFFFF', fontVariant: ['tabular-nums'] },
  featUnit: { ...type.body, fontSize: 15, color: 'rgba(255,255,255,0.7)' },
  featBtn: { height: 50, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', marginTop: space.xs },
  featBtnText: { ...type.label, fontSize: 16, color: '#FFFFFF' },
  dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: space.md },
  dotI: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.22)' },
  dotOn: { width: 24, backgroundColor: color.blueLight },
  closeText: { ...type.label, color: color.link },
  filterDotText: { color: color.onAccent, fontSize: 11, fontFamily: type.label.fontFamily },
  sortsWrap: { flexGrow: 0, marginTop: space.lg },
  sorts: { paddingHorizontal: space.xl, gap: space.sm },
  sort: { height: 38, paddingHorizontal: 16, justifyContent: 'center', borderRadius: radius.pill, backgroundColor: color.surface },
  sortOn: { backgroundColor: color.blue },
  sortText: { ...type.label, color: color.textSecondary },
  sortTextOn: { color: color.onAccent },
  wideColumn: { width: '100%', maxWidth: 1040, alignSelf: 'center' },
  list: { paddingHorizontal: space.xl, paddingTop: space.lg, paddingBottom: 48, flexGrow: 1, gap: space.md },
  err: { marginTop: space.lg },
  sheetHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: space.xl },
  sheetBody: { paddingHorizontal: space.xl, gap: space.xl, paddingBottom: space.xl },
  sheetFoot: { paddingHorizontal: space.xl, paddingBottom: space.lg, gap: space.sm },
});
