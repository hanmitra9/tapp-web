import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { space, type } from '@/theme/tokens';
import type { RenderedCard } from '@/lib/shareCard';

type Props = { card: RenderedCard | null; title: string; body: string; onClose: () => void; onShare: () => void };

// Preview sheet for a shareable card (Threads-style): close, tilted card, title + note, one share button.
export function ShareCardSheet({ card, title, body, onClose, onShare }: Props) {
  return (
    <Modal visible={!!card} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.sheet}>
        <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Tutup" style={styles.close}>
          <Text style={styles.closeX}>✕</Text>
        </Pressable>
        <View style={styles.body}>
          {card ? <Image source={{ uri: card.url }} style={styles.img} resizeMode="contain" accessibilityLabel={title} /> : null}
          <View style={{ gap: space.sm }}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.text}>{body}</Text>
          </View>
        </View>
        <Pressable onPress={onShare} style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }]} accessibilityRole="button">
          <Text style={styles.btnText}>Bagikan</Text>
        </Pressable>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: '#1C1C1E', paddingHorizontal: space.xl, paddingBottom: space.xl },
  close: { alignSelf: 'flex-start', paddingVertical: space.lg },
  closeX: { color: '#FFFFFF', fontSize: 26, lineHeight: 28 },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.xxl },
  img: { width: 260, height: 364, transform: [{ perspective: 900 }, { rotateY: '-10deg' }, { rotateX: '3deg' }] },
  title: { ...type.title, color: '#FFFFFF', textAlign: 'center' },
  text: { ...type.body, color: 'rgba(235,235,245,0.6)', textAlign: 'center', maxWidth: 360 },
  btn: { height: 56, borderRadius: 18, backgroundColor: '#F2F4F7', alignItems: 'center', justifyContent: 'center', width: '100%', maxWidth: 480, alignSelf: 'center' },
  btnText: { ...type.label, fontSize: 17, color: '#0B0B0C' },
});
