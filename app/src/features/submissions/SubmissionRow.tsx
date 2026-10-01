import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { showAlert } from '@/lib/alert';
import { StatusBadge } from '@/components/StatusBadge';
import { compact, dateLabel, idr } from '@/lib/format';
import { color, space, type } from '@/theme/tokens';
import { platformLabel } from '@/features/creator/options';
import type { MySubmission } from './api';
import { SUBMISSION_STATUS } from './copy';

type Props = {
  s: MySubmission;
  showCampaign?: boolean;
  onResubmit?: () => void;
  onWithdraw?: () => void;
  onDispute?: () => void;
  onPress?: () => void;
};

export function SubmissionRow({ s, showCampaign, onResubmit, onWithdraw, onDispute, onPress }: Props) {
  const st = SUBMISSION_STATUS[s.status];
  const tracked = s.status === 'tracking' || s.status === 'completed' || s.raw_views != null;
  const reason = ['rejected', 'needs_changes', 'flagged'].includes(s.status) ? s.review_reason : null;
  const gone = s.content_state === 'deleted' || s.content_state === 'private';

  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}>
      <View style={styles.top}>
        <Text style={styles.title} numberOfLines={1}>{showCampaign ? s.campaign_title : `${platformLabel(s.platform)} · ${dateLabel(s.published_at)}`}</Text>
        <StatusBadge label={st.label} tone={st.tone} />
      </View>
      {showCampaign ? <Text style={styles.meta}>{platformLabel(s.platform)} · diposting {dateLabel(s.published_at)}</Text> : null}
      <Pressable onPress={() => Linking.openURL(s.post_url).catch(() => {})} hitSlop={6} accessibilityRole="link">
        <Text style={styles.url} numberOfLines={1}>{s.post_url.replace(/^https?:\/\/(www\.)?/, '')}</Text>
      </Pressable>

      {reason ? <Text style={[styles.reason, s.status === 'rejected' && { color: color.danger }]}>{s.status === 'rejected' ? 'Alasan ditolak' : 'Catatan'}: {reason}</Text> : null}
      {gone ? <Text style={styles.reason}>Postingan terdeteksi {s.content_state === 'deleted' ? 'dihapus' : 'diprivat'}. Views tidak bisa dilacak sampai postingan publik kembali.</Text> : null}
      {!reason && !tracked ? <Text style={styles.meta}>{st.note}</Text> : null}

      {tracked ? (
        <View style={styles.metrics}>
          <Metric label="Views" value={s.raw_views == null ? '—' : compact(s.raw_views)} />
          <Metric label="Qualified" value={compact(s.qualified_views)} />
          <Metric label="Penghasilan" value={idr(s.earned)} />
        </View>
      ) : null}

      {onResubmit || onWithdraw || onDispute ? (
        <View style={styles.actions}>
          {onResubmit ? <Action label="Kirim ulang" onPress={onResubmit} /> : null}
          {onDispute ? <Action label="Ajukan keberatan" onPress={onDispute} /> : null}
          {onWithdraw ? <Action label="Tarik submission" danger onPress={() =>
            showAlert('Tarik submission?', 'Submission ini dihapus dari campaign. Kamu bisa submit ulang postingan yang sama nanti.', [
              { text: 'Batal', style: 'cancel' }, { text: 'Tarik', style: 'destructive', onPress: onWithdraw },
            ])} /> : null}
        </View>
      ) : null}
    </Pressable>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>;
}
function Action({ label, onPress, danger }: { label: string; onPress: () => void; danger?: boolean }) {
  return <Pressable onPress={onPress} hitSlop={8} accessibilityRole="button"><Text style={[styles.action, danger && { color: color.danger }]}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  row: { paddingVertical: space.lg, gap: 6, borderBottomWidth: 1, borderBottomColor: color.border },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.md },
  title: { ...type.heading, color: color.text, flex: 1 },
  meta: { ...type.caption, color: color.textMuted },
  url: { ...type.caption, color: color.link },
  reason: { ...type.caption, color: color.warning },
  metrics: { flexDirection: 'row', marginTop: space.xs },
  metric: { flex: 1, gap: 2 },
  metricValue: { ...type.label, color: color.text, fontVariant: ['tabular-nums'] },
  metricLabel: { ...type.caption, color: color.textMuted },
  actions: { flexDirection: 'row', gap: space.xl, marginTop: space.xs },
  action: { ...type.label, color: color.link },
});
