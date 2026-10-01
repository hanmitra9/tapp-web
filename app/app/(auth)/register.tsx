import { Link, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Linking, StyleSheet, Text, View, type TextInput } from 'react-native';
import { Button } from '@/components/Button';
import { Header } from '@/components/Header';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { errorMessage } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { normalizeEmail, validateEmail, validateName, validatePassword } from '@/lib/validation';
import { color, space, type } from '@/theme/tokens';
import { track } from '@/lib/analytics';

// Marketing site (privacy / terms). Set EXPO_PUBLIC_SITE_URL, e.g. https://tapp.id
const SITE_RAW = process.env.EXPO_PUBLIC_SITE_URL;
const SITE = (SITE_RAW ?? '').replace(/\/$/, '');
const openSite = (path: string) => { if (SITE_RAW !== undefined) Linking.openURL(SITE + path).catch(() => {}); };

export default function Register() {
  useEffect(() => { track('signup_started'); }, []);
  const [name, setName] = useState('');
  // Brand invites link here as /register?invite=brand&email=… so the invited address is prefilled.
  const params = useLocalSearchParams<{ email?: string; invite?: string }>();
  const isBrand = params.invite === 'brand';
  const [email, setEmail] = useState(params.email ?? '');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const errs = { name: validateName(name), email: validateEmail(email), password: validatePassword(password) };
  const valid = !errs.name && !errs.email && !errs.password;

  async function submit() {
    setTouched(true);
    if (!valid || busy) return;
    setBusy(true); setError(null);
    const addr = normalizeEmail(email);
    const { data, error: err } = await supabase.auth.signUp({
      email: addr, password, options: { data: { full_name: name.trim() } },
    });
    setBusy(false);
    if (err) return setError(errorMessage(err));
    track('signup_submitted');
    // With email confirmation on, Supabase hides existing accounts by returning a user with no identities.
    if (data.user && data.user.identities?.length === 0) return setError(errorMessage({ code: 'user_already_exists' }));
    if (!data.session) router.replace({ pathname: '/verify-email', params: { email: addr } });
    // With a session, the root guard moves the user into the app.
  }

  return (
    <Screen width="narrow" footer={<Button label="Buat akun" onPress={submit} loading={busy} />}>
      <Header title={isBrand ? 'Buat akun brand' : 'Buat akun kreator'}
        subtitle={isBrand ? 'Pakai email yang diundang tim TAPP. Setelah email terverifikasi, dashboard brand langsung terbuka.' : 'Setelah ini kamu akan melengkapi profil dan menghubungkan media sosial.'} />
      <View style={styles.form}>
      <Notice tone="error" message={error} />
      <TextField label="Nama lengkap" value={name} onChangeText={setName} autoComplete="name" textContentType="name"
        returnKeyType="next" onSubmitEditing={() => emailRef.current?.focus()} error={touched ? errs.name : null} />
      <TextField ref={emailRef} label="Email" value={email} onChangeText={setEmail} autoCapitalize="none"
        autoComplete="email" keyboardType="email-address" textContentType="emailAddress" returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()} error={touched ? errs.email : null} />
      <TextField ref={passwordRef} label="Kata sandi" value={password} onChangeText={setPassword} secure
        autoComplete="new-password" textContentType="newPassword" returnKeyType="go" onSubmitEditing={submit}
        hint="Minimal 8 karakter, dengan huruf dan angka." error={touched ? errs.password : null} />
      </View>
      <Text style={styles.foot}>
        Sudah punya akun? <Link href="/login" replace style={styles.link}>Masuk</Link>
      </Text>
      {SITE_RAW !== undefined ? (
        <Text style={styles.legal}>
          Dengan membuat akun, kamu menyetujui{' '}
          <Text style={styles.link} onPress={() => openSite('/terms')} accessibilityRole="link">Syarat Layanan</Text> dan{' '}
          <Text style={styles.link} onPress={() => openSite('/privacy')} accessibilityRole="link">Kebijakan Privasi</Text> TAPP.
        </Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  legal: { ...type.caption, color: color.textMuted, marginTop: space.lg },
  form: { gap: space.lg },
  foot: { ...type.caption, color: color.textSecondary, marginTop: space.xl },
  link: { color: color.blue, fontFamily: type.label.fontFamily },
});
