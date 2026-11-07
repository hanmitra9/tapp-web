import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { supabase } from '@/lib/supabase';
import { color, radius, space, type } from '@/theme/tokens';

// Banners the admin posts (0077): shown at the top of the home screen until closed (remembered on this device).
type Ann = { id: string; title: string; body: string; cta_label: string | null; cta_url: string | null; tone: 'info' | 'success' | 'warning' };
const TONE = {
  info: { tint: color.link, bg: 'rgba(117,178,244,0.08)', border: 'rgba(117,178,244,0.28)', icon: 'bell' },
  success: { tint: color.success, bg: 'rgba(52,208,122,0.08)', border: 'rgba(52,208,122,0.28)', icon: 'star' },
  warning: { tint: '#F5C451', bg: 'rgba(245,196,81,0.08)', border: 'rgba(245,196,81,0.30)', icon: 'alert-circle' },
} as const;
const store = () => { try { return Platform.OS === 'web' ? globalThis.localStorage ?? null : null; } catch { return null; } };
const key = (id: string) => `tapp:ann:${id}`;
const closed = (id: string) => { try { return store()?.getItem(key(id)) === '1'; } catch { return false; } };

export function Announcements({ style }: { style?: object }) {
  const [list, setList] = useState<Ann[]>([]);
  useEffect(() => {
    let live = true;
    supabase.rpc('my_announcements').then(({ data }) => { if (live && Array.isArray(data)) setList((data as Ann[]).filter((a) => !closed(a.id))); });
    return () => { live = false; };
  }, []);
  if (!list.length) return null;
  const close = (id: string) => { try { store()?.setItem(key(id), '1'); } catch { /* no storage */ } setList((l) => l.filter((a) => a.id !== id)); };
  const open = (url: string) => { if (url.startsWith('/')) router.push(url as never); else void Linking.openURL(url).catch(() => {}); };
  return (
    <View style={[{ gap: space.sm }, style]}>
      {list.map((a) => {
        const t = TONE[a.tone] ?? TONE.info;
        return (
          <View key={a.id} style={[styles.box, { backgroundColor: t.bg, borderColor: t.border }]} accessibilityRole="summary">
            <Feather name={t.icon} size={16} color={t.tint} style={{ marginTop: 2 }} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.title}>{a.title}</Text>
              {a.body ? <Text style={styles.body}>{a.body}</Text> : null}
              {a.cta_label && a.cta_url ? (
                <Pressable onPress={() => open(a.cta_url!)} accessibilityRole="link" hitSlop={6} style={({ pressed }) => [{ marginTop: 4 }, pressed && { opacity: 0.7 }]}>
                  <Text style={[styles.cta, { color: t.tint }]}>{a.cta_label} →</Text>
                </Pressable>
              ) : null}
            </View>
            <Pressable onPress={() => close(a.id)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Tutup pengumuman ${a.title}`}>
              <Feather name="x" size={16} color={color.textMuted} />
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}
const styles = StyleSheet.create({
  box: { flexDirection: 'row', gap: space.md, padding: space.md, borderRadius: radius.lg, borderWidth: 1 },
  title: { ...type.label, color: color.text },
  body: { ...type.caption, color: color.textSecondary },
  cta: { ...type.label, fontSize: 13 },
});
