import Feather from '@expo/vector-icons/Feather';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { LinearGradient } from 'expo-linear-gradient';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { color, gradient, radius, space, type, card } from '@/theme/tokens';
import { platformLabel } from '@/features/creator/options';
import type { CampaignDetail } from './api';

const ICON: Record<string, string> = { tiktok: 'tiktok', instagram: 'instagram', youtube: 'youtube', x: 'x-twitter', facebook: 'facebook' };

type Step = { title: string; items?: string[]; text?: string; danger?: boolean; platforms?: boolean };

// The campaign's rules as a short numbered guide: what must be in the video, what to avoid, the story, material, platforms.
export function guideSteps(c: CampaignDetail, assetCount: number): Step[] {
  const must = [...c.guidelines_do, ...c.rules.filter((r) => r.kind === 'requirement').map((r) => r.body)];
  const steps: Step[] = [];
  if (must.length) steps.push({ title: 'Wajib ada di video kamu', items: must });
  if (c.guidelines_dont.length) steps.push({ title: 'Hindari', items: c.guidelines_dont, danger: true });
  if (c.description || c.objective) steps.push({ title: 'Isi video', text: c.description ?? c.objective ?? '' });
  steps.push({ title: 'Materi', text: assetCount ? `${assetCount} konten sumber sudah disediakan — cek di Workspace.` : 'Bebas pakai footage sendiri.' });
  steps.push({ title: 'Platform yang didukung', platforms: true });
  return steps;
}

export function GuideSheet({ c, assetCount, visible, onClose, onMore, onAck }: {
  c: CampaignDetail; assetCount: number; visible: boolean; onClose: () => void; onMore?: () => void;
  onAck?: () => void;   // "Oke, Saya Paham" continues an action (e.g. Ambil Campaign); otherwise it just closes
}) {
  const steps = guideSteps(c, assetCount);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Tutup panduan" />
      <View style={styles.sheet} accessibilityViewIsModal>
        <View style={styles.handle} />
        <Text style={styles.title} accessibilityRole="header">Panduan Membuat Video</Text>
        <View style={styles.divider} />
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator>
          {steps.map((s, i) => (
            <View key={s.title} style={styles.step}>
              <View style={styles.num}><Text style={styles.numText}>{i + 1}</Text></View>
              <View style={{ flex: 1, gap: space.sm }}>
                <Text style={styles.stepTitle}>{s.title}</Text>
                {s.items?.map((t, k) => (
                  <View key={k} style={styles.item}>
                    <View style={[styles.dot, s.danger && { backgroundColor: color.danger }]} />
                    <Text style={styles.itemText}>{t}</Text>
                  </View>
                ))}
                {s.text ? <Text style={styles.itemText}>{s.text}</Text> : null}
                {s.platforms ? (
                  <View style={styles.plats}>
                    {c.platforms.map((p) => (
                      <View key={p} style={styles.plat}>
                        <FontAwesome6 name={ICON[p] ?? 'link'} brand size={15} color={color.text} />
                        <Text style={styles.platText}>{platformLabel(p)}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            </View>
          ))}
        </ScrollView>
        <View style={styles.actions}>
          {onMore ? (
            <Pressable onPress={onMore} accessibilityRole="button" style={({ pressed }) => [pressed && { opacity: 0.85 }]}>
              <LinearGradient colors={gradient.button} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.primary}>
                <Text style={styles.primaryText}>Lihat Detail Campaign</Text>
              </LinearGradient>
            </Pressable>
          ) : null}
          <Pressable onPress={onAck ?? onClose} accessibilityRole="button" style={({ pressed }) => [styles.secondary, pressed && { opacity: 0.7 }]}>
            <Text style={styles.secondaryText}>Oke, Saya Paham</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// Entry card that opens the guide.
export function GuideCard({ count, onPress }: { count: number; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}>
      <View style={styles.cardIcon}><Feather name="book-open" size={18} color={color.link} /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.cardTitle}>Panduan membuat video</Text>
        <Text style={styles.cardSub}>{count} poin · wajib dibaca sebelum posting</Text>
      </View>
      <Feather name="chevron-right" size={18} color={color.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '88%', alignSelf: 'center', width: '100%', maxWidth: 560,
    backgroundColor: '#121216', borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, borderBottomWidth: 0, borderColor: 'rgba(255,255,255,0.08)',
    paddingBottom: space.xl },
  handle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.25)', marginTop: space.md },
  title: { ...type.title, fontSize: 22, color: color.text, textAlign: 'center', marginVertical: space.lg },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)' },
  body: { padding: space.xl, gap: space.xl },
  step: { flexDirection: 'row', gap: space.md },
  num: { width: 34, height: 34, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  numText: { ...type.label, color: color.text },
  stepTitle: { ...type.label, fontSize: 16, color: color.text, marginTop: 6 },
  item: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: color.textMuted, marginTop: 9 },
  itemText: { ...type.body, color: color.textSecondary, flex: 1, lineHeight: 24 },
  plats: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  plat: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: space.md, height: 40, borderRadius: radius.md,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(255,255,255,0.03)' },
  platText: { ...type.label, color: color.text },
  actions: { paddingHorizontal: space.xl, paddingTop: space.md, gap: space.sm },
  primary: { height: 54, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  primaryText: { ...type.label, fontSize: 16, color: '#FFFFFF' },
  secondary: { height: 54, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' },
  secondaryText: { ...type.label, fontSize: 16, color: color.text },
  card: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.lg, ...card, borderColor: 'rgba(117,178,244,0.25)' },
  cardIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: color.accentSoft, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { ...type.label, color: color.text },
  cardSub: { ...type.caption, color: color.textMuted },
});
