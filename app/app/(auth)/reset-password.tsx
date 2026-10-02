import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type TextInput } from 'react-native';
import { Button } from '@/components/Button';
import { Header } from '@/components/Header';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { errorMessage } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { useCooldown } from '@/lib/useCooldown';
import { OTP_MAX, validateOtp, validatePassword } from '@/lib/validation';
import { useAuth } from '@/providers/AuthProvider';
import { space } from '@/theme/tokens';

export default function ResetPassword() {
  const { email } = useLocalSearchParams<{ email?: string }>();
  const { setRecovering } = useAuth();
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const verified = useRef(false);   // code already exchanged for a recovery session
  const done = useRef(false);
  const passwordRef = useRef<TextInput>(null);
  const cooldown = useCooldown(60);

  // Leaving mid-recovery must not leave a half-authenticated session on the device.
  useEffect(() => () => {
    if (verified.current && !done.current) { void supabase.auth.signOut({ scope: 'local' }); }
    setRecovering(false);
  }, [setRecovering]);

  if (!email) return <Redirect href="/forgot-password" />;

  const errs = { code: verified.current ? null : validateOtp(code), password: validatePassword(password) };

  async function submit() {
    setTouched(true);
    if (errs.code || errs.password || busy) return;
    setBusy(true); setError(null); setInfo(null);
    if (!verified.current) {
      setRecovering(true);                                   // hold the user here once the session appears
      const { error: e } = await supabase.auth.verifyOtp({ email: email!, token: code, type: 'recovery' });
      if (e) { setRecovering(false); setBusy(false); return setError(errorMessage(e)); }
      verified.current = true;
    }
    const { error: e } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (e) return setError(errorMessage(e));                 // code stays verified; user can fix the password and retry
    done.current = true;
    setRecovering(false);                                    // guard now routes into the app, signed in
  }

  async function resend() {
    const { error: e } = await supabase.auth.resetPasswordForEmail(email!);
    if (e) return setError(errorMessage(e));
    cooldown.start(60);
    setInfo(`Kode baru telah dikirim ke ${email}.`);
  }

  return (
    <Screen width="narrow"
      footer={
        <>
          <Button label="Simpan kata sandi baru" onPress={submit} loading={busy} />
          {!verified.current ? (
            <Button variant="quiet" label={cooldown.left > 0 ? `Kirim ulang dalam ${cooldown.left} detik` : 'Kirim ulang kode'}
              disabled={cooldown.left > 0} onPress={resend} />
          ) : null}
        </>
      }
    >
      <Header title="Buat kata sandi baru" subtitle={`Masukkan kode yang dikirim ke ${email}, lalu buat kata sandi baru.`} />
      <View style={styles.form}>
        <Notice tone="error" message={error} />
        <Notice tone="info" message={info} />
        {!verified.current ? (
          <TextField label="Kode reset" value={code} maxLength={OTP_MAX} keyboardType="number-pad"
            autoComplete="one-time-code" textContentType="oneTimeCode" autoFocus returnKeyType="next"
            onChangeText={(v) => setCode(v.replace(/\D/g, ''))} onSubmitEditing={() => passwordRef.current?.focus()}
            error={touched ? errs.code : null} />
        ) : null}
        <TextField ref={passwordRef} label="Kata sandi baru" value={password} onChangeText={setPassword} secure
          autoComplete="new-password" textContentType="newPassword" returnKeyType="go" onSubmitEditing={submit}
          hint="Minimal 8 karakter, dengan huruf dan angka." error={touched ? errs.password : null} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({ form: { gap: space.lg } });
