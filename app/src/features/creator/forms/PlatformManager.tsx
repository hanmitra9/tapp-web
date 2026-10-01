import { useState } from 'react';
import { showAlert } from '@/lib/alert';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/Button';
import { Chips } from '@/components/Chips';
import { Field } from '@/components/Field';
import { Notice } from '@/components/Notice';
import { TextField } from '@/components/TextField';
import { errorMessage } from '@/lib/errors';
import { color, radius, space, type } from '@/theme/tokens';
import { addPlatform, removePlatform, type LinkedPlatform } from '../api';
import { parseFollowers, parseHandle, profileUrl } from '../handles';
import { PLATFORMS, platformLabel, type Platform } from '../options';

type Props = {
  uid: string;
  platforms: LinkedPlatform[];
  onPlatforms: (next: LinkedPlatform[]) => void;
  mainPlatform: Platform | null;
  onMainPlatform: (p: Platform | null) => void;
  error?: string | null;
};

const nf = new Intl.NumberFormat('id-ID');

// Writes go straight to the server so the list always reflects what TAPP will verify.
export function PlatformManager({ uid, platforms, onPlatforms, mainPlatform, onMainPlatform, error }: Props) {
  const [adding, setAdding] = useState(platforms.length === 0);
  const [platform, setPlatform] = useState<Platform>('tiktok');
  const [handle, setHandle] = useState('');
  const [followers, setFollowers] = useState('');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const parsed = parseHandle(handle);
  const f = parseFollowers(followers);
  const dup = platforms.some((p) => p.platform === platform && p.handle.toLowerCase() === parsed?.toLowerCase());
  const handleErr = !handle.trim() ? 'Masukkan username atau link profil.' : !parsed ? 'Username tidak valid.'
    : dup ? 'Akun ini sudah ditambahkan.' : null;
  const followersErr = f === 'invalid' ? 'Masukkan angka saja.' : null;

  async function add() {
    setTouched(true);
    if (handleErr || followersErr || busy || !parsed) return;
    setBusy(true); setServerError(null);
    try {
      const row = await addPlatform(uid, { platform, handle: parsed, profile_url: profileUrl(platform, parsed), followers: f === 'invalid' ? null : f });
      const next = [...platforms, row];
      onPlatforms(next);
      if (!mainPlatform) onMainPlatform(row.platform);
      setHandle(''); setFollowers(''); setTouched(false); setAdding(false);
    } catch (e) { setServerError(errorMessage(e)); }
    finally { setBusy(false); }
  }

  function confirmRemove(p: LinkedPlatform) {
    showAlert('Hapus akun?', `${platformLabel(p.platform)} @${p.handle} akan dilepas dari profilmu.`, [
      { text: 'Batal', style: 'cancel' },
      { text: 'Hapus', style: 'destructive', onPress: async () => {
        setServerError(null);
        try {
          await removePlatform(p.id);
          const next = platforms.filter((x) => x.id !== p.id);
          onPlatforms(next);
          if (mainPlatform === p.platform && !next.some((x) => x.platform === p.platform)) onMainPlatform(next[0]?.platform ?? null);
          if (!next.length) setAdding(true);
        } catch (e) { setServerError(errorMessage(e)); }
      } },
    ]);
  }

  return (
    <View style={styles.wrap}>
      <Notice tone="error" message={serverError ?? error ?? null} />
      {platforms.length ? (
        <View style={styles.list}>
          {platforms.map((p, i) => {
            const isMain = mainPlatform === p.platform;
            return (
              <View key={p.id} style={[styles.row, i > 0 && styles.rowBorder]}>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>{platformLabel(p.platform)}  <Text style={styles.handle}>@{p.handle}</Text></Text>
                  <Text style={styles.rowMeta}>
                    {p.followers != null ? `${nf.format(p.followers)} followers` : 'Followers belum diisi'}
                    {p.verified_at ? ' · Terverifikasi' : ''}
                  </Text>
                </View>
                <Pressable onPress={() => onMainPlatform(p.platform)} hitSlop={8} accessibilityRole="radio"
                  accessibilityState={{ checked: isMain }} style={[styles.mainTag, isMain && styles.mainOn]}>
                  <Text style={[styles.mainText, isMain && styles.mainTextOn]}>{isMain ? 'Utama' : 'Jadikan utama'}</Text>
                </Pressable>
                <Pressable onPress={() => confirmRemove(p)} hitSlop={8} accessibilityRole="button"
                  accessibilityLabel={`Hapus ${platformLabel(p.platform)} @${p.handle}`}>
                  <Text style={styles.remove}>Hapus</Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      ) : null}

      {adding ? (
        <View style={styles.addBox}>
          <Field label="Platform">
            <Chips options={PLATFORMS} value={[platform]} onChange={([p]) => p && setPlatform(p as Platform)} />
          </Field>
          <TextField label="Username atau link profil" value={handle} onChangeText={setHandle} autoCapitalize="none"
            autoCorrect={false} placeholder="@namakamu" error={touched ? handleErr : null} />
          <TextField label="Jumlah followers (opsional)" value={followers} onChangeText={setFollowers}
            keyboardType="number-pad" hint="TAPP akan mengecek angka ini saat verifikasi." error={followersErr} />
          <Button label="Tambahkan akun" onPress={add} loading={busy} />
          {platforms.length ? <Button variant="quiet" label="Batal" onPress={() => { setAdding(false); setTouched(false); }} /> : null}
        </View>
      ) : (
        <Button variant="secondary" label="Tambah akun lain" onPress={() => setAdding(true)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.lg },
  list: { borderWidth: 1, borderColor: color.border, borderRadius: radius.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg },
  rowBorder: { borderTopWidth: 1, borderTopColor: color.border },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { ...type.heading, color: color.text },
  handle: { ...type.body, color: color.textSecondary },
  rowMeta: { ...type.caption, color: color.textMuted },
  mainTag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.sm },
  mainOn: { backgroundColor: color.accentSoft },
  mainText: { ...type.caption, color: color.textSecondary },
  mainTextOn: { color: color.link, fontFamily: type.label.fontFamily },
  remove: { ...type.caption, color: color.danger },
  addBox: { gap: space.lg, paddingTop: space.sm },
});
