import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Chips } from '@/components/Chips';
import { Field } from '@/components/Field';
import { TextField } from '@/components/TextField';
import { space } from '@/theme/tokens';
import type { PayoutMethod } from '../api';
import { BANKS, EWALLETS } from '../options';

export type PayoutValues = Omit<PayoutMethod, 'id'>;
const KINDS = [{ value: 'bank', label: 'Rekening bank' }, { value: 'ewallet', label: 'E-wallet' }];
const toOpts = (xs: string[]) => xs.map((x) => ({ value: x, label: x }));

export function emptyPayout(m: PayoutMethod | null): PayoutValues {
  return m ? { kind: m.kind, provider: m.provider, account_name: m.account_name, account_number: m.account_number }
    : { kind: 'bank', provider: '', account_name: '', account_number: '' };
}

export function validatePayout(v: PayoutValues): Partial<Record<keyof PayoutValues, string>> {
  const e: Partial<Record<keyof PayoutValues, string>> = {};
  if (!v.provider) e.provider = v.kind === 'bank' ? 'Pilih bank.' : 'Pilih e-wallet.';
  if (v.account_name.trim().length < 2) e.account_name = 'Masukkan nama sesuai rekening.';
  const n = v.account_number.replace(/[\s-]/g, '');
  if (v.kind === 'bank' && !/^\d{6,20}$/.test(n)) e.account_number = 'Nomor rekening 6–20 digit.';
  if (v.kind === 'ewallet' && !/^(\+62|62|0)8\d{7,12}$/.test(n)) e.account_number = 'Masukkan nomor HP yang terdaftar, contoh 0812xxxxxxx.';
  return e;
}

export const normalizePayout = (v: PayoutValues): PayoutValues => ({
  ...v, account_name: v.account_name.trim(), account_number: v.account_number.replace(/[\s-]/g, ''),
});

type Props = { values: PayoutValues; onChange: (v: PayoutValues) => void; showErrors: boolean };

export function PayoutForm({ values, onChange, showErrors }: Props) {
  const errs: ReturnType<typeof validatePayout> = showErrors ? validatePayout(values) : {};
  const providers = values.kind === 'bank' ? BANKS : EWALLETS;
  return (
    <View style={styles.form}>
      <Field label="Jenis">
        <Chips options={KINDS} value={[values.kind]}
          onChange={([k]) => k && k !== values.kind && onChange({ ...values, kind: k as PayoutValues['kind'], provider: '' })} />
      </Field>
      <Field label={values.kind === 'bank' ? 'Bank' : 'E-wallet'} error={errs.provider}>
        <Chips options={toOpts(providers)} value={values.provider ? [values.provider] : []}
          onChange={([p]) => onChange({ ...values, provider: p ?? '' })} />
      </Field>
      <TextField label={values.kind === 'bank' ? 'Nama pemilik rekening' : 'Nama pemilik akun'} value={values.account_name}
        onChangeText={(account_name) => onChange({ ...values, account_name })} autoCapitalize="words"
        hint="Harus sama persis dengan nama di rekening/akun agar transfer tidak gagal." error={errs.account_name} />
      <TextField label={values.kind === 'bank' ? 'Nomor rekening' : 'Nomor HP'} value={values.account_number}
        onChangeText={(account_number) => onChange({ ...values, account_number })} keyboardType="number-pad"
        error={errs.account_number} />
    </View>
  );
}

const styles = StyleSheet.create({ form: { gap: space.xl } });
