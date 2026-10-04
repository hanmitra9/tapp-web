import Feather from '@expo/vector-icons/Feather';
import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Platform, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/Button';
import { Header } from '@/components/Header';
import { LoadState } from '@/components/LoadState';
import { Screen } from '@/components/Screen';
import { track } from '@/lib/analytics';
import { dateLabel, idr } from '@/lib/format';
import { useQuery } from '@/lib/useQuery';
import { color, radius, space, type, card } from '@/theme/tokens';
import { fetchReferral, inviteLink } from '@/features/referral/api';

// "Ajak teman": invite link, how the bonus works, and who joined through it.
export default function ReferralScreen() {
  const q = useQuery(fetchReferral, []);
  const [copied, setCopied] = useState(false);
  if (!q.data) return <Screen scroll={false}><Header title="Ajak teman" /><LoadState error={q.error} onRetry={q.reload} /></Screen>;
  const r = q.data;
  const link = inviteLink(r.code);

  async function share() {
    const text = `Gabung TAPP: bikin clip dari campaign brand, dibayar dari views. Daftar pakai link aku: ${link}`;
    track('referral_shared');
    const nav = typeof navigator !== 'undefined' ? (navigator as Navigator & { share?: (d: ShareData) => Promise<void> }) : null;
    if (Platform.OS === 'web' && nav?.share) {
      try { await nav.share({ title: 'TAPP', text, url: link }); return; } catch { /* cancelled → copy instead */ }
    }
    await copy();
  }
  async function copy() {
    await Clipboard.setStringAsync(link);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Screen refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={q.refresh} tintColor={color.blue} />}>
      <Header title="Ajak teman" subtitle={`Dapat ${idr(r.bonus)} untuk setiap teman yang pencairan pertamanya sudah dibayar.`} />

      <View style={styles.hero}>
        <Text style={styles.label}>Kode undanganmu</Text>
        <Text style={styles.code} selectable>{r.code}</Text>
        <Pressable onPress={copy} style={styles.linkBox} accessibilityRole="button" accessibilityLabel="Salin link undangan">
          <Text style={styles.link} numberOfLines={1}>{link.replace(/^https?:\/\//, '')}</Text>
          <Feather name={copied ? 'check' : 'copy'} size={16} color={copied ? color.success : color.link} />
        </Pressable>
        <Button label="Bagikan link" onPress={share} />
      </View>

      <View style={styles.stats}>
        <Stat label="Teman bergabung" value={String(r.invited)} />
        <Stat label="Bonus didapat" value={idr(r.earned)} />
      </View>
      {r.available > 0 ? <Text style={styles.note}>{idr(r.available)} bonus referral ikut ditambahkan di pencairanmu berikutnya.</Text> : null}

      <Text style={styles.section}>Cara kerjanya</Text>
      {[`Bagikan link atau kode ke teman yang belum punya akun TAPP.`, 'Temanmu daftar lewat link itu dan mulai submit klip.',
        `Saat pencairan pertamanya dibayar, kamu dapat ${idr(r.bonus)}. Bonus ikut cair di pencairanmu berikutnya.`].map((t, i) => (
        <View key={t} style={styles.step}><Text style={styles.stepNum}>{i + 1}</Text><Text style={styles.stepText}>{t}</Text></View>
      ))}

      <Text style={styles.section}>Teman kamu</Text>
      {r.friends.length ? r.friends.map((f, i) => (
        <View key={`${f.joined_at}-${i}`} style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>{f.name}</Text>
            <Text style={styles.rowMeta}>Bergabung {dateLabel(f.joined_at)}</Text>
          </View>
          <Text style={[styles.badge, f.rewarded ? styles.badgeOk : null]}>{f.rewarded ? `+${idr(r.bonus)}` : 'Belum cair'}</Text>
        </View>
      )) : <Text style={styles.empty}>Belum ada teman yang bergabung lewat link-mu.</Text>}
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <View style={styles.stat}><Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  hero: { padding: space.xl, gap: space.md, borderRadius: radius.lg, ...card },
  label: { ...type.caption, color: color.textMuted },
  code: { ...type.display, color: color.text, letterSpacing: 4 },
  linkBox: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, height: 44, borderRadius: radius.sm, backgroundColor: color.bg, borderWidth: 1, borderColor: color.border },
  link: { ...type.caption, color: color.textSecondary, flex: 1 },
  stats: { flexDirection: 'row', gap: space.sm, marginTop: space.lg },
  stat: { flex: 1, padding: space.lg, gap: 4, borderRadius: radius.md, ...card },
  statValue: { ...type.title, color: color.text, fontVariant: ['tabular-nums'] },
  statLabel: { ...type.caption, color: color.textMuted },
  note: { ...type.caption, color: color.link, marginTop: space.md },
  section: { ...type.heading, color: color.text, marginTop: space.xxl, marginBottom: space.md },
  step: { flexDirection: 'row', gap: space.md, marginBottom: space.md },
  stepNum: { ...type.label, color: color.link, width: 16 },
  stepText: { ...type.body, color: color.textSecondary, flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: color.border },
  rowTitle: { ...type.label, color: color.text },
  rowMeta: { ...type.caption, color: color.textMuted },
  badge: { ...type.caption, color: color.textSecondary, paddingHorizontal: space.sm, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: color.surfaceRaised, overflow: 'hidden' },
  badgeOk: { color: color.success, backgroundColor: color.successSoft },
  empty: { ...type.body, color: color.textMuted },
});
