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
import { useCooldown } from '@/lib/useCooldown';
import { OTP_MAX, validateOtp } from '@/lib/validation';
import { space } from '@/theme/tokens';
import { track } from '@/lib/analytics';
import { sendLoginCode } from '@/features/auth/signIn';

export default function VerifyEmail() {
  // mode=login: second step of sign-in (code emailed after the password was accepted)
  const { email, mode } = useLocalSearchParams<{ email?: string; mode?: string }>();
  const isLogin = mode === 'login';
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const cooldown = useCooldown(60);

  if (!email) {
    return (
      <Screen width="narrow" footer={<Button label="Kembali ke halaman masuk" onPress={() => router.replace('/login')} />}>
        <Header title="Verifikasi email" subtitle="Masuk dengan email dan kata sandimu untuk mendapatkan kode verifikasi baru." />
      </Screen>
    );
  }

  async function verify() {
    const err = validateOtp(code);
    if (err) return setError(err);
    setBusy(true); setError(null); setInfo(null);
    const { error: e } = await supabase.auth.verifyOtp({ email: email!, token: code, type: 'email' });
    setBusy(false);
    if (e) setError(errorMessage(e)); else if (!isLogin) track('signup_completed');
    // Success creates a session; the root guard moves the user into the app.
  }

  async function resend() {
    setError(null);
    const e = isLogin ? await sendLoginCode(email!) : (await supabase.auth.resend({ type: 'signup', email: email! })).error;
    if (e) return setError(errorMessage(e));
    cooldown.start(60);
    setInfo(`Kode baru telah dikirim ke ${email}.`);
  }

  return (
    <Screen width="narrow"
      footer={
        <>
          <Button label={isLogin ? 'Masuk' : 'Verifikasi email'} onPress={verify} loading={busy} disabled={code.length < 6} />
          <Button variant="quiet" label={cooldown.left > 0 ? `Kirim ulang dalam ${cooldown.left} detik` : 'Kirim ulang kode'}
            disabled={cooldown.left > 0} onPress={resend} />
        </>
      }
    >
      <Header title={isLogin ? 'Verifikasi masuk' : 'Verifikasi email'}
        subtitle={isLogin ? `Demi keamanan akunmu, masukkan kode yang baru kami kirim ke ${email}.` : `Masukkan kode yang dikirim ke ${email}.`} />
      <View style={styles.form}>
        <Notice tone="error" message={error} />
        <Notice tone="info" message={info} />
        <TextField label="Kode verifikasi" value={code} maxLength={OTP_MAX} keyboardType="number-pad"
          autoComplete="one-time-code" textContentType="oneTimeCode" autoFocus
          onChangeText={(v) => setCode(v.replace(/\D/g, ''))} onSubmitEditing={verify} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({ form: { gap: space.lg } });
