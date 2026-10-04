import Feather from '@expo/vector-icons/Feather';
import type React from 'react';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { ActivityIndicator, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { Header } from '@/components/Header';
import { Notice } from '@/components/Notice';
import { LoadState } from '@/components/LoadState';
import { Screen } from '@/components/Screen';
import { errorMessage } from '@/lib/errors';
import { useAuth } from '@/providers/AuthProvider';
import { color, radius, space, type, card } from '@/theme/tokens';
import { web } from '@/theme/web';
import {
  fetchCreatorProfile, fetchPayoutMethod, fetchPlatforms, fetchStats, uploadAvatar,
  type CreatorProfile, type CreatorStats, type LinkedPlatform, type PayoutMethod,
} from '@/features/creator/api';
import { maskAccount } from '@/features/creator/handles';
import { platformLabel } from '@/features/creator/options';

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
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  // Photo shows on the profile and on the shareable payout card.
  async function changePhoto() {
    setPhotoError(null);
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', allowsEditing: true, aspect: [1, 1], quality: 1 });
    if (res.canceled || !res.assets[0]) return;
    setUploading(true);
    try { await uploadAvatar(uid, res.assets[0].uri); await load(); }
    catch (e) { setPhotoError(errorMessage((e as { code?: string })?.code ? e : { code: 'upload_failed' })); }
    finally { setUploading(false); }
  }

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
      <View style={styles.hero}>
        <View style={styles.heroArt} {...web('art')} />
        <Pressable onPress={changePhoto} disabled={uploading} style={styles.heroAvatar} accessibilityRole="button" accessibilityLabel={p.avatarUrl ? 'Ganti foto profil' : 'Tambah foto profil'}>
          <View style={styles.avatarRing}><Avatar uri={p.avatarUrl} name={p.fullName} size={88} /></View>
          <View style={styles.photoBadge}>{uploading ? <ActivityIndicator size="small" color={color.text} /> : <Feather name={p.avatarUrl ? 'edit-2' : 'camera'} size={13} color="#FFFFFF" />}</View>
        </Pressable>
        <Text style={styles.name}>{p.fullName ?? '—'}</Text>
        <Text style={styles.username}>@{p.username ?? '—'}{p.city ? ` · ${p.city}` : ''}</Text>
        <View style={styles.badges}>
          <Text style={[styles.badge, st.tone === 'blue' && styles.badgeBlue, st.tone === 'danger' && styles.badgeDanger]}>{st.label}</Text>
          <Text style={[styles.badge, styles.badgeLevel]}>Level {TIER[p.tier]}</Text>
        </View>
      </View>

      {photoError ? <View style={{ marginTop: space.md }}><Notice tone="error" message={photoError} /></View> : null}

      <View style={styles.stats}>
        <Stat label="Campaign diikuti" value={String(s.campaigns_joined)} />
        <Stat label="Klip disetujui" value={String(s.approved)} />
        <Stat label="Qualified views" value={compact(s.qualified_views)} />
        <Stat label="Total penghasilan" value={idr(s.total_earned)} />
      </View>
      <Pressable onPress={() => router.push('/performance')} hitSlop={8} style={styles.perfLink} accessibilityRole="link">
        <Text style={styles.action}>Lihat performa</Text>
      </Pressable>

      <Section title="Reliabilitas">
        <Row label="Skor" value={reviewed ? `${Math.round(p.reliability)}/100` : '—'} />
        <Row label="Disetujui" value={approvalRate == null ? '—' : `${approvalRate}% dari ${reviewed} klip`} />
      </Section>

      <Section title="Akun sosial" action={locked ? undefined : { label: 'Kelola', onPress: () => router.push('/profile/socials') }}>
        {platforms.length ? platforms.map((x) => (
          <Row key={x.id} label={`${platformLabel(x.platform)}${x.platform === p.mainPlatform ? ' · utama' : ''}`}
            value={`@${x.handle}${x.verified_at ? ' · Terverifikasi' : ''}`} />
        )) : <Text style={styles.note}>Belum ada akun terhubung.</Text>}
      </Section>


      <Section title="Pembayaran" action={locked ? undefined : { label: 'Ubah', onPress: () => router.push('/profile/payout') }}>
        <Row label={payout?.provider ?? 'Metode'} value={payout ? `${maskAccount(payout.account_number)} · ${payout.account_name}` : 'Belum diatur'} />
      </Section>
      <View style={styles.menu}>
        {([
          ['user', 'Ubah profil', '/profile/edit'], ['credit-card', 'Riwayat pencairan', '/dashboard/earnings'], ['award', 'Peringkat', '/leaderboard'],
          ['gift', 'Ajak teman', '/referral'], ['bell', 'Notifikasi', '/notifications'], ['help-circle', 'Bantuan', '/help'],
        ] as const).filter(([, , to]) => !(locked && to === '/profile/edit')).map(([icon, label, to], i) => (
          <Pressable key={to} onPress={() => router.push(to)} style={({ pressed }) => [styles.menuRow, i > 0 && styles.menuLine, pressed && { opacity: 0.6 }]} accessibilityRole="link">
            <Feather name={icon} size={18} color={color.link} />
            <Text style={styles.menuText}>{label}</Text>
            <Feather name="chevron-right" size={18} color={color.textMuted} />
          </Pressable>
        ))}
      </View>
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
  hero: { ...card, borderRadius: radius.xl, overflow: 'hidden', alignItems: 'center', paddingBottom: space.xl, gap: 4 },
  heroArt: { alignSelf: 'stretch', height: 96, backgroundColor: color.blueDeep },
  heroAvatar: { marginTop: -48, marginBottom: space.sm },
  avatarRing: { padding: 4, borderRadius: 52, backgroundColor: '#0B0B12' },
  badgeLevel: { color: '#F5C451', backgroundColor: 'rgba(245,196,81,0.12)' },
  photoBadge: { position: 'absolute', right: 4, bottom: 4, width: 30, height: 30, borderRadius: 15, backgroundColor: color.blue, borderWidth: 3, borderColor: '#0B0B12', alignItems: 'center', justifyContent: 'center' },
  photoBadgeText: { color: '#FFFFFF', fontSize: 13, lineHeight: 15, fontWeight: '700' },
  identityText: { flex: 1, gap: 2 },
  name: { ...type.title, color: color.text, textAlign: 'center' },
  username: { ...type.body, color: color.textSecondary, textAlign: 'center' },
  badges: { flexDirection: 'row', gap: space.sm, marginTop: space.sm, justifyContent: 'center' },
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
  menu: { marginTop: space.xxl, ...card, borderRadius: radius.lg, paddingHorizontal: space.lg },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.lg },
  menuLine: { borderTopWidth: 1, borderTopColor: color.border },
  menuText: { ...type.label, color: color.text, flex: 1 },
  logout: { marginTop: space.xxxl },
});
