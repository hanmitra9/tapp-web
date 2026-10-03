import type React from 'react';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { Header } from '@/components/Header';
import { LoadState } from '@/components/LoadState';
import { Screen } from '@/components/Screen';
import { errorMessage } from '@/lib/errors';
import { useAuth } from '@/providers/AuthProvider';
import { color, radius, space, type, card } from '@/theme/tokens';
import {
  fetchCreatorProfile, fetchPayoutMethod, fetchPlatforms, fetchStats,
  type CreatorProfile, type CreatorStats, type LinkedPlatform, type PayoutMethod,
} from '@/features/creator/api';
import { maskAccount } from '@/features/creator/handles';
import { AGE_RANGES, CONTENT_CATEGORIES, COUNTRIES, EXPERIENCE, LANGUAGES, labelOf, platformLabel } from '@/features/creator/options';

const STATUS: Record<CreatorProfile['status'], { label: string; tone: 'neutral' | 'blue' | 'danger' }> = {
  pending: { label: 'Profil belum lengkap', tone: 'neutral' },
  verified: { label: 'Dalam peninjauan', tone: 'neutral' },
  active: { label: 'Aktif', tone: 'blue' },
  suspended: { label: 'Ditangguhkan', tone: 'danger' },
  banned: { label: 'Ditutup', tone: 'danger' },
};
const TIER: Record<CreatorProfile['tier'], string> = { new: 'New', rising: 'Rising', verified: 'Verified', proven: 'Proven', elite: 'Elite' };

const idr = (n: number) => `Rp${new Intl.NumberFormat('id-ID').format(n)}`;
const compact = (n: number) => new Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 }).format(n);

type Data = { profile: CreatorProfile; stats: CreatorStats; platforms: LinkedPlatform[]; payout: PayoutMethod | null };

export default function Profile() {
  const { session, signOut } = useAuth();
  const uid = session!.user.id;
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [profile, stats, platforms, payout] = await Promise.all([
        fetchCreatorProfile(uid), fetchStats(uid), fetchPlatforms(uid), fetchPayoutMethod(uid),
      ]);
      setData({ profile, stats, platforms, payout }); setError(null);
    } catch (e) { setError(errorMessage(e)); }
  }, [uid]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));   // reflects edits made on sub-screens

  if (!data) return <Screen inTabs scroll={false}><Header title="Profil" back={false} /><LoadState error={error} onRetry={load} /></Screen>;
  const { profile: p, stats: s, platforms, payout } = data;
  const reviewed = s.approved + s.rejected;
  const approvalRate = reviewed ? Math.round((s.approved / reviewed) * 100) : null;
  const locked = p.status === 'suspended' || p.status === 'banned';
  const st = STATUS[p.status];

  return (
    <Screen inTabs refreshControl={<RefreshControl refreshing={refreshing} tintColor={color.blue}
      onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
      <Header title="Profil" back={false} />
      <View style={styles.identity}>
        <Avatar uri={p.avatarUrl} name={p.fullName} size={64} />
        <View style={styles.identityText}>
          <Text style={styles.name}>{p.fullName ?? '—'}</Text>
          <Text style={styles.username}>@{p.username ?? '—'}</Text>
          <View style={styles.badges}>
            <Text style={[styles.badge, st.tone === 'blue' && styles.badgeBlue, st.tone === 'danger' && styles.badgeDanger]}>{st.label}</Text>
            <Text style={styles.badge}>Level {TIER[p.tier]}</Text>
          </View>
        </View>
      </View>

      <View style={styles.stats}>
        <Stat label="Campaign diikuti" value={String(s.campaigns_joined)} />
        <Stat label="Klip disetujui" value={String(s.approved)} />
        <Stat label="Qualified views" value={compact(s.qualified_views)} />
        <Stat label="Total penghasilan" value={idr(s.total_earned)} />
      </View>
      <Pressable onPress={() => router.push('/performance')} hitSlop={8} style={styles.perfLink} accessibilityRole="link">
        <Text style={styles.action}>Lihat performa lengkap</Text>
      </Pressable>

      <Section title="Reliabilitas">
        <Row label="Skor reliabilitas" value={reviewed ? `${Math.round(p.reliability)}/100` : 'Belum ada data'} />
        <Row label="Tingkat persetujuan" value={approvalRate == null ? 'Belum ada submission yang ditinjau' : `${approvalRate}% dari ${reviewed} submission`} />
        <Text style={styles.note}>Skor naik saat klipmu disetujui dan tetap tayang; turun jika ditolak, ditandai, atau postingan dihapus/diprivat.</Text>
        <Text style={styles.note}>Level (New → Rising → Verified → Proven → Elite) naik otomatis dari total qualified views — bukan jumlah followers.</Text>
      </Section>

      <Section title="Akun sosial" action={locked ? undefined : { label: 'Kelola', onPress: () => router.push('/profile/socials') }}>
        {platforms.length ? platforms.map((x) => (
          <Row key={x.id} label={`${platformLabel(x.platform)}${x.platform === p.mainPlatform ? ' · utama' : ''}`}
            value={`@${x.handle}${x.verified_at ? ' · Terverifikasi' : ''}`} />
        )) : <Text style={styles.note}>Belum ada akun terhubung.</Text>}
      </Section>

      <Section title="Konten" action={locked ? undefined : { label: 'Ubah', onPress: () => router.push('/profile/edit') }}>
        <Row label="Jenis konten" value={p.categories.map((c) => labelOf(CONTENT_CATEGORIES, c)).join(', ')} />
        <Row label="Gaya konten" value={p.contentStyle ?? ''} />
        <Row label="Pengalaman" value={p.experience ? labelOf(EXPERIENCE, p.experience) : ''} />
        <Row label="Penonton" value={[
          p.audience.countries.map((c) => labelOf(COUNTRIES, c)).join(', '),
          p.audience.age_ranges.map((a) => labelOf(AGE_RANGES, a)).join(', '),
          p.audience.languages.map((l) => labelOf(LANGUAGES, l)).join(', '),
        ].filter(Boolean).join(' · ')} />
      </Section>

      <Section title="Pembayaran" action={locked ? undefined : { label: 'Ubah', onPress: () => router.push('/profile/payout') }}>
        <Row label={payout?.provider ?? 'Metode'} value={payout ? `${maskAccount(payout.account_number)} · ${payout.account_name}` : 'Belum diatur'} />
      </Section>
      <Pressable onPress={() => router.navigate('/dashboard/earnings')} hitSlop={8} style={styles.perfLink} accessibilityRole="link">
        <Text style={styles.action}>Riwayat pembayaran</Text>
      </Pressable>
      <Pressable onPress={() => router.push('/help')} hitSlop={8} style={styles.perfLink} accessibilityRole="link">
        <Text style={styles.action}>Bantuan & keberatan</Text>
      </Pressable>
      <View style={styles.logout}><Button variant="secondary" label="Keluar" onPress={signOut} /></View>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}
function Section({ title, action, children }: { title: string; action?: { label: string; onPress: () => void }; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle} accessibilityRole="header">{title}</Text>
        {action ? <Pressable onPress={action.onPress} hitSlop={10} accessibilityRole="button"><Text style={styles.action}>{action.label}</Text></Pressable> : null}
      </View>
      {children}
    </View>
  );
}
function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value || '—'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  identity: { flexDirection: 'row', gap: space.lg, alignItems: 'center' },
  identityText: { flex: 1, gap: 2 },
  name: { ...type.title, color: color.text },
  username: { ...type.body, color: color.textSecondary },
  badges: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
  badge: { ...type.caption, color: color.textSecondary, backgroundColor: color.surface, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm, overflow: 'hidden' },
  badgeBlue: { color: color.link, backgroundColor: color.accentSoft },
  badgeDanger: { color: color.danger, backgroundColor: color.dangerSoft },
  stats: { flexDirection: 'row', flexWrap: 'wrap', marginTop: space.xxl, gap: space.sm },
  stat: { flexGrow: 1, flexBasis: '45%', padding: space.lg, gap: 4, ...card, borderRadius: radius.lg },
  statValue: { ...type.metric, fontSize: 20, lineHeight: 26, letterSpacing: -0.5, color: color.text },
  statLabel: { ...type.caption, color: color.textMuted },
  section: { marginTop: space.xxl, gap: space.md },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  sectionTitle: { ...type.heading, color: color.text },
  action: { ...type.label, color: color.link },
  row: { gap: 2, paddingVertical: space.sm, borderBottomWidth: 1, borderBottomColor: color.border },
  rowLabel: { ...type.caption, color: color.textMuted },
  rowValue: { ...type.body, color: color.text },
  note: { ...type.caption, color: color.textMuted },
  perfLink: { marginTop: space.md, alignSelf: 'flex-start' },
  logout: { marginTop: space.xxxl },
});
