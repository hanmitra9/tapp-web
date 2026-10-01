import { Image, StyleSheet, Text, View } from 'react-native';
import { color, font } from '@/theme/tokens';

export function Avatar({ uri, name, size = 72 }: { uri: string | null; name: string | null; size?: number }) {
  const initials = (name ?? '').trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?';
  const box = { width: size, height: size, borderRadius: size / 2 };
  return uri ? (
    <Image source={{ uri }} style={[styles.img, box]} accessibilityIgnoresInvertColors />
  ) : (
    <View style={[styles.fallback, box]}>
      <Text style={[styles.initials, { fontSize: size * 0.36 }]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  img: { backgroundColor: color.surface },
  fallback: { backgroundColor: color.accentSoft, alignItems: 'center', justifyContent: 'center' },
  initials: { fontFamily: font.bold, color: color.blue },
});
