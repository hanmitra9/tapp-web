import { StyleSheet, View } from 'react-native';
import { Chips } from '@/components/Chips';
import { Field } from '@/components/Field';
import { TextField } from '@/components/TextField';
import { space } from '@/theme/tokens';
import { CONTENT_CATEGORIES, EXPERIENCE, MAX_CATEGORIES, MAX_NICHES, NICHES, type Experience } from '../options';

export type ContentValues = { niches: string[]; categories: string[]; experience: Experience | null; contentStyle: string };
type Props = { values: ContentValues; onChange: (p: Partial<ContentValues>) => void; errors: Partial<Record<keyof ContentValues, string | null>> };

export function ContentFields({ values, onChange, errors }: Props) {
  return (
    <View style={styles.form}>
      <Field label="Niche" hint={`Topik yang paling sering kamu buat. Pilih maksimal ${MAX_NICHES}.`} error={errors.niches}>
        <Chips multiple max={MAX_NICHES} options={NICHES} value={values.niches} onChange={(niches) => onChange({ niches })} />
      </Field>
      <Field label="Jenis konten" hint={`Format yang biasa kamu kerjakan. Pilih maksimal ${MAX_CATEGORIES}.`} error={errors.categories}>
        <Chips multiple max={MAX_CATEGORIES} options={CONTENT_CATEGORIES} value={values.categories}
          onChange={(categories) => onChange({ categories })} />
      </Field>
      <Field label="Pengalaman clipping" error={errors.experience}>
        <Chips options={EXPERIENCE} value={values.experience ? [values.experience] : []}
          onChange={([e]) => onChange({ experience: (e as Experience) ?? null })} />
      </Field>
      <TextField label="Gaya konten (opsional)" value={values.contentStyle} maxLength={280} multiline
        onChangeText={(contentStyle) => onChange({ contentStyle })} style={styles.multiline}
        placeholder="Contoh: cut cepat, subtitle besar, hook di 2 detik pertama"
        hint={`${values.contentStyle.length}/280`} error={errors.contentStyle} />
    </View>
  );
}

const styles = StyleSheet.create({ form: { gap: space.xl }, multiline: { minHeight: 88, textAlignVertical: 'top' } });
