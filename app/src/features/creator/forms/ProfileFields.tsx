import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '@/components/Avatar';
import { Chips } from '@/components/Chips';
import { Field } from '@/components/Field';
import { Notice } from '@/components/Notice';
import { TextField } from '@/components/TextField';
import { errorMessage } from '@/lib/errors';
import { color, space, type } from '@/theme/tokens';
import { uploadAvatar } from '../api';
import { COUNTRIES } from '../options';
import type { UsernameStatus } from './useUsernameCheck';

export type ProfileValues = { fullName: string; username: string; country: string };
type Props = {
  uid: string;
  values: ProfileValues;
  onChange: (patch: Partial<ProfileValues>) => void;
  avatarUrl: string | null;
  onAvatar: (url: string) => void;
  usernameStatus: UsernameStatus;
  errors: Partial<Record<keyof ProfileValues, string | null>>;
};

const USERNAME_HINT: Partial<Record<UsernameStatus, string>> = {
  checking: 'Mengecek…', available: 'Username tersedia', unknown: 'Belum bisa dicek. Akan dicek lagi saat disimpan.',
};

export function ProfileFields({ uid, values, onChange, avatarUrl, onAvatar, usernameStatus, errors }: Props) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function pick() {
    setUploadError(null);
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', allowsEditing: true, aspect: [1, 1], quality: 1 });
    if (res.canceled || !res.assets[0]) return;
    setUploading(true);
    try { onAvatar(await uploadAvatar(uid, res.assets[0].uri)); }
    catch (e) { setUploadError(errorMessage((e as { code?: string })?.code ? e : { code: 'upload_failed' })); }
    finally { setUploading(false); }
  }

  const usernameError = errors.username ?? (usernameStatus === 'taken' ? 'Username ini sudah dipakai.' : null);

  return (
    <View style={styles.form}>
      <View style={styles.avatarRow}>
        <Avatar uri={avatarUrl} name={values.fullName} size={72} />
        <Pressable onPress={pick} disabled={uploading} hitSlop={8} accessibilityRole="button">
          {uploading ? <ActivityIndicator color={color.blue} /> : (
            <Text style={styles.link}>{avatarUrl ? 'Ganti foto' : 'Tambah foto'}</Text>
          )}
        </Pressable>
      </View>
      <Notice tone="error" message={uploadError} />
      <TextField label="Nama lengkap" value={values.fullName} onChangeText={(v) => onChange({ fullName: v })}
        autoComplete="name" textContentType="name" error={errors.fullName} />
      <TextField label="Username" value={values.username} autoCapitalize="none" autoCorrect={false}
        onChangeText={(v) => onChange({ username: v.toLowerCase().replace(/\s/g, '') })}
        hint={USERNAME_HINT[usernameStatus] ?? 'Huruf kecil, angka, titik, atau garis bawah. 3–24 karakter.'}
        error={usernameError} />
      <Field label="Negara tempat tinggal" error={errors.country}>
        <Chips options={COUNTRIES} value={values.country ? [values.country] : []} onChange={([c]) => onChange({ country: c ?? '' })} />
      </Field>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: space.xl },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  link: { ...type.label, color: color.link },
});
