import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ago, dateLabel, idr, num } from '@/lib/format';
import { web } from '@/theme/web';
import type { HashtagStat } from './api';
import { color, radius, space, type, card } from '@/theme/tokens';

// "Views masuk 12 menit lalu · verifikasi 2 jam lalu · diperbarui otomatis" — so a brand knows how fresh the numbers are.
export function Freshness({ metricsAt, qualifiedAt, refreshedAt }: { metricsAt: string | null; qualifiedAt: string | null; refreshedAt: number }) {
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((x) => x + 1), 30_000); return () => clearInterval(t); }, []);
  const parts = [
    metricsAt ? `Views terakhir masuk ${ago(metricsAt)}` : 'Belum ada data views',
    qualifiedAt ? `verifikasi terakhir ${ago(qualifiedAt)}` : null,
    `halaman diperbarui otomatis (${ago(new Date(refreshedAt).toISOString())})`,
  ].filter(Boolean);
  return (
    <View style={styles.fresh} accessibilityRole="text">
      <View style={styles.dot} />
      <Text style={styles.freshText}>{parts.join(' · ')}</Text>
    </View>
  );
}

// Where every raw view went: qualified (paid) + waiting for verification + not counted.
export function ViewsBreakdown({ raw, qualified, pending, excluded }: { raw: number; qualified: number; pending: number; excluded: number }) {
  const total = Math.max(raw, qualified + pending + excluded, 1);
  const seg = [
    { k: 'Qualified (dibayar)', v: qualified, t: 'seg-q', c: color.blue, note: 'Lolos verifikasi tim TAPP. Hanya ini yang ditagih.' },
    { k: 'Menunggu verifikasi', v: pending, t: 'seg-p', c: '#E8B65A', note: 'Views baru yang masuk setelah verifikasi terakhir. Akan diputuskan tim TAPP.' },
    { k: 'Tidak dihitung', v: excluded, t: 'seg-x', c: color.borderStrong, note: 'Di bawah minimum views, di atas batas per klip, klip ditolak, atau aktivitas tidak wajar (bot/lonjakan).' },
  ];
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <Text style={styles.cap}>Views mentah dari platform</Text>
        <Text style={styles.big}>{num(raw)}</Text>
      </View>
      <View style={styles.bar} {...web('track')}>
        {seg.map((s) => (s.v > 0 ? <View key={s.k} style={{ flex: s.v / total, backgroundColor: s.c, borderRadius: 6 }} {...web(s.t)} /> : null))}
      </View>
      {seg.map((s) => (
        <View key={s.k} style={styles.legendRow}>
          <View style={[styles.sw, { backgroundColor: s.c }]} {...web(s.t)} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.legendTitle}>{s.k}</Text>
            <Text style={styles.cap}>{s.note}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.legendValue}>{num(s.v)}</Text>
            <Text style={styles.cap}>{raw ? `${Math.round((s.v / total) * 100)}%` : '—'}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

// What the campaign actually cost, and the effective CPM against the agreed CPM.
export function CostCard({ spent, fee, feePct, total, effectiveCpm, cpm }: { spent: number; fee: number; feePct: number; total: number; effectiveCpm: number | null; cpm?: number }) {
  const saving = cpm && effectiveCpm != null && cpm > 0 ? Math.round((1 - effectiveCpm / cpm) * 100) : null;
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <Text style={styles.cap}>Total biaya</Text>
        <Text style={styles.big}>{idr(total)}</Text>
      </View>
      <Row label="Biaya views (qualified views × CPM)" value={idr(spent)} />
      <Row label={`Fee kerjasama (${num(feePct)}% dari biaya views)`} value={idr(fee)} />
      <View style={styles.cpmRow}>
        <View style={styles.cpmBox}>
          <Text style={styles.cap}>Effective CPM</Text>
          <Text style={[styles.cpmValue, { color: color.success }]}>{effectiveCpm == null ? '—' : idr(effectiveCpm)}</Text>
          <Text style={styles.cap}>biaya per 1.000 views mentah</Text>
        </View>
        {cpm ? (
          <View style={styles.cpmBox}>
            <Text style={styles.cap}>CPM campaign</Text>
            <Text style={styles.cpmValue}>{idr(cpm)}</Text>
            <Text style={styles.cap}>per 1.000 qualified views</Text>
          </View>
        ) : null}
      </View>
      {saving != null && saving > 0 ? (
        <Text style={styles.cap}>Setiap 1.000 views yang dihasilkan campaign ini rata-rata hanya berbiaya {idr(effectiveCpm!)}, {saving}% di bawah CPM yang disepakati, karena views yang tidak lolos tidak dibayar.</Text>
      ) : null}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <View style={styles.row}><Text style={styles.rowLabel}>{label}</Text><Text style={styles.rowValue}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  fresh: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.md },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: color.success, boxShadow: '0 0 8px rgba(52,208,122,0.8)' },
  freshText: { ...type.caption, color: color.textMuted, flex: 1 },
  card: { ...card, borderRadius: radius.lg, padding: space.lg, gap: space.md },
  cardHead: { gap: 2 },
  big: { ...type.metric, fontSize: 26, color: color.text },
  cap: { ...type.caption, color: color.textMuted, fontVariant: ['tabular-nums'] },
  bar: { flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden', backgroundColor: color.surfaceRaised, gap: 3, padding: 0 },
  legendRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  sw: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  legendTitle: { ...type.label, color: color.text },
  legendValue: { ...type.label, color: color.text, fontVariant: ['tabular-nums'] },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: space.md, paddingVertical: space.sm, borderBottomWidth: 1, borderBottomColor: color.border },
  rowLabel: { ...type.caption, color: color.textSecondary, flex: 1 },
  rowValue: { ...type.label, color: color.text, fontVariant: ['tabular-nums'] },
  cpmRow: { flexDirection: 'row', gap: space.sm },
  cpmBox: { flex: 1, padding: space.md, borderRadius: radius.md, backgroundColor: color.bg, gap: 2 },
  cpmValue: { ...type.metric, fontSize: 20, lineHeight: 26, color: color.text },
});

// Hashtag reach: TikTok's own totals for the campaign hashtag (all videos using it), and growth since the first reading.
export function HashtagReach({ stats }: { stats: HashtagStat[] }) {
  const first = stats[0], last = stats.at(-1);
  if (!first || !last) return null;
  const grow = (a: number, b: number) => (b > a ? `+${num(b - a)}` : null);
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <Text style={styles.cap}>#{last.hashtag} di TikTok</Text>
        <Text style={styles.big}>{num(last.view_count)} views</Text>
      </View>
      <View style={styles.legendRow}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.legendTitle}>{num(last.video_count)} video memakai hashtag ini</Text>
          <Text style={styles.cap}>{grow(first.video_count, last.video_count) ? `${grow(first.video_count, last.video_count)} video` : 'Belum ada tambahan video'}{grow(first.view_count, last.view_count) ? ` · ${grow(first.view_count, last.view_count)} views` : ''} sejak dicatat {dateLabel(first.captured_at)}</Text>
        </View>
      </View>
      <Text style={styles.cap}>Angka dari TikTok untuk semua video yang memakai hashtag ini, termasuk di luar TAPP. Diperbarui tiap 6 jam, terakhir {dateLabel(last.captured_at)}.</Text>
    </View>
  );
}
