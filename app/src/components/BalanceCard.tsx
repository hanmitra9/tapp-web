import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { color, gradient, radius, space, type } from '@/theme/tokens';

type Props = { label: string; amount: string | null; footLeft?: ReactNode; footRight?: ReactNode };

// Reference "balance card": diagonal TAPP-blue gradient, mark top-right, amount, a quiet footer row.
export function BalanceCard({ label, amount, footLeft, footRight }: Props) {
  return (
    <LinearGradient colors={gradient.card} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={styles.card} {...({ dataSet: { tapp: 'balance' } } as object)}>
      <View style={styles.top}>
        <Text style={styles.label}>{label}</Text>
        <Image source={require('../../assets/tapp-mark-white.png')} style={styles.mark} accessibilityIgnoresInvertColors />
      </View>
      {amount == null ? <View style={styles.skeleton} /> : (
        <Text style={styles.amount} numberOfLines={1} adjustsFontSizeToFit accessibilityRole="text">{amount}</Text>
      )}
      <View style={styles.foot}>
        <View>{footLeft}</View>
        <View>{footRight}</View>
      </View>
    </LinearGradient>
  );
}

export const cardFootText = StyleSheet.create({ t: { ...type.caption, color: 'rgba(255,255,255,0.8)', fontVariant: ['tabular-nums'] } }).t;

const styles = StyleSheet.create({
  card: { borderRadius: radius.xl, padding: space.xl, minHeight: 190, justifyContent: 'space-between', overflow: 'hidden' },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { ...type.label, color: 'rgba(255,255,255,0.85)' },
  mark: { width: 28, height: 28, opacity: 0.9 },
  amount: { ...type.metric, fontSize: 40, lineHeight: 46, color: color.onAccent, marginTop: space.md },
  skeleton: { height: 32, width: '55%', borderRadius: radius.sm, backgroundColor: 'rgba(255,255,255,0.2)', marginTop: space.md },
  foot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: space.xl },
});
