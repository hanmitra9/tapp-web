import { useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/Button';
import { Chips } from '@/components/Chips';
import { Field } from '@/components/Field';
import { Header } from '@/components/Header';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { StatusBadge } from '@/components/StatusBadge';
import { TextField } from '@/components/TextField';
import { errorMessage } from '@/lib/errors';
import { dateLabel } from '@/lib/format';
import { useQuery } from '@/lib/useQuery';
import { useAuth } from '@/providers/AuthProvider';
import { color, radius, space, type } from '@/theme/tokens';
import { CATEGORIES, createTicket, DISPUTE_STATUS, fetchHelp, TICKET_STATUS, type TicketCategory } from '@/features/support/api';
import { track } from '@/lib/analytics';

export default function Help() {
  const { session } = useAuth();
  const q = useQuery(fetchHelp, []);
  const [composing, setComposing] = useState(false);
  const [category, setCategory] = useState<TicketCategory | null>(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const errs = {
    category: category ? null : 'Pilih topik.',
    subject: subject.trim().length >= 3 ? null : 'Minimal 3 karakter.',
    body: body.trim().length >= 10 ? null : 'Ceritakan sedikit lebih detail (minimal 10 karakter).',
  };
  async function send() {
    setTouched(true); setError(null);
    if (errs.category || errs.subject || errs.body || busy) return;
    setBusy(true);
    try {
      await createTicket(session!.user.id, { category: category!, subject, body });
      track('support_ticket_created', { category });
      setComposing(false); setSent(true); setSubject(''); setBody(''); setCategory(null); setTouched(false);
      await q.reload();
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }

  return (
    <Screen refreshControl={<RefreshControl refreshing={q.refreshing} onRefresh={q.refresh} tintColor={color.blue} />}
      footer={composing ? <Button label="Kirim pertanyaan" onPress={send} loading={busy} />
        : <Button label="Tanya tim TAPP" onPress={() => { setComposing(true); setSent(false); }} />}>
      <Header title="Bantuan" subtitle="Tim TAPP biasanya membalas dalam 1 hari kerja. Balasan masuk ke notifikasi dan halaman ini." />
      {sent ? <Notice tone="info" message="Pertanyaan terkirim. Kami akan mengabari lewat notifikasi." /> : null}
      {q.error && !q.data ? <Notice tone="error" message={q.error} /> : null}

      {composing ? (
        <View style={styles.form}>
          <Notice tone="error" message={error} />
          <Field label="Topik" error={touched ? errs.category : null}>
            <Chips options={CATEGORIES} value={category ? [category] : []} onChange={([c]) => setCategory((c as TicketCategory) ?? null)} />
          </Field>
          <TextField label="Judul" value={subject} onChangeText={setSubject} maxLength={120} error={touched ? errs.subject : null} />
          <TextField label="Pertanyaan" value={body} onChangeText={setBody} multiline maxLength={4000} style={styles.multiline}
            hint="Sertakan nama campaign atau link postingan kalau berhubungan." error={touched ? errs.body : null} />
          <Button variant="quiet" label="Batal" onPress={() => setComposing(false)} />
        </View>
      ) : null}

      {q.data?.disputes.length ? <Text style={styles.section}>Keberatan</Text> : null}
      {q.data?.disputes.map((d) => (
        <View key={d.id} style={styles.item}>
          <View style={styles.head}>
            <Text style={styles.title}>{d.submission_id ? 'Keberatan submission' : 'Keberatan pencairan'}</Text>
            <StatusBadge label={DISPUTE_STATUS[d.status]} tone={d.status === 'resolved' ? 'success' : d.status === 'rejected' ? 'danger' : 'neutral'} />
          </View>
          <Text style={styles.meta}>{dateLabel(d.created_at)}</Text>
          <Text style={styles.body}>{d.reason}</Text>
          {d.resolution ? <View style={styles.reply}><Text style={styles.replyLabel}>Keputusan tim TAPP</Text><Text style={styles.body}>{d.resolution}</Text></View> : null}
        </View>
      ))}

      {q.data?.tickets.length ? <Text style={styles.section}>Pertanyaan</Text> : null}
      {q.data?.tickets.map((t) => (
        <View key={t.id} style={styles.item}>
          <View style={styles.head}>
            <Text style={styles.title} numberOfLines={1}>{t.subject}</Text>
            <StatusBadge label={TICKET_STATUS[t.status]} tone={t.status === 'resolved' ? 'success' : t.status === 'pending' ? 'warning' : 'neutral'} />
          </View>
          <Text style={styles.meta}>{CATEGORIES.find((c) => c.value === t.category)?.label} · {dateLabel(t.created_at)}</Text>
          <Text style={styles.body}>{t.body}</Text>
          {t.admin_reply ? <View style={styles.reply}><Text style={styles.replyLabel}>Balasan tim TAPP</Text><Text style={styles.body}>{t.admin_reply}</Text></View> : null}
        </View>
      ))}
      {q.data && !q.data.tickets.length && !q.data.disputes.length && !composing ? (
        <Text style={styles.muted}>Belum ada pertanyaan. Ada kendala soal akun, campaign, submission, atau pencairan? Tanyakan di sini.</Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: space.xl, marginBottom: space.lg },
  multiline: { minHeight: 120, textAlignVertical: 'top' },
  section: { ...type.heading, color: color.text, marginTop: space.xl, marginBottom: space.xs },
  item: { paddingVertical: space.lg, gap: space.xs, borderBottomWidth: 1, borderBottomColor: color.border },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.md },
  title: { ...type.label, color: color.text, flex: 1 },
  meta: { ...type.caption, color: color.textMuted },
  body: { ...type.body, color: color.text },
  reply: { marginTop: space.sm, padding: space.md, borderRadius: radius.sm, backgroundColor: color.accentSoft, gap: 2 },
  replyLabel: { ...type.caption, color: color.blue, fontFamily: type.label.fontFamily },
  muted: { ...type.body, color: color.textMuted, marginTop: space.md },
});
