import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Chips } from '@/components/Chips';
import { TextField } from '@/components/TextField';
import { space } from '@/theme/tokens';
import { CITIES } from '@/features/creator/options';

const OTHER = '__other';
const known = (c: string) => CITIES.some((o) => o.value.toLowerCase() === c.trim().toLowerCase());

// Popular cities as chips, plus "Kota lain" with a free-text field.
export function CityPicker({ value, onChange }: { value: string; onChange: (city: string) => void }) {
  const [other, setOther] = useState(() => !!value && !known(value));
  const chip = other ? OTHER : CITIES.find((o) => o.value.toLowerCase() === value.trim().toLowerCase())?.value ?? '';
  return (
    <View style={styles.wrap}>
      <Chips options={[...CITIES, { value: OTHER, label: 'Kota lain' }]} value={chip ? [chip] : []}
        onChange={([c]) => { if (c === OTHER) { setOther(true); onChange(''); } else { setOther(false); onChange(c ?? ''); } }} />
      {other ? <TextField label="Nama kota" value={value} onChangeText={onChange} placeholder="Contoh: Solo" autoCapitalize="words" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({ wrap: { gap: space.md } });
