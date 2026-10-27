import Feather from '@expo/vector-icons/Feather';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { useQuery } from '@/lib/useQuery';
import { useAuth } from '@/providers/AuthProvider';
import { color, radius, space, type, card } from '@/theme/tokens';
import { BRAND_WA, fetchMyBrands, setDailyReport } from '@/features/brand/api';
import { errorMessage } from '@/lib/errors';

const ROLE = { owner: 'Pemilik', member: 'Anggota', viewer: 'Hanya lihat' } as const;

// Brand account: who's signed in, brand access, daily email report, the account manager, sign out.
export default function BrandAccount() {
  const { session, signOut } = useAuth();
  const q = useQuery(fetchMyBrands, []);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  async function toggle(id: string, on: boolean) {
    setBusy(id); setErr(null);
    q.setData((xs) => xs?.map((b) => (b.id === id ? { ...b, daily_report: on } : b)) ?? xs);
    try { await setDailyReport(id, on); } catch (e) { setErr(errorMessage(e)); await q.reload(); } finally { setBusy(null); }
  }
  const main = q.data?.[0];
  const email = session?.user.email ?? '';

  return (
    <Screen inTabs>
      <Header title="Akun" back={false} />
      <LinearGradient colors={['#0F2C55', '#0B1830', '#0A0F1C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{(main?.name ?? email).charAt(0).toUpperCase()}</Text></View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.name} numberOfLines={1}>{main?.name ?? ' '}</Text>
          <Text style={styles.email} numberOfLines={1}>{email}</Text>
        </View>
        {main ? <Text style={styles.role}>{ROLE[main.role]}</Text> : null}
      </LinearGradient>

      {q.data && q.data.length > 1 ? (
        <View style={styles.group}>
          <Text style={styles.groupTitle}>Brand</Text>
          {q.data.map((b, i) => (
            <View key={b.id} style={[styles.row, i === q.data!.length - 1 && styles.rowLast]}>
              <Text style={styles.rowText}>{b.name}</Text><Text style={styles.muted}>{ROLE[b.role]}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.group}>
        <Text style={styles.groupTitle}>Laporan harian</Text>
        {q.data?.map((b, i) => (
          <View key={`r-${b.id}`} style={[styles.row, i === q.data!.length - 1 && styles.rowLast]}>
            <View style={styles.rowIcon}><Feather name="mail" size={16} color={color.link} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowText}>{q.data!.length > 1 ? b.name : 'Email tiap pagi'}</Text>
              <Text style={styles.muted}>08.00 WIB</Text>
            </View>
            <Switch value={b.daily_report} disabled={busy === b.id} onValueChange={(on) => void toggle(b.id, on)}
              trackColor={{ false: color.surfaceRaised, true: color.blue }} thumbColor={color.text} accessibilityLabel={`Laporan harian ${b.name}`} />
          </View>
        ))}
        {err ? <Text style={[styles.muted, { color: color.danger, padding: space.md }]}>{err}</Text> : null}
      </View>

      <View style={styles.group}>
        <Text style={styles.groupTitle}>Account manager</Text>
        <Action icon="message-circle" label="Campaign baru / tanya" onPress={() => void Linking.openURL(BRAND_WA)} />
        <Action icon="rotate-ccw" label="Refund sisa budget" onPress={() => void Linking.openURL(`${BRAND_WA}?text=${encodeURIComponent(`Halo TAPP, saya mau refund sisa budget${main ? ` (${main.name})` : ''}.`)}`)} last />
      </View>

      <Pressable onPress={signOut} accessibilityRole="button" style={({ pressed }) => [styles.out, pressed && { opacity: 0.7 }]}>
        <Feather name="log-out" size={18} color={color.danger} /><Text style={styles.outText}>Keluar</Text>
      </Pressable>
    </Screen>
  );
}

function Action({ icon, label, onPress, last }: { icon: 'plus-circle' | 'message-circle' | 'rotate-ccw'; label: string; onPress: () => void; last?: boolean }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="link" style={({ pressed }) => [styles.row, last && styles.rowLast, pressed && { backgroundColor: 'rgba(255,255,255,0.03)' }]}>
      <View style={[styles.rowIcon, { backgroundColor: 'rgba(37,211,102,0.12)' }]}><Feather name={icon} size={16} color="#25D366" /></View>
      <Text style={[styles.rowText, { flex: 1 }]}>{label}</Text>
      <Feather name="chevron-right" size={18} color={color.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.xl, borderRadius: radius.xl, borderWidth: 1, borderColor: 'rgba(117,178,244,0.18)' },
  avatar: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: color.blue },
  avatarText: { ...type.title, fontSize: 24, color: '#FFFFFF' },
  name: { ...type.heading, fontSize: 20, color: color.text },
  email: { ...type.caption, color: color.textSecondary },
  role: { ...type.caption, fontSize: 12, color: color.link, backgroundColor: color.accentSoft, paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: radius.pill, overflow: 'hidden' },
  group: { marginTop: space.xl, ...card, borderRadius: radius.lg, overflow: 'hidden' },
  groupTitle: { ...type.caption, color: color.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, paddingHorizontal: space.lg, paddingTop: space.lg, paddingBottom: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: color.border },
  rowLast: { borderBottomWidth: 0 },
  rowIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: color.accentSoft },
  rowText: { ...type.label, color: color.text },
  muted: { ...type.caption, color: color.textMuted },
  out: { marginTop: space.xl, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, height: 50, borderRadius: radius.pill,
    borderWidth: 1, borderColor: 'rgba(255,90,95,0.3)' },
  outText: { ...type.label, color: color.danger },
});
