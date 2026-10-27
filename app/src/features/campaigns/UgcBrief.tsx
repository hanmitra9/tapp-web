import Feather from '@expo/vector-icons/Feather';
import type { ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { color, radius, space, type, card } from '@/theme/tokens';
import type { UgcBrief } from './api';

type Icon = ComponentProps<typeof Feather>['name'];
const FACE = { show: 'Wajah wajib tampil', hide: 'Tanpa wajah', either: 'Wajah bebas' } as const;

// UGC brief: what to make (original content, not clips) — story, CTA, must-haves, caption, face, duration.
export function UgcBriefCard({ b }: { b: UgcBrief }) {
  const dur = b.duration_min && b.duration_max ? `${b.duration_min}–${b.duration_max} detik`
    : b.duration_min ? `Min. ${b.duration_min} detik` : b.duration_max ? `Maks. ${b.duration_max} detik` : null;
  const rows: [Icon, string, string | undefined][] = [
    ['book-open', 'Narasi', b.narrative], ['target', 'CTA', b.cta], ['check-square', 'Wajib ada', b.must_include],
    ['type', 'Caption', b.caption_rules], ['info', 'Tentang brand', b.brand_about],
  ];
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.badge}><Text style={styles.badgeText}>UGC</Text></View>
        <Text style={styles.headText}>Buat konten orisinal di akunmu, bukan potong video brand.</Text>
      </View>
      <View style={styles.chips}>
        <Chip icon="user" text={FACE[b.face ?? 'either']} />
        {dur ? <Chip icon="clock" text={dur} /> : null}
      </View>
      {rows.filter(([, , v]) => v).map(([icon, label, v]) => (
        <View key={label} style={styles.row}>
          <View style={styles.icon}><Feather name={icon} size={14} color="#FF7AA8" /></View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.label}>{label}</Text>
            <Text style={styles.body}>{v}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}
function Chip({ icon, text }: { icon: Icon; text: string }) {
  return <View style={styles.chip}><Feather name={icon} size={12} color={color.textSecondary} /><Text style={styles.chipText}>{text}</Text></View>;
}

const styles = StyleSheet.create({
  card: { ...card, borderRadius: radius.lg, padding: space.lg, gap: space.md, borderWidth: 1, borderColor: 'rgba(255,77,141,0.22)' },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: 'rgba(255,77,141,0.16)' },
  badgeText: { ...type.label, fontSize: 12, color: '#FF7AA8', letterSpacing: 0.6 },
  headText: { ...type.caption, color: color.textSecondary, flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: color.surfaceRaised },
  chipText: { ...type.caption, color: color.text },
  row: { flexDirection: 'row', gap: space.md, paddingTop: space.md, borderTopWidth: 1, borderTopColor: color.border },
  icon: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,77,141,0.10)' },
  label: { ...type.caption, color: color.textMuted },
  body: { ...type.body, fontSize: 15, lineHeight: 22, color: color.text },
});
