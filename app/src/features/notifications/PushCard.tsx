import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { errorMessage } from '@/lib/errors';
import { color, radius, space, type } from '@/theme/tokens';
import { enablePush, pushState } from './push';

const DISMISS_KEY = 'tapp:push-card-dismissed';

// One contextual ask (not at app launch). Dismissible; never shown again once handled.
export function PushCard({ uid }: { uid: string }) {
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    Promise.all([pushState(), AsyncStorage.getItem(DISMISS_KEY)]).then(([s, d]) => setShow(s === 'undetermined' && !d)).catch(() => {});
  }, []);
  if (!show) return null;
  const dismiss = () => { setShow(false); AsyncStorage.setItem(DISMISS_KEY, '1').catch(() => {}); };
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Jangan lewatkan kabar penting</Text>
      <Text style={styles.body}>Dapat notifikasi saat submission disetujui, penghasilan masuk, dan pencairan dikirim.</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.actions}>
        <Pressable disabled={busy} onPress={async () => {
          setBusy(true); setError(null);
          try { await enablePush(uid); dismiss(); } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
        }} hitSlop={8}><Text style={styles.primary}>{busy ? 'Mengaktifkan…' : 'Aktifkan notifikasi'}</Text></Pressable>
        <Pressable onPress={dismiss} hitSlop={8}><Text style={styles.secondary}>Nanti</Text></Pressable>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  card: { marginTop: space.lg, padding: space.lg, borderRadius: radius.md, backgroundColor: color.accentSoft, gap: space.xs },
  title: { ...type.label, color: color.text },
  body: { ...type.caption, color: color.textSecondary },
  error: { ...type.caption, color: color.danger },
  actions: { flexDirection: 'row', gap: space.xl, marginTop: space.sm },
  primary: { ...type.label, color: color.blue },
  secondary: { ...type.label, color: color.textMuted },
});
