import Feather from '@expo/vector-icons/Feather';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { errorMessage } from '@/lib/errors';
import { disablePush, enablePush, pushState, type PushState } from '@/lib/webPush';
import { color, radius, space, type, card } from '@/theme/tokens';

const COPY: Record<PushState, { title: string; body: string; action: string | null }> = {
  off: { title: 'Notifikasi di HP', body: 'Kabar saldo masuk & deadline.', action: 'Aktifkan' },
  on: { title: 'Notifikasi aktif', body: 'Kabar saldo masuk & deadline.', action: 'Matikan' },
  denied: { title: 'Notifikasi diblokir', body: 'Izinkan di pengaturan browser.', action: null },
  ios_install: { title: 'Notifikasi di iPhone', body: 'Safari → Share → Add to Home Screen, lalu buka dari sana.', action: null },
  unsupported: { title: 'Notifikasi', body: 'Browser ini belum mendukung notifikasi.', action: null },
};

// Opt-in card for browser push. `compact` hides itself once push is on or impossible (for the home screen).
export function PushToggle({ compact = false }: { compact?: boolean }) {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { pushState().then(setState).catch(() => setState('unsupported')); }, []);
  if (!state || (compact && (state === 'on' || state === 'unsupported' || state === 'denied'))) return null;
  const c = COPY[state];

  async function toggle() {
    setBusy(true); setError(null);
    try { setState(state === 'on' ? await disablePush() : await enablePush()); }
    catch (e) { setError(errorMessage(e)); }
    finally { setBusy(false); }
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.icon}><Feather name={state === 'on' ? 'bell' : 'bell-off'} size={18} color={color.link} /></View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.title}>{c.title}</Text>
        <Text style={styles.body}>{error ?? c.body}</Text>
      </View>
      {c.action ? (
        <Pressable onPress={toggle} disabled={busy} hitSlop={8} accessibilityRole="button" style={[styles.btn, state === 'on' && styles.btnQuiet]}>
          {busy ? <ActivityIndicator size="small" color={color.text} /> : <Text style={[styles.btnText, state === 'on' && { color: color.textSecondary }]}>{c.action}</Text>}
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.md, ...card },
  icon: { width: 36, height: 36, borderRadius: 18, backgroundColor: color.accentSoft, alignItems: 'center', justifyContent: 'center' },
  title: { ...type.label, color: color.text },
  body: { ...type.caption, color: color.textSecondary, lineHeight: 18 },
  btn: { paddingHorizontal: space.md, height: 36, borderRadius: radius.pill, backgroundColor: color.blue, alignItems: 'center', justifyContent: 'center', minWidth: 84 },
  btnQuiet: { backgroundColor: color.surfaceRaised },
  btnText: { ...type.label, color: color.onAccent, fontSize: 14 },
});
