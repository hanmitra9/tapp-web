import Feather from '@expo/vector-icons/Feather';
import { MenuButton } from '@/components/SideMenu';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import { color, radius, space, type } from '@/theme/tokens';
import { activeFilterCount, EMPTY_FILTERS, fetchFeed, PAGE, type FeedItem, type Filters, type Sort } from '@/features/campaigns/api';
import { CampaignCard } from '@/features/campaigns/CampaignCard';
import { PLATFORMS, type Platform } from '@/features/creator/options';
import { CAMPAIGN_TYPE_OPTIONS } from '@/features/campaigns/copy';
import { track } from '@/lib/analytics';

const SORTS: { value: Sort; label: string }[] = [
  { value: 'recommended', label: 'Rekomendasi' }, { value: 'newest', label: 'Terbaru' },
  { value: 'cpm', label: 'CPM tertinggi' }, { value: 'deadline', label: 'Deadline terdekat' },
];
const MIN_CPM = [{ value: '0', label: 'Semua' }, { value: '2000', label: '≥ Rp2.000' }, { value: '5000', label: '≥ Rp5.000' }, { value: '10000', label: '≥ Rp10.000' }];
const ENDING = [{ value: '0', label: 'Semua' }, { value: '3', label: '3 hari' }, { value: '7', label: '7 hari' }, { value: '14', label: '14 hari' }];

export default function Campaigns() {
  const focused = useIsFocused();   // transparent screens: an unfocused tab must not paint under the active one
  const [sort, setSort] = useState<Sort>('recommended');
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [items, setItems] = useState<FeedItem[] | null>(null);
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
  const changeSort = (s: Sort) => { if (s !== sort) { setItems(null); setSort(s); } };
  const changeFilters = (f: Filters) => {
    setItems(null); setFilters(f);
    track('marketplace_filtered', { platforms: f.platforms.length, categories: f.categories.length, content_types: f.contentTypes.length, min_cpm: f.minCpm ?? null, ending_within_days: f.endingWithinDays ?? null });
  };

  const { isWide } = useLayout();
  const cols = isWide ? 2 : 1;
  const column = isWide ? styles.wideColumn : null;
  const count = activeFilterCount(filters);
  const open = (id: string) => router.push({ pathname: '/campaign/[id]', params: { id } });

  return (
    <SafeAreaView style={[styles.safe, !focused && { display: 'none' }]} edges={['top']}>
      <View style={[styles.head, column, isWide && { paddingTop: space.xxxl }]}>
        <MenuButton />
        <Text style={styles.title} accessibilityRole="header">Campaign</Text>
        <Pressable onPress={() => setSheet(true)} hitSlop={8} accessibilityRole="button"
          accessibilityLabel={count ? `Filter, ${count} aktif` : 'Filter'} style={({ pressed }) => [styles.filterBtn, pressed && { backgroundColor: color.surfaceRaised }]}>
          <Feather name="sliders" size={18} color={color.text} />
          {count ? <View style={styles.filterDot}><Text style={styles.filterDotText}>{count}</Text></View> : null}
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sorts} style={[styles.sortsWrap, column]}>
        {SORTS.map((s) => (
          <Pressable key={s.value} onPress={() => changeSort(s.value)} accessibilityRole="tab" accessibilityState={{ selected: sort === s.value }}
            style={[styles.sort, sort === s.value && styles.sortOn]}>
            <Text style={[styles.sortText, sort === s.value && styles.sortTextOn]}>{s.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <FlatList
        key={cols}
        numColumns={cols}
        columnWrapperStyle={cols > 1 ? { gap: space.md } : undefined}
        data={items ?? []}
        keyExtractor={(c) => c.id}
        renderItem={({ item }) => <View style={{ flex: 1 }}><CampaignCard item={item} onPress={() => open(item.id)} /></View>}
        contentContainerStyle={[styles.list, column, isWide && { paddingBottom: space.xxxl }]}
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={color.blue}
          onRefresh={async () => { setRefreshing(true); await load(0); setRefreshing(false); }} />}
        onEndReachedThreshold={0.4}
        onEndReached={async () => {
          if (done || loadingMore || !items?.length) return;
          setLoadingMore(true); await load(items.length); setLoadingMore(false);
        }}
        ListHeaderComponent={error ? <View style={styles.err}><Notice tone="error" message={error} /></View> : null}
        ListEmptyComponent={items === null ? (error ? null : <><CardSkeleton /><CardSkeleton /><CardSkeleton /></>) : count ? (
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
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.xl, paddingTop: space.lg + space.md },
  title: { ...type.title, color: color.text, flex: 1 },
  filterBtn: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: color.surface, alignItems: 'center', justifyContent: 'center' },
  filterDot: { position: 'absolute', top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: color.blue, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  closeText: { ...type.label, color: color.link },
  filterDotText: { color: color.onAccent, fontSize: 11, fontFamily: type.label.fontFamily },
  sortsWrap: { flexGrow: 0, marginTop: space.lg },
  sorts: { paddingHorizontal: space.xl, gap: space.sm },
  sort: { height: 38, paddingHorizontal: 16, justifyContent: 'center', borderRadius: radius.pill, backgroundColor: color.surface },
  sortOn: { backgroundColor: color.blue },
  sortText: { ...type.label, color: color.textSecondary },
  sortTextOn: { color: color.onAccent },
  wideColumn: { width: '100%', maxWidth: 1040, alignSelf: 'center' },
  list: { paddingHorizontal: space.xl, paddingTop: space.lg, paddingBottom: 120, flexGrow: 1, gap: space.md },
  err: { marginTop: space.lg },
  sheetHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: space.xl },
  sheetBody: { paddingHorizontal: space.xl, gap: space.xl, paddingBottom: space.xl },
  sheetFoot: { paddingHorizontal: space.xl, paddingBottom: space.lg, gap: space.sm },
});
