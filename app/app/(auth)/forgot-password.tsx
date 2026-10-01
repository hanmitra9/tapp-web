import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button } from '@/components/Button';
import { Header } from '@/components/Header';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { errorMessage } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { normalizeEmail, validateEmail } from '@/lib/validation';
import { space } from '@/theme/tokens';

export default function ForgotPassword() {
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email ?? '');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const emailErr = validateEmail(email);

  async function submit() {
    setTouched(true);
    if (emailErr || busy) return;
    setBusy(true); setError(null);
    const addr = normalizeEmail(email);
    const { error: e } = await supabase.auth.resetPasswordForEmail(addr);
    setBusy(false);
    if (e) return setError(errorMessage(e));
    // Same next step whether or not the account exists, so emails can't be enumerated.
    router.replace({ pathname: '/reset-password', params: { email: addr } });
  }

  return (
    <Screen width="narrow" footer={<Button label="Kirim kode reset" onPress={submit} loading={busy} />}>
      <Header title="Reset kata sandi" subtitle="Kami akan mengirim kode 6 digit ke email kamu." />
      <View style={styles.form}>
        <Notice tone="error" message={error} />
        <TextField label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email"
          keyboardType="email-address" textContentType="emailAddress" returnKeyType="send" onSubmitEditing={submit}
          error={touched ? emailErr : null} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({ form: { gap: space.lg } });
