import { StyleSheet, View } from 'react-native';
import { Chips } from '@/components/Chips';
import { Field } from '@/components/Field';
import { space } from '@/theme/tokens';
import type { Audience } from '../api';
import { AGE_RANGES, COUNTRIES, LANGUAGES } from '../options';

type Props = { value: Audience; onChange: (a: Audience) => void; error?: string | null };

// Self-reported for V1. Used for campaign matching; later replaced by platform analytics where available.
export function AudienceFields({ value, onChange, error }: Props) {
  return (
    <View style={styles.form}>
      <Field label="Negara penonton terbanyak" hint="Pilih maksimal 3." error={error}>
        <Chips multiple max={3} options={COUNTRIES} value={value.countries} onChange={(countries) => onChange({ ...value, countries })} />
      </Field>
      <Field label="Usia penonton" hint="Pilih semua yang dominan.">
        <Chips multiple options={AGE_RANGES} value={value.age_ranges} onChange={(age_ranges) => onChange({ ...value, age_ranges })} />
      </Field>
      <Field label="Bahasa konten">
        <Chips multiple options={LANGUAGES} value={value.languages} onChange={(languages) => onChange({ ...value, languages })} />
      </Field>
    </View>
  );
}

const styles = StyleSheet.create({ form: { gap: space.xl } });
