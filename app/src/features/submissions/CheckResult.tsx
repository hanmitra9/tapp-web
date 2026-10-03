import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { color, card, radius, space, type } from '@/theme/tokens';
import type { SubmissionCheck } from './api';

const nf = new Intl.NumberFormat('id-ID');
const TEXT: Record<SubmissionCheck['status'], { title: string; tone: string }> = {
  ok: { title: 'Link terverifikasi', tone: color.success },
  not_owner: { title: 'Postingan bukan dari akunmu', tone: color.danger },
  not_found: { title: 'Postingan tidak ditemukan', tone: color.danger },
  unreadable: { title: 'Dicek manual oleh tim TAPP', tone: color.warning },
};

// Result of the automatic link check shown right after submitting.
export function CheckResult({ check }: { check: SubmissionCheck | null | 'checking' }) {
  if (check === null) return null;
  if (check === 'checking') {
    return (
      <View style={styles.box}>
        <ActivityIndicator color={color.blueLight} />
        <Text style={styles.body}>Mengecek link postinganmu…</Text>
      </View>
    );
  }
  const t = TEXT[check.status];
  const lines = [
    check.author ? `Akun: @${check.author}` : null,
    check.views != null ? `Views saat ini: ${nf.format(check.views)}` : null,
    check.likes != null ? `Likes: ${nf.format(check.likes)}` : null,
  ].filter(Boolean).join(' · ');
  const hint = check.status === 'not_owner' ? 'Submit ulang dengan link dari akun yang terhubung di profilmu, kalau tidak klip ini akan ditolak.'
    : check.status === 'not_found' ? 'Pastikan postingannya publik dan link-nya benar. Tim TAPP akan memeriksa ulang.'
    : check.status === 'unreadable' ? check.note ?? 'Platform tidak bisa dibaca otomatis. Tim TAPP akan mengeceknya.'
    : 'Postingan ditemukan dan milik akunmu. Tinggal menunggu review tim TAPP.';
  return (
    <View style={[styles.box, { borderColor: t.tone }]}>
      <View style={[styles.dot, { backgroundColor: t.tone }]} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={styles.title}>{t.title}</Text>
        {lines ? <Text style={styles.meta}>{lines}</Text> : null}
        <Text style={styles.body}>{hint}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { ...card, flexDirection: 'row', gap: space.md, alignItems: 'flex-start', padding: space.lg, borderRadius: radius.md, marginTop: space.md },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 6 },
  title: { ...type.label, color: color.text },
  meta: { ...type.caption, color: color.text, fontVariant: ['tabular-nums'] },
  body: { ...type.caption, color: color.textSecondary, lineHeight: 19 },
});
