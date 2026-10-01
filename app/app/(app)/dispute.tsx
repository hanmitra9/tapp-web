import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button } from '@/components/Button';
import { Header } from '@/components/Header';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { errorMessage } from '@/lib/errors';
import { useAuth } from '@/providers/AuthProvider';
import { space } from '@/theme/tokens';
import { createDispute } from '@/features/support/api';
import { track } from '@/lib/analytics';

// Objection to a rejected/flagged submission or a rejected payout. One open objection per item (DB-enforced).
export default function DisputeScreen() {
  const { submission, payout, reason: prior } = useLocalSearchParams<{ submission?: string; payout?: string; reason?: string }>();
  const { session } = useAuth();
  const [text, setText] = useState('');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const invalid = text.trim().length < 10 ? 'Jelaskan alasanmu (minimal 10 karakter).' : null;

  async function send() {
    setTouched(true); setError(null);
    if (invalid || busy || (!submission && !payout)) return;
    setBusy(true);
    try {
      await createDispute(session!.user.id, { submissionId: submission, payoutId: payout }, text);
      track('dispute_submitted', { target: submission ? 'submission' : 'payout' });
      router.replace('/help');
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }

  return (
    <Screen width="narrow" footer={<Button label="Kirim keberatan" onPress={send} loading={busy} />}>
      <Header title="Ajukan keberatan" subtitle="Tim TAPP akan meninjau ulang. Kamu akan mendapat notifikasi saat ada keputusan." />
      <View style={styles.form}>
        {prior ? <Notice tone="info" message={`Alasan sebelumnya: ${prior}`} /> : null}
        <Notice tone="error" message={error} />
        <TextField label="Kenapa keputusan ini perlu ditinjau ulang?" value={text} onChangeText={setText} multiline maxLength={2000}
          style={styles.multiline} placeholder="Contoh: postingan saya masih publik dan sudah sesuai brief, ini link-nya…"
          error={touched ? invalid : null} hint={`${text.length}/2000`} />
      </View>
    </Screen>
  );
}
const styles = StyleSheet.create({ form: { gap: space.xl }, multiline: { minHeight: 160, textAlignVertical: 'top' } });
