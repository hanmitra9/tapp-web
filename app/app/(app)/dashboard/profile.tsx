import Feather from '@expo/vector-icons/Feather';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { ActivityIndicator, Image, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { Dropdown } from '@/components/Dropdown';
import { LoadState } from '@/components/LoadState';
import { Notice } from '@/components/Notice';
import { RankBadge, RANK_METAL } from '@/components/RankBadge';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { TopBar } from '@/components/TopBar';
import { errorMessage } from '@/lib/errors';
import { idrCompact } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { useLayout } from '@/lib/useLayout';
import { useAuth } from '@/providers/AuthProvider';
import { color, radius, space, type, card } from '@/theme/tokens';
import {
  fetchCreatorProfile, fetchPayoutMethod, fetchPlatforms, fetchStats, updateProfile, uploadAvatar,
  type CreatorProfile, type CreatorStats, type LinkedPlatform, type PayoutMethod,
} from '@/features/creator/api';
import { maskAccount } from '@/features/creator/handles';
import { CITIES, platformLabel } from '@/features/creator/options';

const compactNum = (n: number) => new Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
const TIER: Record<CreatorProfile['tier'], string> = { new: 'New', rising: 'Rising', verified: 'Verified', proven: 'Proven', elite: 'Elite' };
const STATUS: Record<CreatorProfile['status'], { label: string; tone: 'ok' | 'wait' | 'bad'; note: string }> = {
  pending: { label: 'Profil belum lengkap', tone: 'wait', note: 'Lengkapi profil untuk ikut campaign.' },
  verified: { label: 'Dalam peninjauan', tone: 'wait', note: 'Biasanya 1x24 jam.' },
  active: { label: 'Terverifikasi', tone: 'ok', note: 'Bisa ikut campaign & tarik saldo.' },
  suspended: { label: 'Ditangguhkan', tone: 'bad', note: 'Hubungi admin.' },
  banned: { label: 'Ditutup', tone: 'bad', note: 'Akunmu ditutup.' },
};
type Tab = 'profil' | 'akun' | 'verifikasi' | 'keamanan';
type Data = { profile: CreatorProfile; stats: CreatorStats; platforms: LinkedPlatform[]; payout: PayoutMethod | null };

// Profile (konten-style): identity + total earnings, then tabs for profile, account, verification and security.
export default function Profile() {
  const { session, signOut, refreshAccount } = useAuth();
  const { isWide } = useLayout();
  const uid = session!.user.id;
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<Tab>('profil');
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [profile, stats, platforms, payout] = await Promise.all([fetchCreatorProfile(uid), fetchStats(uid), fetchPlatforms(uid), fetchPayoutMethod(uid)]);
      setData({ profile, stats, platforms, payout }); setError(null);
    } catch (e) { setError(errorMessage(e)); }
  }, [uid]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function changePhoto() {
    setPhotoError(null);
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', allowsEditing: true, aspect: [1, 1], quality: 1 });
    if (res.canceled || !res.assets[0]) return;
    setUploading(true);
    try { await uploadAvatar(uid, res.assets[0].uri); await load(); void refreshAccount(); }
    catch (e) { setPhotoError(errorMessage((e as { code?: string })?.code ? e : { code: 'upload_failed' })); }
    finally { setUploading(false); }
  }

  const header = <View style={{ marginBottom: space.xl }}><TopBar title="Profil" /></View>;
  if (!data) return <Screen inTabs scroll={false}>{header}<LoadState error={error} onRetry={load} /></Screen>;
  const { profile: p, stats: s, platforms, payout } = data;
  const locked = p.status === 'suspended' || p.status === 'banned';
  const joined = new Date(session!.user.created_at).toLocaleDateString('id-ID', { month: 'short', year: 'numeric' });
  const metal = RANK_METAL[p.tier];

  return (
    <Screen inTabs refreshControl={<RefreshControl refreshing={refreshing} tintColor={color.blue}
      onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
      {header}

      <View style={styles.hero}>
        <LinearGradient colors={[`${metal.mid}55`, 'rgba(12,101,196,0.18)', 'rgba(0,0,0,0)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.banner}>
          <Image source={require('../../../assets/tapp-mark-white.png')} style={styles.bannerMark} accessibilityIgnoresInvertColors />
        </LinearGradient>
        <View style={[styles.heroBody, isWide && { flexDirection: 'row', alignItems: 'flex-end' }]}>
          <Pressable onPress={changePhoto} disabled={uploading} style={[styles.avatarRing, { borderColor: metal.mid }]} accessibilityRole="button" accessibilityLabel="Ganti foto profil">
            <Avatar uri={p.avatarUrl} name={p.fullName} size={84} />
            <View style={styles.photoBadge}>{uploading ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Feather name="camera" size={12} color="#FFFFFF" />}</View>
          </Pressable>
          <View style={[{ gap: 6 }, isWide ? { flex: 1, paddingBottom: 4 } : { alignItems: 'center' }]}>
            <Text style={styles.name} numberOfLines={1}>{p.fullName ?? '—'}</Text>
            <View style={[styles.nameRow, !isWide && { justifyContent: 'center' }]}>
              <Pressable onPress={() => router.push('/rank')} style={[styles.rankPill, { borderColor: `${metal.mid}88` }]} accessibilityRole="link">
                <RankBadge tier={p.tier} size={18} /><Text style={[styles.rankText, { color: metal.hi }]}>{TIER[p.tier]} Clipper</Text>
              </Pressable>
              <Text style={styles.meta}>@{p.username ?? '—'} · sejak {joined}</Text>
            </View>
          </View>
        </View>
        <View style={styles.statsRow}>
          <Pressable onPress={() => router.navigate('/dashboard/earnings')} style={styles.statCell} accessibilityRole="link">
            <Text style={styles.statValue} numberOfLines={1}>{idrCompact(s.total_earned)}</Text><Text style={styles.statLabel}>Penghasilan</Text>
          </Pressable>
          <View style={styles.statDiv} />
          <View style={styles.statCell}><Text style={styles.statValue}>{s.approved}</Text><Text style={styles.statLabel}>Klip diterima</Text></View>
          <View style={styles.statDiv} />
          <View style={styles.statCell}><Text style={styles.statValue}>{compactNum(s.qualified_views)}</Text><Text style={styles.statLabel}>Views</Text></View>
        </View>
      </View>
      {photoError ? <View style={{ marginTop: space.md }}><Notice tone="error" message={photoError} /></View> : null}

      <View style={styles.tabs} accessibilityRole="tablist">
        {([['profil', 'Profil'], ['akun', 'Akun'], ['verifikasi', 'Verifikasi'], ['keamanan', 'Keamanan']] as const).map(([k, label]) => (
          <Pressable key={k} onPress={() => setTab(k)} accessibilityRole="tab" accessibilityState={{ selected: tab === k }} style={[styles.tab, tab === k && styles.tabOn]}>
            <Text style={[styles.tabText, tab === k && styles.tabTextOn]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {tab === 'profil' ? <ProfileTab p={p} uid={uid} locked={locked} onSaved={() => { void load(); void refreshAccount(); }} /> : null}

      {tab === 'akun' ? (
        <>
          <Panel>
            <Field label="Email" value={session!.user.email ?? '—'} />
            <Field label="Username" value={`@${p.username ?? '—'}`} />
          </Panel>
          <LinkCard icon="credit-card" title="Metode pembayaran" sub={payout ? `${payout.provider} ${maskAccount(payout.account_number)} · ${payout.account_name}` : 'Belum diatur'}
            action={payout ? 'Ubah' : 'Atur'} onPress={locked ? undefined : () => router.navigate('/dashboard/earnings')} />
          <LinkCard icon="clock" title="Riwayat pencairan" sub="Semua penarikan" action="Lihat" onPress={() => router.push('/payouts')} />
          <LinkCard icon="bell" title="Notifikasi" sub="Review, saldo, campaign" action="Buka" onPress={() => router.push('/notifications')} />
        </>
      ) : null}

      {tab === 'verifikasi' ? (
        <>
          <Panel>
            <View style={styles.statusRow}>
              <View style={[styles.statusIcon, STATUS[p.status].tone === 'ok' ? { backgroundColor: color.successSoft } : STATUS[p.status].tone === 'bad' ? { backgroundColor: color.dangerSoft } : { backgroundColor: color.warningSoft }]}>
                <Feather name={STATUS[p.status].tone === 'ok' ? 'shield' : STATUS[p.status].tone === 'bad' ? 'slash' : 'clock'} size={16}
                  color={STATUS[p.status].tone === 'ok' ? color.success : STATUS[p.status].tone === 'bad' ? color.danger : color.warning} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{STATUS[p.status].label}</Text>
                <Text style={styles.cardSub}>{STATUS[p.status].note}</Text>
              </View>
            </View>
          </Panel>
          <Panel>
            <View style={styles.panelHead}>
              <Text style={styles.cardTitle}>Akun sosial</Text>
              {!locked ? <Pressable onPress={() => router.push('/profile/socials')} hitSlop={8}><Text style={styles.link}>Kelola</Text></Pressable> : null}
            </View>
            {platforms.length ? platforms.map((x) => (
              <View key={x.id} style={styles.social}>
                <FontAwesome6 name={x.platform === 'x' ? 'x-twitter' : x.platform} brand size={15} color={color.text} />
                <Text style={styles.socialText} numberOfLines={1}>{platformLabel(x.platform)} · @{x.handle}</Text>
                {x.verified_at ? <View style={styles.okPill}><Feather name="check" size={11} color={color.success} /><Text style={styles.okText}>Terverifikasi</Text></View>
                  : <Text style={styles.waitText}>Belum diverifikasi</Text>}
              </View>
            )) : <Text style={styles.cardSub}>Belum ada akun terhubung.</Text>}
          </Panel>
          <Panel>
            <Text style={styles.cardTitle}>Kualitas klip</Text>
            <View style={styles.qual}>
              <Mini label="Klip diterima" value={String(s.approved)} />
              <Mini label="Approval rate" value={s.approved + s.rejected ? `${Math.round((s.approved / (s.approved + s.rejected)) * 100)}%` : '—'} />
              <Mini label="Reliabilitas" value={s.approved + s.rejected ? `${Math.round(p.reliability)}/100` : '—'} />
            </View>
          </Panel>
        </>
      ) : null}

      {tab === 'keamanan' ? <SecurityTab provider={(session!.user.app_metadata?.providers as string[] | undefined) ?? [session!.user.app_metadata?.provider ?? 'email']} onSignOut={signOut} /> : null}

      {tab === 'profil' ? (
        <>
          <GoogleCard providers={(session!.user.app_metadata?.providers as string[] | undefined) ?? [session!.user.app_metadata?.provider ?? 'email']} />
          <Pressable onPress={() => router.push('/profile/socials')} style={({ pressed }) => [styles.panel, styles.statusRow, styles.ctaRow, pressed && { opacity: 0.85 }]} accessibilityRole="button">
            <View style={[styles.linkIcon, { backgroundColor: color.blue }]}><Feather name="link-2" size={15} color="#FFFFFF" /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Akun sosial</Text>
              <Text style={styles.cardSub}>{platforms.length ? `${platforms.length} terhubung` : 'Hubungkan supaya klip dilacak otomatis'}</Text>
            </View>
            <Feather name="chevron-right" size={18} color={color.textMuted} />
          </Pressable>
        </>
      ) : null}
    </Screen>
  );
}

function ProfileTab({ p, uid, locked, onSaved }: { p: CreatorProfile; uid: string; locked: boolean; onSaved: () => void }) {
  const [fullName, setFullName] = useState(p.fullName ?? '');
  const [city, setCity] = useState(p.city ?? '');
  const known = CITIES.some((c) => c.value.toLowerCase() === city.trim().toLowerCase());
  const [other, setOther] = useState(!!p.city && !CITIES.some((c) => c.value.toLowerCase() === (p.city ?? '').toLowerCase()));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const dirty = fullName.trim() !== (p.fullName ?? '') || city.trim() !== (p.city ?? '');
  async function save() {
    if (fullName.trim().length < 2) { setMsg({ tone: 'error', text: 'Nama minimal 2 huruf.' }); return; }
    setBusy(true); setMsg(null);
    try { await updateProfile(uid, { fullName, username: p.username ?? '', city }); setMsg({ tone: 'success', text: 'Tersimpan.' }); onSaved(); }
    catch (e) { setMsg({ tone: 'error', text: errorMessage(e) }); }
    finally { setBusy(false); }
  }
  return (
    <Panel>
      <TextField label="Nama lengkap" value={fullName} onChangeText={setFullName} autoCapitalize="words" editable={!locked} />
      <View style={{ gap: space.sm }}>
        <Text style={styles.fieldLabel}>Kota</Text>
        <Dropdown label="Pilih kota" value={other ? '__other' : known ? CITIES.find((c) => c.value.toLowerCase() === city.trim().toLowerCase())!.value : ''}
          options={[{ value: '', label: 'Pilih kota' }, ...CITIES, { value: '__other', label: 'Kota lain…' }]}
          onChange={(v) => { if (v === '__other') { setOther(true); setCity(''); } else { setOther(false); setCity(v); } }} />
        {other ? <TextField label="Nama kota" value={city} onChangeText={setCity} placeholder="Contoh: Solo" autoCapitalize="words" /> : null}
      </View>
      {msg ? <Notice tone={msg.tone === 'success' ? 'info' : 'error'} message={msg.text} /> : null}
      <View style={{ alignItems: 'flex-end' }}>
        <View style={{ minWidth: 160 }}><Button label="Simpan" onPress={save} loading={busy} disabled={!dirty || locked} /></View>
      </View>
    </Panel>
  );
}

function GoogleCard({ providers }: { providers: string[] }) {
  const on = providers.includes('google');
  return (
    <View style={[styles.panel, styles.statusRow]}>
      <View style={styles.linkIcon}><FontAwesome6 name="google" brand size={15} color={color.text} /></View>
      <Text style={[styles.cardTitle, { flex: 1 }]}>Google</Text>
      {on ? <View style={styles.okPill}><Feather name="check" size={11} color={color.success} /><Text style={styles.okText}>Terhubung</Text></View>
        : <Text style={styles.cardSub}>Login pakai email</Text>}
    </View>
  );
}

function SecurityTab({ provider, onSignOut }: { provider: string[]; onSignOut: () => void }) {
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  async function change() {
    if (pw.length < 8) { setMsg({ tone: 'error', text: 'Kata sandi minimal 8 karakter.' }); return; }
    if (pw !== pw2) { setMsg({ tone: 'error', text: 'Konfirmasi kata sandi tidak sama.' }); return; }
    setBusy(true); setMsg(null);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) setMsg({ tone: 'error', text: errorMessage(error) });
    else { setMsg({ tone: 'success', text: 'Kata sandi diperbarui.' }); setPw(''); setPw2(''); }
  }
  return (
    <>
      <GoogleCard providers={provider} />
      <Panel>
        <Text style={styles.cardTitle}>{provider.includes('email') ? 'Ubah kata sandi' : 'Buat kata sandi'}</Text>
        <TextField label="Kata sandi baru" value={pw} onChangeText={setPw} secure />
        <TextField label="Ulangi kata sandi" value={pw2} onChangeText={setPw2} secure />
        {msg ? <Notice tone={msg.tone === 'success' ? 'info' : 'error'} message={msg.text} /> : null}
        <View style={{ alignItems: 'flex-end' }}><View style={{ minWidth: 160 }}><Button label="Simpan" onPress={change} loading={busy} disabled={!pw} /></View></View>
      </Panel>
      <Panel>
        <View style={styles.statusRow}>
          <Feather name="log-out" size={18} color={color.danger} />
          <View style={{ flex: 1 }}><Text style={styles.cardTitle}>Keluar</Text><Text style={styles.cardSub}>Dari perangkat ini</Text></View>
          <Pressable onPress={onSignOut} style={styles.dangerBtn} accessibilityRole="button"><Text style={styles.dangerText}>Keluar</Text></Pressable>
        </View>
      </Panel>
    </>
  );
}

function Panel({ children }: { children: ReactNode }) { return <View style={styles.panel}>{children}</View>; }
function Field({ label, value }: { label: string; value: string }) {
  return <View style={{ gap: 4 }}><Text style={styles.fieldLabel}>{label}</Text><View style={styles.readonly}><Text style={styles.readonlyText} numberOfLines={1}>{value}</Text></View></View>;
}
function Mini({ label, value }: { label: string; value: string }) {
  return <View style={{ flex: 1, gap: 2 }}><Text style={styles.miniValue}>{value}</Text><Text style={styles.cardSub}>{label}</Text></View>;
}
function LinkCard({ icon, title, sub, action, onPress }: { icon: 'credit-card' | 'clock' | 'bell'; title: string; sub: string; action: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [styles.panel, styles.statusRow, pressed && { opacity: 0.8 }]} accessibilityRole="button">
      <View style={styles.linkIcon}><Feather name={icon} size={16} color={color.link} /></View>
      <View style={{ flex: 1 }}><Text style={styles.cardTitle}>{title}</Text><Text style={styles.cardSub} numberOfLines={1}>{sub}</Text></View>
      {onPress ? <Text style={styles.link}>{action}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: radius.xl, overflow: 'hidden', ...card },
  banner: { height: 96, overflow: 'hidden' },
  bannerMark: { position: 'absolute', right: 18, top: 14, width: 90, height: 90, opacity: 0.12 },
  heroBody: { paddingHorizontal: space.lg, marginTop: -44, gap: space.md, alignItems: 'center' },
  avatarRing: { borderWidth: 2, borderRadius: 999, padding: 3, backgroundColor: '#0B0B12' },
  statsRow: { flexDirection: 'row', alignItems: 'center', margin: space.lg, marginTop: space.lg, paddingVertical: space.md, borderRadius: radius.md,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', backgroundColor: 'rgba(255,255,255,0.03)' },
  statCell: { flex: 1, alignItems: 'center', gap: 2, paddingHorizontal: 6 },
  statValue: { ...type.heading, fontSize: 17, color: color.text, fontVariant: ['tabular-nums'] },
  statLabel: { ...type.caption, fontSize: 11, color: color.textMuted },
  statDiv: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.08)' },
  ctaRow: { borderColor: 'rgba(117,178,244,0.3)' },
  idCard: { flexDirection: 'row', gap: space.lg, padding: space.lg, borderRadius: radius.lg, ...card },
  avatarWrap: { alignSelf: 'flex-start' },
  photoBadge: { position: 'absolute', right: -2, bottom: -2, width: 22, height: 22, borderRadius: 11, backgroundColor: color.blue, borderWidth: 2, borderColor: '#0B0B12', alignItems: 'center', justifyContent: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap', marginTop: space.sm },
  name: { ...type.title, fontSize: 24, color: color.text, flexShrink: 1 },
  rankPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: 3, paddingRight: 10, height: 26, borderRadius: radius.pill, borderWidth: 1, backgroundColor: 'rgba(255,255,255,0.04)' },
  rankText: { ...type.caption, fontSize: 12, fontFamily: type.label.fontFamily },
  meta: { ...type.caption, color: color.textMuted },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', paddingHorizontal: 10, height: 26, borderRadius: radius.sm,
    borderWidth: 1, borderColor: color.border, backgroundColor: 'rgba(255,255,255,0.04)', marginTop: 4 },
  editText: { ...type.caption, fontSize: 12, color: color.text },
  earn: { minHeight: 110, padding: space.lg, borderRadius: radius.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: '#0E0F15', justifyContent: 'space-between', overflow: 'hidden' },
  earnMark: { position: 'absolute', right: 10, top: 18, width: 84, height: 84, opacity: 0.08 },
  earnLabel: { ...type.caption, fontSize: 12, color: color.textSecondary },
  earnValue: { ...type.title, fontSize: 24, color: color.text, fontVariant: ['tabular-nums'] },
  tabs: { flexDirection: 'row', alignSelf: 'stretch', gap: 4, padding: 4, marginTop: space.lg, borderRadius: radius.md, borderWidth: 1, borderColor: color.border, backgroundColor: '#0B0B10' },
  tab: { flex: 1, paddingHorizontal: 8, height: 36, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  tabOn: { backgroundColor: color.blue },
  tabText: { ...type.label, fontSize: 13, color: color.textSecondary },
  tabTextOn: { color: '#FFFFFF' },
  panel: { marginTop: space.md, padding: space.lg, gap: space.md, borderRadius: radius.lg, ...card },
  panelHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { ...type.label, fontSize: 15, color: color.text },
  cardSub: { ...type.caption, color: color.textMuted },
  fieldLabel: { ...type.label, color: color.text },
  readonly: { height: 46, justifyContent: 'center', paddingHorizontal: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: color.border, backgroundColor: '#0B0B10' },
  readonlyText: { ...type.body, color: color.textSecondary },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  statusIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  social: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 4 },
  socialText: { ...type.label, color: color.text, flex: 1 },
  okPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, height: 24, borderRadius: radius.sm, borderWidth: 1, borderColor: 'rgba(52,208,122,0.4)', backgroundColor: color.successSoft },
  okText: { ...type.caption, fontSize: 12, color: color.success },
  waitText: { ...type.caption, fontSize: 12, color: color.warning },
  qual: { flexDirection: 'row', gap: space.md },
  miniValue: { ...type.heading, color: color.text, fontVariant: ['tabular-nums'] },
  link: { ...type.label, color: color.link },
  linkIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: color.accentSoft, alignItems: 'center', justifyContent: 'center' },
  cta: { marginTop: space.md, flexDirection: 'row', gap: space.md, padding: space.lg, borderRadius: radius.lg, borderWidth: 1, borderColor: 'rgba(117,178,244,0.35)',
    backgroundColor: 'rgba(12,101,196,0.10)' },
  ctaIcon: { width: 32, height: 32, borderRadius: 8, backgroundColor: color.blue, alignItems: 'center', justifyContent: 'center' },
  ctaBtn: { alignSelf: 'flex-start', marginTop: space.sm, paddingHorizontal: 16, height: 36, borderRadius: radius.sm, backgroundColor: color.blue, justifyContent: 'center' },
  ctaBtnText: { ...type.label, color: '#FFFFFF' },
  dangerBtn: { paddingHorizontal: 16, height: 36, borderRadius: radius.sm, borderWidth: 1, borderColor: 'rgba(255,90,95,0.5)', justifyContent: 'center' },
  dangerText: { ...type.label, color: color.danger },
});
