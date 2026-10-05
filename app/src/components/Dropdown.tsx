import Feather from '@expo/vector-icons/Feather';
import { useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { color, radius, space, type } from '@/theme/tokens';

type Opt = { value: string; label: string };

// Pill that opens a small menu right under it (konten-style filter dropdown).
export function Dropdown({ label, value, options, onChange, icon = 'chevron-down', minWidth = 0 }: {
  label: string; value: string; options: Opt[]; onChange: (v: string) => void; icon?: 'chevron-down' | 'sliders'; minWidth?: number;
}) {
  const ref = useRef<View>(null);
  const { width: winW } = useWindowDimensions();
  const [pos, setPos] = useState<{ x: number; y: number; w: number } | null>(null);
  const open = () => ref.current?.measureInWindow((x, y, w, h) => setPos({ x, y: y + h + 6, w }));
  const current = options.find((o) => o.value === value);
  const active = !!value && value !== options[0]?.value;
  const menuW = Math.max(pos?.w ?? 0, 180);
  return (
    <>
      <Pressable ref={ref} onPress={open} accessibilityRole="button" accessibilityLabel={`${label}: ${current?.label ?? ''}`}
        style={({ pressed }) => [styles.pill, { minWidth }, (active || pos) && styles.pillOn, pressed && { opacity: 0.8 }]}>
        <Text style={[styles.pillText, active && { color: color.link }]} numberOfLines={1}>{active ? current?.label : label}</Text>
        <Feather name={pos && icon === 'chevron-down' ? 'chevron-up' : icon} size={16} color={active ? color.link : color.textSecondary} />
      </Pressable>
      <Modal visible={!!pos} transparent animationType="fade" onRequestClose={() => setPos(null)}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setPos(null)} accessibilityLabel="Tutup" />
        {pos ? (
          <View style={[styles.menu, { top: pos.y, left: Math.min(pos.x, winW - menuW - 12), width: menuW }]}>
            <ScrollView style={{ maxHeight: 320 }}>
              {options.map((o) => {
                const on = o.value === value;
                return (
                  <Pressable key={o.value} onPress={() => { onChange(o.value); setPos(null); }} accessibilityRole="menuitem" accessibilityState={{ selected: on }}
                    style={({ pressed }) => [styles.opt, pressed && { backgroundColor: 'rgba(255,255,255,0.05)' }]}>
                    <Text style={[styles.optText, on && { color: color.link }]} numberOfLines={1}>{o.label}</Text>
                    {on ? <Feather name="check" size={16} color={color.link} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        ) : null}
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm, height: 42, paddingHorizontal: space.md,
    borderRadius: radius.md, borderWidth: 1, borderColor: color.border, backgroundColor: '#0E0E13' },
  pillOn: { borderColor: 'rgba(117,178,244,0.5)' },
  pillText: { ...type.label, color: color.text, flexShrink: 1 },
  menu: { position: 'absolute', backgroundColor: '#121218', borderRadius: radius.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', paddingVertical: space.xs,
    boxShadow: '0 18px 40px -12px rgba(0,0,0,0.8)' } as object,
  opt: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm, paddingHorizontal: space.lg, height: 46 },
  optText: { ...type.body, fontSize: 16, color: color.text, flexShrink: 1 },
});
