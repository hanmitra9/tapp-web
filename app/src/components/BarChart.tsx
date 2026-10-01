import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { color, radius, space, type } from '@/theme/tokens';

type Point = { key: string; value: number; label: string };
type Props = { data: Point[]; height?: number; format: (v: number) => string; summary: string };

// Reference "Statistics" chart: smooth line with a fading blue area, a soft pill behind the selected
// column, a white dot, and a white tooltip. Kept the BarChart name/props so callers don't change.
export function BarChart({ data, height = 180, format, summary }: Props) {
  const [w, setW] = useState(0);
  const lastWithValue = useMemo(() => { for (let k = data.length - 1; k >= 0; k--) if (data[k]!.value > 0) return k; return data.length - 1; }, [data]);
  const [sel, setSel] = useState(lastWithValue);
  useEffect(() => setSel(lastWithValue), [lastWithValue]);

  const padTop = 44; const padBottom = 8;
  const max = Math.max(1, ...data.map((d) => d.value));
  const step = data.length > 1 ? w / (data.length - 1) : w;
  const pts = data.map((d, i) => ({ x: i * step, y: padTop + (1 - d.value / max) * (height - padTop - padBottom) }));

  // Catmull-Rom → cubic Bézier for a smooth curve through every point.
  const line = pts.reduce((acc, p, i) => {
    if (i === 0) return `M ${p.x} ${p.y}`;
    const p0 = pts[i - 2] ?? pts[i - 1]!; const p1 = pts[i - 1]!; const p2 = p; const p3 = pts[i + 1] ?? p;
    const c1x = p1.x + (p2.x - p0.x) / 6; const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6; const c2y = p2.y - (p3.y - p1.y) / 6;
    return `${acc} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }, '');
  const area = pts.length ? `${line} L ${pts[pts.length - 1]!.x} ${height} L 0 ${height} Z` : '';
  const s = pts[sel];
  const colW = Math.min(36, Math.max(14, step * 0.8));
  const tipLeft = s ? Math.min(Math.max(s.x - 50, 0), Math.max(w - 100, 0)) : 0;
  const labels = data.length <= 12 ? data : data.filter((_, i) => i % Math.ceil(data.length / 6) === 0 || i === data.length - 1);

  return (
    <View accessible accessibilityLabel={summary} onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}>
      <View style={{ height }}>
        {w > 0 ? (
          <Svg width={w} height={height}>
            <Defs>
              <LinearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={color.blue} stopOpacity="0.45" />
                <Stop offset="1" stopColor={color.blue} stopOpacity="0" />
              </LinearGradient>
              <LinearGradient id="stroke" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={color.blue} />
                <Stop offset="1" stopColor={color.blueLight} />
              </LinearGradient>
              <LinearGradient id="pill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={color.blueLight} stopOpacity="0.55" />
                <Stop offset="1" stopColor={color.blue} stopOpacity="0.15" />
              </LinearGradient>
            </Defs>
            {s ? <Rect x={s.x - colW / 2} y={s.y} width={colW} height={height - s.y} rx={colW / 2} fill="url(#pill)" /> : null}
            <Path d={area} fill="url(#fill)" />
            <Path d={line} stroke="url(#stroke)" strokeWidth={3} fill="none" strokeLinecap="round" />
            {s ? <Circle cx={s.x} cy={s.y} r={6} fill={color.onAccent} stroke={color.blue} strokeWidth={3} /> : null}
          </Svg>
        ) : null}
        {s && data[sel] ? (
          <View style={[styles.tip, { left: tipLeft, top: Math.max(s.y - 40, 0) }]} pointerEvents="none">
            <Text style={styles.tipText} numberOfLines={1}>{format(data[sel]!.value)}</Text>
          </View>
        ) : null}
        <View style={StyleSheet.absoluteFill}>
          <View style={styles.hit}>
            {data.map((d, i) => (
              <Pressable key={d.key} style={{ flex: 1 }} onPress={() => setSel(i)}
                accessibilityRole="button" accessibilityLabel={`${d.label}: ${format(d.value)}`} />
            ))}
          </View>
        </View>
      </View>
      <View style={styles.axis}>
        {labels.map((d) => <Text key={d.key} style={[styles.axisText, data[sel]?.key === d.key && styles.axisOn]}>{d.label}</Text>)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tip: { position: 'absolute', width: 100, backgroundColor: color.onAccent, borderRadius: radius.sm, paddingVertical: 6, alignItems: 'center' },
  tipText: { ...type.caption, fontFamily: type.label.fontFamily, color: '#0A0A0C', fontVariant: ['tabular-nums'] },
  hit: { flex: 1, flexDirection: 'row' },
  axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space.sm },
  axisText: { ...type.caption, fontSize: 11, color: color.textMuted },
  axisOn: { color: color.text },
});
