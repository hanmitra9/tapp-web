import Feather from '@expo/vector-icons/Feather';
import * as Clipboard from 'expo-clipboard';
import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { showAlert } from '@/lib/alert';
import { color, radius, space, type, card } from '@/theme/tokens';
import { fetchReportLink, reportUrl, setReportLink } from './api';

// "Bagikan laporan": a public link to this campaign's results (views, clips, creators; no money) that the brand can
// send to a boss or client. It can be turned off; a new link makes the old one stop working.
export function ShareReport({ campaignId, title }: { campaignId: string; title: string }) {
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => { fetchReportLink(campaignId).then(setToken).catch(() => setToken(null)); }, [campaignId]);
  const url = token ? reportUrl(token) : null;

  async function run(on: boolean, renew = false) {
    setBusy(true);
    try { const t = await setReportLink(campaignId, on, renew); setToken(t); return t; }
    catch { showAlert('Gagal', 'Link laporan belum bisa diubah. Coba lagi.'); return null; }
    finally { setBusy(false); }
  }
  async function share() {
    const t = token ?? (await run(true));
    if (!t) return;
    const link = reportUrl(t);
    const nav = typeof navigator !== 'undefined' ? (navigator as Navigator & { share?: (d: ShareData) => Promise<void> }) : null;
    if (Platform.OS === 'web' && nav?.share) {
      try { await nav.share({ title: `Laporan ${title}`, url: link }); return; } catch { /* cancelled → copy instead */ }
    }
    await Clipboard.setStringAsync(link);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }
  function off() {
    showAlert('Matikan link?', 'Orang yang punya link ini tidak bisa membuka laporannya lagi.', [
      { text: 'Batal', style: 'cancel' }, { text: 'Matikan', style: 'destructive', onPress: () => { void run(false); } }]);
  }

  return (
    <View style={styles.box}>
      <View style={styles.head}>
        <Feather name="link" size={15} color={color.link} />
        <Text style={styles.title}>Laporan publik</Text>
      </View>
      <Text style={styles.body}>Kirim hasil campaign ke atasan atau klien lewat link, tanpa perlu login. Biaya tidak ditampilkan.</Text>
      {url ? <Text style={styles.url} numberOfLines={1} selectable>{url}</Text> : null}
      <View style={styles.row}>
        <Pressable onPress={share} disabled={busy || token === undefined} accessibilityRole="button"
          style={({ pressed }) => [styles.btn, styles.primary, (pressed || busy) && { opacity: 0.7 }]}>
          <Feather name={copied ? 'check' : 'share-2'} size={14} color="#fff" />
          <Text style={styles.btnText}>{copied ? 'Link disalin' : url ? 'Bagikan link' : 'Buat link'}</Text>
        </Pressable>
        {url ? (
          <>
            <Pressable onPress={() => { void run(true, true); }} disabled={busy} accessibilityRole="button" style={({ pressed }) => [styles.btn, pressed && { opacity: 0.7 }]}>
              <Text style={styles.ghostText}>Link baru</Text>
            </Pressable>
            <Pressable onPress={off} disabled={busy} accessibilityRole="button" style={({ pressed }) => [styles.btn, pressed && { opacity: 0.7 }]}>
              <Text style={[styles.ghostText, { color: color.danger }]}>Matikan</Text>
            </Pressable>
          </>
        ) : null}
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  box: { ...card, borderRadius: radius.lg, padding: space.lg, gap: space.sm, marginTop: space.lg },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { ...type.label, color: color.text, fontSize: 15 },
  body: { ...type.caption, color: color.textMuted },
  url: { ...type.caption, color: color.link },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.xs },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: space.md, paddingVertical: 8, borderRadius: radius.pill,
    borderWidth: 1, borderColor: color.borderStrong },
  primary: { backgroundColor: color.blue, borderColor: color.blue },
  btnText: { ...type.label, fontSize: 13, color: '#fff' },
  ghostText: { ...type.label, fontSize: 13, color: color.text },
});
