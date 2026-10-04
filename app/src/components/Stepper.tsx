import Feather from '@expo/vector-icons/Feather';
import { StyleSheet, Text, View } from 'react-native';
import { web } from '@/theme/web';
import { color, space, type } from '@/theme/tokens';

// Numbered wizard steps (1 — 2 — 3): done steps fill blue with a check, the current one rings blue.
export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <View style={styles.row} accessible accessibilityLabel={`Langkah ${current + 1} dari ${steps.length}: ${steps[current]}`}>
      {steps.map((label, i) => {
        const done = i < current;
        const on = i === current;
        return (
          <View key={label} style={[styles.item, i < steps.length - 1 && styles.grow]}>
            <View style={styles.node}>
              <View style={[styles.dot, done && styles.dotDone, on && styles.dotOn]} {...(done ? web('navon') : {})}>
                {done ? <Feather name="check" size={14} color={color.onAccent} />
                  : <Text style={[styles.num, on && styles.numOn]}>{i + 1}</Text>}
              </View>
              <Text style={[styles.label, (on || done) && styles.labelOn]} numberOfLines={1}>{label}</Text>
            </View>
            {i < steps.length - 1 ? <View style={[styles.line, done && styles.lineDone]} /> : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: space.xl },
  item: { flexDirection: 'row', alignItems: 'flex-start' },
  grow: { flex: 1 },
  node: { alignItems: 'center', gap: 6, width: 64 },
  dot: { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, borderColor: color.borderStrong, alignItems: 'center', justifyContent: 'center' },
  dotOn: { borderColor: color.blue, backgroundColor: color.accentSoft },
  dotDone: { borderColor: color.blue, backgroundColor: color.blue },
  num: { ...type.label, color: color.textMuted, fontVariant: ['tabular-nums'] },
  numOn: { color: color.text },
  label: { ...type.caption, fontSize: 12, color: color.textMuted },
  labelOn: { color: color.text },
  line: { flex: 1, height: 0, marginTop: 15, marginHorizontal: -14, borderTopWidth: 1.5, borderStyle: 'dashed', borderColor: color.borderStrong },
  lineDone: { borderColor: color.blue, borderStyle: 'solid' },
});
