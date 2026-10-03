import { router } from 'expo-router';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { EmptyState } from '@/components/EmptyState';
import { Header } from '@/components/Header';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { CardSkeleton } from '@/components/Skeleton';
import { cpmLabel, dateLabel, deadlineLabel } from '@/lib/format';
import { useQuery } from '@/lib/useQuery';
import { color, radius, space, type, card } from '@/theme/tokens';
import { fetchMyCampaigns, type MyCampaign } from '@/features/campaigns/api';
import { fetchMySubmissions } from '@/features/submissions/api';
import { SubmissionRow } from '@/features/submissions/SubmissionRow';
import { CAMPAIGN_STATUS } from '@/features/campaigns/copy';

// What am I working on: joined campaigns + latest submissions with their review status.
export default function Activity() {
  const q = useQuery(async () => {
    const [campaigns, subs] = await Promise.all([fetchMyCampaigns(), fetchMySubmissions(undefined, 20)]);
    return { campaigns, subs };
  }, []);
  const rows = (q.data?.campaigns ?? []).filter((m) => m.campaign);
  const subs = q.data?.subs ?? [];
  const attention = subs.filter((x) => x.status === 'needs_changes' || x.status === 'rejected' || x.status === 'flagged').length;
  const current = rows.filter((m) => m.status === 'joined');
  const past = rows.filter((m) => m.status !== 'joined');

  return (
    <Screen inTabs refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={q.refresh} tintColor={color.blue} />}>
      <Header title="Aktivitas" back={false} />
      {q.error && !q.data ? <Notice tone="error" message={q.error} /> : null}
      {!q.data && !q.error ? <><CardSkeleton /><CardSkeleton /></> : null}
      {q.data && !rows.length ? (
        <EmptyState title="Belum ikut campaign" body="Gabung ke campaign untuk mulai membuat klip dan mendapat penghasilan."
          action={{ label: 'Cari campaign', onPress: () => router.navigate('/dashboard/campaigns') }} />
      ) : null}
      {attention ? <Notice tone="info" message={`${attention} submission butuh perhatianmu.`} /> : null}
      {subs.length ? <Text style={styles.section}>Submission terbaru</Text> : null}
      {subs.slice(0, 8).map((x) => (
        <SubmissionRow key={x.id} s={x} showCampaign
          onPress={() => router.push({ pathname: '/workspace/[id]', params: { id: x.campaign_id } })} />
      ))}
      {current.length ? <Text style={styles.section}>Campaign yang kamu ikuti</Text> : null}
      {current.map((m) => <Row key={m.id} m={m} />)}
      {past.length ? <Text style={styles.section}>Sudah tidak diikuti</Text> : null}
      {past.map((m) => <Row key={m.id} m={m} />)}
    </Screen>
  );
}

function Row({ m }: { m: MyCampaign }) {
  const c = m.campaign!;
  const statusText = m.status === 'left' ? 'Kamu keluar' : m.status === 'removed' ? 'Dikeluarkan' : CAMPAIGN_STATUS[c.status];
  const live = m.status === 'joined' && c.status === 'active';
  return (
    <Pressable accessibilityRole="button"
      onPress={() => m.status === 'joined'
        ? router.push({ pathname: '/workspace/[id]', params: { id: c.id } })
        : router.push({ pathname: '/campaign/[id]', params: { id: c.id } })}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}>
      <View style={styles.rowTop}>
        <Text style={styles.brand}>{c.brand?.name ?? ''}</Text>
        <Text style={[styles.badge, live && styles.badgeLive]}>{statusText}</Text>
      </View>
      <Text style={styles.title} numberOfLines={2}>{c.title}</Text>
      <Text style={styles.meta}>
        {cpmLabel(Number(c.cpm))} · Bergabung {dateLabel(m.joined_at)}
        {live && deadlineLabel(c.submission_deadline) ? ` · ${deadlineLabel(c.submission_deadline)}` : ''}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: { ...type.label, color: color.textMuted, marginTop: space.xl, marginBottom: space.xs },
  row: { ...card, padding: space.lg, gap: 4, borderRadius: radius.md, marginBottom: space.sm },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between' },
  brand: { ...type.caption, color: color.textSecondary },
  badge: { ...type.caption, color: color.textSecondary, backgroundColor: color.surface, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.sm, overflow: 'hidden' },
  badgeLive: { color: color.link, backgroundColor: color.accentSoft },
  title: { ...type.heading, color: color.text },
  meta: { ...type.caption, color: color.textMuted, fontVariant: ['tabular-nums'] },
});
