import Feather from '@expo/vector-icons/Feather';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/Button';
import { Checkbox } from '@/components/Checkbox';
import { Chips } from '@/components/Chips';
import { Field } from '@/components/Field';
import { Header } from '@/components/Header';
import { LoadState } from '@/components/LoadState';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { errorMessage } from '@/lib/errors';
import { useQuery } from '@/lib/useQuery';
import { useAuth } from '@/providers/AuthProvider';
import { color, radius, space, type, card } from '@/theme/tokens';
import { fetchCampaign } from '@/features/campaigns/api';
import { fetchPlatforms } from '@/features/creator/api';
import { PLATFORMS, platformLabel, type Platform } from '@/features/creator/options';
import { fetchSubmission, resubmitContent, submitContent, uploadProof } from '@/features/submissions/api';
import { detectPlatform, publishDays } from '@/features/submissions/postUrl';
import { track } from '@/lib/analytics';

export default function Submit() {
  const { campaignId, resubmit } = useLocalSearchParams<{ campaignId: string; resubmit?: string }>();
  const { session } = useAuth();
  const uid = session!.user.id;
  useEffect(() => { track('submission_started', { campaign_id: campaignId, resubmit: !!resubmit }); }, [campaignId, resubmit]);

  const q = useQuery(async () => {
    const [c, linked, existing] = await Promise.all([
      fetchCampaign(campaignId), fetchPlatforms(uid), resubmit ? fetchSubmission(resubmit) : Promise.resolve(null),
    ]);
    return { c, linked, existing };
  }, [campaignId, resubmit, uid]);

  const [platform, setPlatform] = useState<Platform | null>(null);
  const [url, setUrl] = useState('');
  const [dayKey, setDayKey] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [shotUri, setShotUri] = useState<string | null>(null);
  const [shotPath, setShotPath] = useState<string | null>(null);   // uploaded path, reused on retry
  const [agree, setAgree] = useState(false);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const d = q.data;
  const eligible = useMemo(() => {
    if (!d) return [] as Platform[];
    const mine = new Set(d.linked.map((l) => l.platform));
    return d.c.platforms.filter((p) => mine.has(p));
  }, [d]);
  const days = useMemo(() => (d?.c.membership ? publishDays(d.c.membership.joined_at) : []), [d]);

  // Prefill: resubmission data, or the only eligible platform.
  useEffect(() => {
    if (!d) return;
    if (d.existing) { setPlatform(d.existing.platform); setUrl(d.existing.post_url); setCaption(d.existing.caption ?? ''); }
    else if (eligible.length === 1) setPlatform(eligible[0]!);
    if (days[0]) setDayKey(days[0].key);
  }, [d, eligible, days]);

  if (!d) return <Screen width="narrow" scroll={false}><Header title="Submit konten" /><LoadState error={q.error} onRetry={q.reload} /></Screen>;

  if (done) {
    return (
      <Screen width="narrow" scroll={false} footer={<Button label="Kembali ke workspace" onPress={() => router.back()} />}>
        <View style={styles.done}>
          <View style={styles.doneIcon}><Feather name="check" size={28} color={color.blue} /></View>
          <Text style={styles.doneTitle}>{resubmit ? 'Revisi terkirim' : 'Submission terkirim'}</Text>
          <Text style={styles.doneBody}>
            Tim TAPP akan memeriksa postinganmu. Kamu akan mendapat notifikasi saat disetujui atau kalau ada yang perlu diperbaiki.
            Jangan hapus atau privat postingan selama campaign berjalan.
          </Text>
        </View>
      </Screen>
    );
  }

  if (!eligible.length) {
    return (
      <Screen width="narrow" footer={<Button label="Hubungkan akun" onPress={() => router.push('/profile/socials')} />}>
        <Header title="Submit konten" />
        <Notice tone="info" message={`Campaign ini menerima ${d.c.platforms.map(platformLabel).join(', ')}. Hubungkan akunmu di platform tersebut untuk submit.`} />
      </Screen>
    );
  }

  const det = url.trim() ? detectPlatform(url) : { platform: null, error: null };
  const urlErr = !url.trim() ? 'Tempel link postinganmu.'
    : det.error ? det.error
    : platform && platform !== 'other' && det.platform && det.platform !== platform ? `Link ini dari ${platformLabel(det.platform)}, bukan ${platformLabel(platform)}.`
    : platform && platform !== 'other' && !det.platform ? `Link ini bukan link ${platformLabel(platform)}.`
    : null;
  const errs = {
    platform: platform ? null : 'Pilih platform.',
    url: urlErr,
    day: dayKey ? null : 'Pilih tanggal posting.',
    agree: agree ? null : 'Centang untuk melanjutkan.',
  };

  function onUrl(raw: string) {
    // Links copied from some apps drop the scheme; add it so "tiktok.com/@a/video/1" still works.
    const v = /^(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)+\//i.test(raw.trim()) ? `https://${raw.trim()}` : raw;
    setUrl(v);
    const p = detectPlatform(v).platform;
    if (p && eligible.includes(p)) setPlatform(p);   // auto-select from the pasted link
  }
  async function paste() {
    const text = (await Clipboard.getStringAsync()).trim();
    if (text) onUrl(text);
  }
  async function pickShot() {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 1 });
    if (res.canceled || !res.assets[0]) return;
    setShotUri(res.assets[0].uri); setShotPath(null);
  }

  async function send() {
    setTouched(true); setError(null);
    if (Object.values(errs).some(Boolean) || busy || !platform) return;
    const day = days.find((x) => x.key === dayKey)!;
    setBusy(true);
    try {
      let path = shotPath;
      if (shotUri && !path) { path = await uploadProof(uid, shotUri); setShotPath(path); }
      const input = { platform, postUrl: url, publishedAt: day.iso(), caption, screenshotPath: path };
      if (resubmit) await resubmitContent(resubmit, input); else await submitContent(campaignId, input);
      track('submission_submitted', { campaign_id: campaignId, platform, resubmit: !!resubmit, has_screenshot: !!path });
      setDone(true);
    } catch (e) { setError(errorMessage(e)); }
    finally { setBusy(false); }
  }

  const rules = d.c.rules.filter((r) => r.kind === 'submission' || r.kind === 'requirement').slice(0, 4);

  return (
    <Screen width="narrow" footer={<Button label={resubmit ? 'Kirim revisi' : 'Submit'} onPress={send} loading={busy} />}>
      <Header title={resubmit ? 'Kirim ulang' : 'Submit konten'} subtitle={d.c.title} />
      <View style={styles.form}>
        {d.existing?.review_reason ? <Notice tone="info" message={`Catatan reviewer: ${d.existing.review_reason}`} /> : null}
        <Notice tone="error" message={error} />

        <View style={styles.urlWrap}>
          <TextField label="Link postingan" value={url} onChangeText={onUrl} autoCapitalize="none" autoCorrect={false}
            keyboardType="url" placeholder="https://www.tiktok.com/@nama/video/…" style={{ paddingRight: 64 }} error={touched ? errs.url : (url.trim() ? det.error : null)} />
          <Pressable onPress={paste} style={styles.paste} hitSlop={8} accessibilityRole="button" accessibilityLabel="Tempel link">
            <Text style={styles.pasteText}>Tempel</Text>
          </Pressable>
        </View>

        <Field label="Platform" error={touched ? errs.platform : null}>
          <Chips options={PLATFORMS.filter((p) => eligible.includes(p.value))} value={platform ? [platform] : []}
            onChange={([p]) => setPlatform((p as Platform) ?? null)} />
        </Field>

        <Field label="Tanggal posting" hint="Hanya postingan setelah kamu bergabung yang dihitung." error={touched ? errs.day : null}>
          <Chips options={days.map((x) => ({ value: x.key, label: x.label }))} value={dayKey ? [dayKey] : []} onChange={([k]) => setDayKey(k ?? null)} />
        </Field>

        <Field label="Screenshot (opsional)" hint="Membantu reviewer kalau postingan sulit diakses.">
          {shotUri ? (
            <View style={styles.shotRow}>
              <Image source={{ uri: shotUri }} style={styles.shot} />
              <Pressable onPress={() => { setShotUri(null); setShotPath(null); }} hitSlop={8}><Text style={styles.remove}>Hapus</Text></Pressable>
            </View>
          ) : <Button variant="secondary" label="Pilih screenshot" onPress={pickShot} />}
        </Field>

        <TextField label="Caption (opsional)" value={caption} onChangeText={setCaption} multiline maxLength={2200}
          style={styles.multiline} placeholder="Tempel caption yang kamu pakai" />

        {rules.length ? (
          <View style={styles.rules}>
            <Text style={styles.rulesTitle}>Pastikan sebelum submit</Text>
            {rules.map((r, i) => <Text key={i} style={styles.rule}>• {r.body}</Text>)}
          </View>
        ) : null}
        <Checkbox checked={agree} onChange={setAgree} error={touched ? errs.agree : null}
          label="Postingan ini milikku, publik, dan mengikuti brief serta aturan campaign." />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: space.xl },
  urlWrap: { position: 'relative' },
  paste: { position: 'absolute', right: space.lg, top: 26 + 16 },
  pasteText: { ...type.label, color: color.link },
  shotRow: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  shot: { width: 72, height: 128, borderRadius: radius.sm, backgroundColor: color.surface },
  remove: { ...type.label, color: color.danger },
  multiline: { minHeight: 88, textAlignVertical: 'top' },
  rules: { gap: space.xs, padding: space.lg, ...card, borderRadius: radius.md },
  rulesTitle: { ...type.label, color: color.text, marginBottom: space.xs },
  rule: { ...type.caption, color: color.textSecondary },
  done: { flex: 1, justifyContent: 'center', gap: space.md },
  doneIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: color.accentSoft, alignItems: 'center', justifyContent: 'center' },
  doneTitle: { ...type.title, color: color.text, marginTop: space.md },
  doneBody: { ...type.body, color: color.textSecondary },
});
