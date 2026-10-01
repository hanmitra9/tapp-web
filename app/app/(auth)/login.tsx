import { Link, router } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, Text, View, type TextInput } from 'react-native';
import { Button } from '@/components/Button';
import { Header } from '@/components/Header';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { errorMessage, isEmailNotConfirmed } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { signIn } from '@/features/auth/signIn';
import { normalizeEmail, validateEmail } from '@/lib/validation';
import { color, space, type } from '@/theme/tokens';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passwordRef = useRef<TextInput>(null);

  const emailErr = validateEmail(email);
  const pwErr = password ? null : 'Masukkan kata sandi kamu.';

  async function submit() {
    setTouched(true);
    if (emailErr || pwErr || busy) return;
    setBusy(true); setError(null);
    const addr = normalizeEmail(email);
    const r = await signIn(addr, password);
    const err = r.ok ? null : r.error;
    if (r.ok && r.needsCode) {
      setBusy(false);
      return router.push({ pathname: '/verify-email', params: { email: addr, mode: 'login' } });
    }
    if (err && isEmailNotConfirmed(err)) {
      await supabase.auth.resend({ type: 'signup', email: addr });   // best effort; screen offers resend too
      setBusy(false);
      return router.push({ pathname: '/verify-email', params: { email: addr } });
    }
    setBusy(false);
    if (err) setError(errorMessage(err));
  }

  return (
    <Screen width="narrow" footer={<Button label="Masuk" onPress={submit} loading={busy} />}>
      <Header title="Masuk" />
      <View style={styles.form}>
        <Notice tone="error" message={error} />
        <TextField label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email"
          keyboardType="email-address" textContentType="emailAddress" returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()} error={touched ? emailErr : null} />
        <TextField ref={passwordRef} label="Kata sandi" value={password} onChangeText={setPassword} secure
          autoComplete="current-password" textContentType="password" returnKeyType="go" onSubmitEditing={submit}
          error={touched ? pwErr : null} />
        <Link href={{ pathname: '/forgot-password', params: { email: normalizeEmail(email) } }} style={styles.forgot}>
          Lupa kata sandi?
        </Link>
      </View>
      <Text style={styles.foot}>
        Baru di TAPP? <Link href="/register" replace style={styles.link}>Buat akun</Link>
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: space.lg },
  forgot: { ...type.label, color: color.link, alignSelf: 'flex-start' },
  foot: { ...type.caption, color: color.textSecondary, marginTop: space.xxl },
  link: { color: color.link, fontFamily: type.label.fontFamily },
});
