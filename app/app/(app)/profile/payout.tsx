import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button } from '@/components/Button';
import { Header } from '@/components/Header';
import { LoadState } from '@/components/LoadState';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { errorMessage } from '@/lib/errors';
import { useAuth } from '@/providers/AuthProvider';
import { space } from '@/theme/tokens';
import { fetchPayoutMethod, savePayoutMethod, type PayoutMethod } from '@/features/creator/api';
import { emptyPayout, normalizePayout, PayoutForm, validatePayout, type PayoutValues } from '@/features/creator/forms/PayoutForm';

export default function Payout() {
  const { session } = useAuth();
  const uid = session!.user.id;
  const [current, setCurrent] = useState<PayoutMethod | null | undefined>(undefined);
  const [form, setForm] = useState<PayoutValues>(emptyPayout(null));
  const [loadError, setLoadError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try { const m = await fetchPayoutMethod(uid); setCurrent(m); setForm(emptyPayout(m)); }
    catch (e) { setLoadError(errorMessage(e)); }
  }, [uid]);
  useEffect(() => { void load(); }, [load]);

  async function save() {
    setTouched(true); setError(null);
    if (Object.keys(validatePayout(form)).length || busy) return;
    setBusy(true);
    try { await savePayoutMethod(uid, current?.id ?? null, normalizePayout(form)); router.back(); }
    catch (e) { setError(errorMessage(e)); }
    finally { setBusy(false); }
  }

  if (current === undefined) return <Screen scroll={false}><Header title="Metode pencairan" /><LoadState error={loadError} onRetry={load} /></Screen>;
  return (
    <Screen footer={<Button label="Simpan" onPress={save} loading={busy} />}>
      <Header title="Metode pencairan" />
      <View style={styles.body}>
        <Notice tone="info" message="Perubahan berlaku untuk pencairan berikutnya. Pencairan yang sedang diproses tetap dikirim ke tujuan lama." />
        <Notice tone="error" message={error} />
        <PayoutForm values={form} onChange={setForm} showErrors={touched} />
      </View>
    </Screen>
  );
}
const styles = StyleSheet.create({ body: { gap: space.xl } });
