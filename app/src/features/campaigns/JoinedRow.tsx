import { StyleSheet, Text, View } from 'react-native';
import { color, font, type } from '@/theme/tokens';

// "N creator ikut" with a small stack of initials (latest joiners), shown on every campaign card.
export function JoinedRow({ count, initials = [] }: { count: number; initials?: string[] }) {
  if (!count) return null;
  const shown = initials.slice(0, 4);
  const more = count - shown.length;
  return (
    <View style={styles.row} accessibilityLabel={`${count} creator ikut`}>
      <View style={styles.stack}>
        {shown.map((i, k) => <View key={k} style={[styles.av, k > 0 && styles.overlap]}><Text style={styles.avText}>{i}</Text></View>)}
        {more > 0 ? <View style={[styles.av, styles.more, shown.length > 0 && styles.overlap]}><Text style={[styles.avText, styles.moreText]}>+{more}</Text></View> : null}
      </View>
      <Text style={styles.text}><Text style={styles.count}>{count.toLocaleString('id-ID')}</Text> creator ikut</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stack: { flexDirection: 'row' },
  av: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#061B33',
    borderWidth: 1.5, borderColor: color.surface },
  overlap: { marginLeft: -8 },
  avText: { fontFamily: font.semibold, fontSize: 10, color: '#E2EFFD' },
  more: { backgroundColor: color.surfaceRaised },
  moreText: { color: color.blueLight, fontSize: 9 },
  text: { ...type.caption, color: color.textSecondary },
  count: { fontFamily: font.semibold, color: color.text },
});
