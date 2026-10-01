import { useCallback, useEffect, useState } from 'react';
import { Linking, StyleSheet, Switch, Text, View } from 'react-native';
import { errorMessage } from '@/lib/errors';
import { color, space, type } from '@/theme/tokens';
import { disablePush, enablePush, hasRegisteredToken, pushState, type PushState } from './push';

export function NotificationToggle({ uid }: { uid: string }) {
  const [state, setState] = useState<PushState | null>(null);
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    const s = await pushState();
    setState(s); setOn(s === 'granted' && (await hasRegisteredToken()));
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function toggle(v: boolean) {
    setBusy(true); setError(null);
    try { if (v) await enablePush(uid); else await disablePush(); await load(); }
    catch (e) { setError(errorMessage(e)); await load(); }
    finally { setBusy(false); }
  }

  const note = state === 'denied' ? 'Izin notifikasi ditolak di pengaturan HP.'
    : state === 'unsupported' ? 'Notifikasi push hanya tersedia di aplikasi HP. Semua notifikasi tetap masuk ke kotak masuk.'
    : 'Submission, penghasilan, pencairan, dan campaign baru yang cocok. Semua notifikasi tetap tersimpan di kotak masuk.';
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Text style={styles.label}>Notifikasi push</Text>
        <Switch value={on} disabled={busy || state === 'unsupported' || state === null} onValueChange={toggle}
          trackColor={{ true: color.blue, false: color.borderStrong }} thumbColor={color.onAccent} accessibilityLabel="Notifikasi push" />
      </View>
      <Text style={styles.note}>{note}</Text>
      {state === 'denied' ? <Text style={styles.link} onPress={() => Linking.openSettings()}>Buka pengaturan HP</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}
const styles = StyleSheet.create({
  wrap: { gap: space.xs },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { ...type.body, color: color.text },
  note: { ...type.caption, color: color.textMuted },
  link: { ...type.label, color: color.blue },
  error: { ...type.caption, color: color.danger },
});
