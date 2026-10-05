import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { EmptyState } from '@/components/EmptyState';
import { Header } from '@/components/Header';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { Segmented } from '@/components/Segmented';
import { CardSkeleton } from '@/components/Skeleton';
import { cpmLabel, dateLabel, deadlineLabel, isUrgent } from '@/lib/format';
import { useQuery } from '@/lib/useQuery';
import { color, radius, space, type, card } from '@/theme/tokens';
import { web } from '@/theme/web';
import { fetchMyCampaigns, type MyCampaign } from '@/features/campaigns/api';
import { fetchMySubmissions, type MySubmission } from '@/features/submissions/api';
import { SubmissionRow } from '@/features/submissions/SubmissionRow';
import { CAMPAIGN_STATUS } from '@/features/campaigns/copy';

type Stage = { key: string; label: string; icon: 'upload' | 'eye' | 'check' | 'dollar-sign'; match: (s: MySubmission) => boolean };
// A clip's journey, left to right: sent → in review → accepted → in the balance.
const STAGES: Stage[] = [
  { key: 'review', label: 'Direview', icon: 'eye', match: (s) => s.status === 'pending_review' },
  { key: 'fix', label: 'Perlu aksi', icon: 'upload', match: (s) => ['needs_changes', 'rejected', 'flagged'].includes(s.status) },
  { key: 'ok', label: 'Diterima', icon: 'check', match: (s) => s.status === 'approved' || s.status === 'tracking' },
  { key: 'paid', label: 'Masuk saldo', icon: 'dollar-sign', match: (s) => s.status === 'completed' },
];

// What am I working on: where every clip is, the campaigns I'm in.
export default function Activity() {
  const q = useQuery(async () => {
    const [campaigns, subs] = await Promise.all([fetchMyCampaigns(), fetchMySubmissions(undefined, 50)]);
    return { campaigns, subs };
  }, []);
  const [filter, setFilter] = useState('all');
  const rows = (q.data?.campaigns ?? []).filter((m) => m.campaign);
  const subs = q.data?.subs ?? [];
  const current = rows.filter((m) => m.status === 'joined');
  const past = rows.filter((m) => m.status !== 'joined');
  const stage = STAGES.find((s) => s.key === filter);
  const shown = stage ? subs.filter(stage.match) : subs;

  return (
    <Screen inTabs refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={q.refresh} tintColor={color.blue} />}>
      <Header title="Aktivitas" back={false} menu />
      {q.error && !q.data ? <Notice tone="error" message={q.error} /> : null}
      {!q.data && !q.error ? <><CardSkeleton /><CardSkeleton /></> : null}
      {q.data && !rows.length ? (
        <EmptyState title="Belum ikut campaign" body="Gabung ke campaign untuk mulai membuat klip dan mendapat penghasilan."
          action={{ label: 'Cari campaign', onPress: () => router.navigate('/dashboard/campaigns') }} />
      ) : null}

      {q.data && subs.length ? (
        <>
          <View style={styles.pipe}>
            <View style={styles.pipeLine} {...web('pipe')} />
            {STAGES.map((s) => {
              const n = subs.filter(s.match).length;
              const on = filter === s.key;
              const warn = s.key === 'fix' && n > 0;
              return (
                <Pressable key={s.key} onPress={() => setFilter(on ? 'all' : s.key)} style={styles.node} accessibilityRole="button"
                  accessibilityState={{ selected: on }} accessibilityLabel={`${s.label}: ${n}`}>
                  <View style={[styles.nodeDot, n > 0 && styles.nodeDotOn, warn && styles.nodeWarn, on && styles.nodeSel]}>
                    <Feather name={s.icon} size={16} color={n > 0 ? '#FFFFFF' : color.textMuted} />
                  </View>
                  <Text style={[styles.nodeN, warn && { color: color.warning }]}>{n}</Text>
                  <Text style={[styles.nodeLabel, on && { color: color.text }]}>{s.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.head}>
            <Text style={styles.section}>{stage ? stage.label : 'Semua klip'}</Text>
            {stage ? <Pressable onPress={() => setFilter('all')} hitSlop={8}><Text style={styles.link}>Tampilkan semua</Text></Pressable> : null}
          </View>
          {shown.length ? shown.slice(0, 12).map((x) => (
            <SubmissionRow key={x.id} s={x} showCampaign onPress={() => router.push({ pathname: '/workspace/[id]', params: { id: x.campaign_id } })} />
          )) : <Text style={styles.muted}>Tidak ada klip di tahap ini.</Text>}
        </>
      ) : null}

      {current.length ? <Text style={[styles.section, styles.sectionTop]}>Campaign yang kamu ikuti</Text> : null}
      <View style={styles.grid}>{current.map((m) => <CampaignTile key={m.id} m={m} />)}</View>
      {past.length ? <Text style={[styles.section, styles.sectionTop]}>Sudah tidak diikuti</Text> : null}
      <View style={styles.grid}>{past.map((m) => <CampaignTile key={m.id} m={m} />)}</View>
    </Screen>
  );
}

function CampaignTile({ m }: { m: MyCampaign }) {
  const c = m.campaign!;
  const statusText = m.status === 'left' ? 'Kamu keluar' : m.status === 'removed' ? 'Dikeluarkan' : CAMPAIGN_STATUS[c.status];
  const live = m.status === 'joined' && c.status === 'active';
  const dl = live ? deadlineLabel(c.submission_deadline) : null;
  return (
    <Pressable accessibilityRole="button" style={({ pressed }) => [styles.tile, !live && { opacity: 0.7 }, pressed && { opacity: 0.6 }]}
      onPress={() => m.status === 'joined'
        ? router.push({ pathname: '/workspace/[id]', params: { id: c.id } })
        : router.push({ pathname: '/campaign/[id]', params: { id: c.id } })}>
      <View style={styles.tileArt} {...(live ? web('art') : {})}>
        <Text style={styles.tileBrand} numberOfLines={1}>{c.brand?.name ?? ''}</Text>
        <Text style={[styles.badge, live && styles.badgeLive]}>{statusText}</Text>
      </View>
      <View style={styles.tileBody}>
        <Text style={styles.title} numberOfLines={2}>{c.title}</Text>
        <Text style={styles.meta}>{cpmLabel(Number(c.cpm))}</Text>
        <Text style={[styles.meta, dl && isUrgent(c.submission_deadline) && { color: color.warning }]}>{dl ?? `Bergabung ${dateLabel(m.joined_at)}`}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pipe: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space.sm, padding: space.lg, borderRadius: radius.lg, ...card, position: 'relative' },
  pipeLine: { position: 'absolute', left: '14%', right: '14%', top: space.lg + 19, height: 2, backgroundColor: 'rgba(117,178,244,0.22)' },
  node: { alignItems: 'center', gap: 4, flex: 1 },
  nodeDot: { width: 40, height: 40, borderRadius: 20, backgroundColor: color.surfaceRaised, borderWidth: 1, borderColor: color.border, alignItems: 'center', justifyContent: 'center' },
  nodeDotOn: { backgroundColor: color.blue, borderColor: 'rgba(117,178,244,0.6)' },
  nodeWarn: { backgroundColor: '#8A5A00', borderColor: color.warning },
  nodeSel: { transform: [{ scale: 1.1 }], borderColor: '#FFFFFF' },
  nodeN: { ...type.heading, color: color.text, fontVariant: ['tabular-nums'] },
  nodeLabel: { ...type.caption, fontSize: 12, color: color.textMuted },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: space.xl, marginBottom: space.xs },
  section: { ...type.heading, color: color.text },
  sectionTop: { marginTop: space.xxl, marginBottom: space.md },
  link: { ...type.label, color: color.link, fontSize: 14 },
  muted: { ...type.body, color: color.textMuted, marginTop: space.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  tile: { flexBasis: '46%', flexGrow: 1, ...card, borderRadius: radius.lg, overflow: 'hidden' },
  tileArt: { height: 72, padding: space.md, justifyContent: 'space-between', alignItems: 'flex-start', backgroundColor: color.surfaceRaised },
  tileBrand: { ...type.label, fontSize: 13, color: '#FFFFFF' },
  tileBody: { padding: space.md, gap: 4 },
  badge: { ...type.caption, fontSize: 11, color: color.textSecondary, backgroundColor: 'rgba(0,0,0,0.35)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, overflow: 'hidden' },
  badgeLive: { color: '#FFFFFF', backgroundColor: 'rgba(0,0,0,0.3)' },
  title: { ...type.label, color: color.text, minHeight: 40 },
  meta: { ...type.caption, color: color.textMuted, fontVariant: ['tabular-nums'] },
});
