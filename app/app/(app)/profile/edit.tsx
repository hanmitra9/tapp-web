import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/Button';
import { Header } from '@/components/Header';
import { LoadState } from '@/components/LoadState';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { errorMessage } from '@/lib/errors';
import { validateName, validateUsername } from '@/lib/validation';
import { useAuth } from '@/providers/AuthProvider';
import { color, space, type } from '@/theme/tokens';
import { fetchCreatorProfile, updateProfile, type Audience, type CreatorProfile } from '@/features/creator/api';
import { AudienceFields } from '@/features/creator/forms/AudienceFields';
import { ContentFields, type ContentValues } from '@/features/creator/forms/ContentFields';
import { ProfileFields, type ProfileValues } from '@/features/creator/forms/ProfileFields';
import { useUsernameCheck } from '@/features/creator/forms/useUsernameCheck';

type Form = ProfileValues & ContentValues & { audience: Audience };

export default function EditProfile() {
  const { session, refreshAccount } = useAuth();
  const uid = session!.user.id;
  const [original, setOriginal] = useState<CreatorProfile | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const usernameStatus = useUsernameCheck(form?.username ?? '', original?.username ?? null);

  async function load() {
    setLoadError(null);
    try {
      const p = await fetchCreatorProfile(uid);
      setOriginal(p); setAvatarUrl(p.avatarUrl);
      setForm({ fullName: p.fullName ?? '', username: p.username ?? '', country: p.country ?? 'ID', niches: p.niches,
        categories: p.categories, experience: p.experience, contentStyle: p.contentStyle ?? '', audience: p.audience });
    } catch (e) { setLoadError(errorMessage(e)); }
  }
  useEffect(() => { void load(); }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  if (!form || !original) return <Screen scroll={false}><Header title="Ubah profil" /><LoadState error={loadError} onRetry={load} /></Screen>;
  const f = form;
  const patch = (p: Partial<Form>) => setForm((x) => (x ? { ...x, ...p } : x));

  const errs = {
    fullName: validateName(f.fullName), username: validateUsername(f.username), country: f.country ? null : 'Pilih negara.',
    categories: f.categories.length ? null : 'Pilih minimal satu jenis konten.',
    experience: f.experience ? null : 'Pilih pengalamanmu.', audience: f.audience.countries.length ? null : 'Pilih minimal satu negara.',
  };
  const invalid = Object.values(errs).some(Boolean) || usernameStatus === 'taken';

  async function save() {
    setTouched(true); setError(null);
    if (invalid || busy || !original?.mainPlatform) return;
    setBusy(true);
    try {
      await updateProfile(uid, { ...f, experience: f.experience!, mainPlatform: original.mainPlatform });
      await refreshAccount();
      router.back();
    } catch (e) { setError(errorMessage(e)); }
    finally { setBusy(false); }
  }

  return (
    <Screen footer={<Button label="Simpan perubahan" onPress={save} loading={busy} />}>
      <Header title="Ubah profil" />
      <View style={styles.body}>
        <Notice tone="error" message={error ?? (touched && invalid ? 'Periksa lagi isian yang ditandai.' : null)} />
        <ProfileFields uid={uid} values={f} onChange={patch} avatarUrl={avatarUrl} onAvatar={setAvatarUrl}
          usernameStatus={usernameStatus} errors={touched ? errs : {}} />
        <Text style={styles.section}>Konten</Text>
        <ContentFields values={f} onChange={patch} errors={touched ? errs : {}} />
        <Text style={styles.section}>Penonton</Text>
        <AudienceFields value={f.audience} onChange={(audience) => patch({ audience })} error={touched ? errs.audience : null} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.xl },
  section: { ...type.heading, color: color.text, marginTop: space.lg, paddingTop: space.xl, borderTopWidth: 1, borderTopColor: color.border },
});
