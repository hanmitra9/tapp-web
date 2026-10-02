import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/Button';
import { Notice } from '@/components/Notice';
import { errorMessage } from '@/lib/errors';
import { color, radius, space, type } from '@/theme/tokens';
import { checkBio, issueBioCode, requestBioReview, type BioStatus, type LinkedPlatform } from '../api';

const LABEL: Record<string, string> = { tiktok: 'TikTok', instagram: 'Instagram' };

// "Verifikasi lewat kode bio": put a TAPP code in the TikTok / Instagram bio, then let TAPP read it.
export function BioVerify({ p, onVerified }: { p: LinkedPlatform; onVerified: () => void }) {
  const label = LABEL[p.platform] ?? p.platform;
  const [code, setCode] = useState<string | null>(p.bio_code ?? null);
  const [status, setStatus] = useState<BioStatus | null>(p.bio_status ?? null);
  const [busy, setBusy] = useState<'code' | 'check' | 'review' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function getCode() {
    setBusy('code'); setError(null);
    try { const r = await issueBioCode(p.id); setCode(r.code); setStatus(r.status); }
    catch (e) { setError(errorMessage(e)); } finally { setBusy(null); }
  }
  async function check() {
    setBusy('check'); setError(null);
    try { const s = await checkBio(p.id); setStatus(s); if (s === 'verified') onVerified(); }
    catch (e) { setError(errorMessage(e)); } finally { setBusy(null); }
  }
  async function review() {
    setBusy('review'); setError(null);
    try { await requestBioReview(p.id); setStatus('review'); }
    catch (e) { setError(errorMessage(e)); } finally { setBusy(null); }
  }
  async function copy() {
    try { await navigator.clipboard.writeText(code ?? ''); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* clipboard blocked */ }
  }

  const note = status === 'not_found' ? `Kode belum ditemukan di bio @${p.handle}. Pastikan sudah disimpan, lalu cek lagi.`
    : status === 'review' ? 'Bio sedang dicek manual oleh tim TAPP, biasanya kurang dari 1x24 jam. Biarkan kodenya tetap di bio.'
    : status === 'rejected' ? `Tim TAPP belum menemukan kodenya${p.bio_note ? `: ${p.bio_note}` : '.'} Tempel kodenya lagi, lalu cek ulang.`
    : null;

  return (
    <View style={styles.box}>
      <Text style={styles.title}>Verifikasi {label} @{p.handle}</Text>
      {!code ? (
        <>
          <Text style={styles.body}>Buktikan akun ini milikmu: dapatkan kode, tempel di bio {label}, lalu kami cek otomatis.</Text>
          <Button label="Dapatkan kode bio" onPress={getCode} loading={busy === 'code'} />
        </>
      ) : (
        <>
          <Text style={styles.body}>1. Salin kode ini dan tempel di bio {label}-mu.{'\n'}2. Simpan profilnya, lalu tekan Cek bio.</Text>
          <Pressable onPress={copy} style={styles.codeBox} accessibilityRole="button" accessibilityLabel={`Salin kode ${code}`}>
            <Text style={styles.code} selectable>{code}</Text>
            <Text style={styles.copy}>{copied ? 'Tersalin' : 'Salin'}</Text>
          </Pressable>
          {note ? <Notice tone={status === 'review' ? 'info' : 'error'} message={note} /> : null}
          <Notice tone="error" message={error} />
          <Button label="Cek bio sekarang" onPress={check} loading={busy === 'check'} disabled={busy !== null && busy !== 'check'} />
          <View style={styles.links}>
            {p.profile_url ? <Text style={styles.link} onPress={() => Linking.openURL(p.profile_url!)}>Buka profil {label}</Text> : null}
            {status !== 'review' ? <Text style={styles.link} onPress={review}>{busy === 'review' ? 'Mengirim…' : 'Minta cek manual'}</Text> : null}
          </View>
        </>
      )}
      {!code ? <Notice tone="error" message={error} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: space.md, padding: space.lg, marginTop: space.lg, borderRadius: radius.md, borderWidth: 1, borderColor: color.border, backgroundColor: color.surface },
  title: { ...type.heading, color: color.text },
  body: { ...type.caption, color: color.textSecondary, lineHeight: 20 },
  codeBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: space.md, paddingHorizontal: space.lg,
    borderRadius: radius.md, borderWidth: 1, borderColor: color.blue, backgroundColor: color.accentSoft },
  code: { ...type.heading, fontSize: 22, letterSpacing: 2, color: color.text, fontVariant: ['tabular-nums'] },
  copy: { ...type.label, color: color.link },
  links: { flexDirection: 'row', gap: space.xl, flexWrap: 'wrap' },
  link: { ...type.label, color: color.link },
});
