import { useState } from 'react';
import { Linking, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { color, radius, space, type } from '@/theme/tokens';

// Community channels. Leave a url empty to hide its row (WhatsApp waits for a group link).
const CHANNELS = [
  { key: 'discord', name: 'Discord', note: 'Info campaign & diskusi', icon: 'discord', tint: '#5865F2', url: 'https://discord.gg/P29n8gWVu5' },
  { key: 'whatsapp', name: 'WhatsApp', note: 'Update cepat', icon: 'whatsapp', tint: '#25D366', url: '' },
].filter((c) => c.url);

const store = () => { try { return Platform.OS === 'web' ? globalThis.localStorage ?? null : null; } catch { return null; } };
const joinedKey = (k: string) => `tapp:community:${k}`;
const isJoined = (k: string) => { try { return store()?.getItem(joinedKey(k)) === '1'; } catch { return false; } };
let shownThisOpen = false;   // once per app open, until every channel is joined

export function CommunityModal() {
  const [joined, setJoined] = useState(() => Object.fromEntries(CHANNELS.map((c) => [c.key, isJoined(c.key)])));
  const [open, setOpen] = useState(() => !shownThisOpen && CHANNELS.some((c) => !isJoined(c.key)));
  if (open) shownThisOpen = true;
  const close = () => setOpen(false);

  function join(c: (typeof CHANNELS)[number]) {
    Linking.openURL(c.url).catch(() => {});
    try { store()?.setItem(joinedKey(c.key), '1'); } catch { /* no storage */ }
    setJoined((j) => ({ ...j, [c.key]: true }));
  }

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close} accessibilityLabel="Tutup" />
      <View style={styles.wrap} pointerEvents="box-none">
        <View style={styles.card} accessibilityViewIsModal>
          <View style={styles.glow} pointerEvents="none" />
          <View style={styles.head}>
            <Text style={styles.title} accessibilityRole="header">Gabung komunitas</Text>
            <Pressable onPress={close} hitSlop={8} accessibilityRole="button" accessibilityLabel="Tutup" style={({ pressed }) => [styles.x, pressed && { opacity: 0.7 }]}>
              <Feather name="x" size={18} color={color.text} />
            </Pressable>
          </View>
          <Text style={styles.sub}>Tips, info campaign, dan teman sesama clipper. Gratis.</Text>
          <View style={{ gap: space.sm, marginTop: space.lg }}>
            {CHANNELS.map((c) => (
              <View key={c.key} style={styles.row}>
                <View style={[styles.icon, { backgroundColor: c.tint + '22' }]}><FontAwesome5 name={c.icon} brand size={20} color={c.tint} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{c.name}</Text>
                  <Text style={styles.note} numberOfLines={1}>{c.note}</Text>
                </View>
                {joined[c.key] ? (
                  <View style={styles.done}><Feather name="check-circle" size={15} color={color.success} /><Text style={styles.doneText}>Sudah gabung</Text></View>
                ) : (
                  <Pressable onPress={() => join(c)} accessibilityRole="link" style={({ pressed }) => [styles.join, pressed && { opacity: 0.8 }]}>
                    <Text style={styles.joinText}>Gabung</Text>
                  </Pressable>
                )}
              </View>
            ))}
          </View>
          <Pressable onPress={close} accessibilityRole="button" style={({ pressed }) => [styles.next, pressed && { opacity: 0.8 }]}>
            <Text style={styles.nextText}>Lanjut ke campaign</Text>
            <Feather name="arrow-right" size={16} color={color.text} />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.7)' },
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.lg },
  card: { width: '100%', maxWidth: 440, overflow: 'hidden', backgroundColor: '#0E0E12', borderRadius: 28, padding: space.xl,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)' },
  glow: { position: 'absolute', top: -120, left: -60, right: -60, height: 220, borderRadius: 200, backgroundColor: 'rgba(12,101,196,0.22)',
    ...(Platform.OS === 'web' ? ({ filter: 'blur(50px)' } as object) : null) },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  title: { ...type.heading, fontSize: 22, color: color.text, flex: 1 },
  x: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: color.borderStrong },
  sub: { ...type.body, color: color.textSecondary, marginTop: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: color.border },
  icon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  name: { ...type.label, fontSize: 15, color: color.text },
  note: { ...type.caption, color: color.textMuted },
  join: { paddingHorizontal: space.lg, paddingVertical: 9, borderRadius: 999, backgroundColor: color.blue },
  joinText: { ...type.label, color: color.onAccent },
  done: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  doneText: { ...type.label, fontSize: 13, color: color.text },
  next: { marginTop: space.xl, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, paddingVertical: 14,
    borderRadius: 999, borderWidth: 1, borderColor: color.borderStrong },
  nextText: { ...type.label, fontSize: 15, color: color.text },
});
