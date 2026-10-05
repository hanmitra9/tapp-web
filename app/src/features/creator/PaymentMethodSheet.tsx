import Feather from '@expo/vector-icons/Feather';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { TextField } from '@/components/TextField';
import { Notice } from '@/components/Notice';
import { errorMessage } from '@/lib/errors';
import { color, gradient, radius, space, type } from '@/theme/tokens';
import { savePayoutMethod, type PayoutMethod } from './api';
import { BANKS, EWALLETS } from './options';
import { normalizePayout, validatePayout, type PayoutValues } from './forms/PayoutForm';

// Brand-ish tile colours so the list scans fast (letter tiles, not logos).
const TINT: Record<string, string> = {
  GoPay: '#00AED6', OVO: '#4C3494', DANA: '#118EEA', ShopeePay: '#EE4D2D', LinkAja: '#E82529',
  BCA: '#0060AF', BRI: '#00529C', BNI: '#F15A23', Mandiri: '#003D79', BSI: '#00A39D', 'CIMB Niaga': '#7A0019',
  Permata: '#5C8F22', 'Bank Jago': '#E8A500', SeaBank: '#FF6A13', BTN: '#005BAA',
};
const SHORT: Record<string, string> = { Mandiri: 'MDR', 'CIMB Niaga': 'CIMB', Permata: 'PMT', 'Bank Jago': 'JAGO' };
const initials = (p: string) => SHORT[p] ?? (p.length <= 4 ? p.toUpperCase() : (p.match(/[A-Z]/g) ?? [p[0]]).join('').slice(0, 3));

// Official marks (assets/pay, idn-finlogos, see LICENSE-ASSETS.txt) on a white tile; letter tile for anything else.
const LOGO: Record<string, number> = {
  BCA: require('../../../assets/pay/bca.png'), Mandiri: require('../../../assets/pay/mandiri.png'), GoPay: require('../../../assets/pay/gopay.png'),
  ShopeePay: require('../../../assets/pay/shopeepay.png'), DANA: require('../../../assets/pay/dana.png'),
};

export function ProviderTile({ provider, size = 40 }: { provider: string; size?: number }) {
  const logo = LOGO[provider];
  if (logo) return (
    <View style={[styles.logoTile, { width: size * 1.6, height: size, borderRadius: size * 0.26 }]}>
      <Image source={logo} style={{ width: '100%', height: '100%' }} resizeMode="contain" accessibilityIgnoresInvertColors />
    </View>
  );
  return (
    <View style={[styles.tile, { width: size, height: size, borderRadius: size * 0.3, backgroundColor: TINT[provider] ?? color.blue }]}>
      <Text style={[styles.tileText, { fontSize: size * 0.3 }]}>{initials(provider)}</Text>
    </View>
  );
}

// Two-step sheet (konten-style): pick the bank / e-wallet, then fill number + name.
export function PaymentMethodSheet({ uid, current, visible, onClose, onSaved }: {
  uid: string; current: PayoutMethod | null; visible: boolean; onClose: () => void; onSaved: () => void;
}) {
  const [v, setV] = useState<PayoutValues | null>(null);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (visible) { setV(null); setTouched(false); setError(null); } }, [visible]);

  function pick(kind: PayoutValues['kind'], provider: string) {
    const same = current?.provider === provider;
    setV({ kind, provider, account_number: same ? current!.account_number : '', account_name: same ? current!.account_name : '' });
  }
  const errs = v && touched ? validatePayout(v) : {};
  async function save() {
    if (!v) return;
    setTouched(true); setError(null);
    if (Object.keys(validatePayout(v)).length || busy) return;
    setBusy(true);
    try { await savePayoutMethod(uid, current?.id ?? null, normalizePayout(v)); onSaved(); onClose(); }
    catch (e) { setError(errorMessage(e)); }
    finally { setBusy(false); }
  }

  const row = (kind: PayoutValues['kind'], p: string) => (
    <Pressable key={p} onPress={() => pick(kind, p)} accessibilityRole="button" style={({ pressed }) => [styles.row, pressed && { backgroundColor: 'rgba(255,255,255,0.04)' }]}>
      <ProviderTile provider={p} />
      <Text style={styles.rowText}>{p}</Text>
      {current?.provider === p ? <Feather name="check" size={18} color={color.success} /> : <Feather name="chevron-right" size={18} color={color.textMuted} />}
    </Pressable>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Tutup" />
      <View style={styles.sheet} accessibilityViewIsModal>
        <View style={styles.handle} />
        <Text style={styles.title} accessibilityRole="header">{v ? 'Lengkapi informasi' : 'Pilih metode pembayaran'}</Text>
        <View style={styles.divider} />
        {!v ? (
          <ScrollView contentContainerStyle={styles.list}>
            <Text style={styles.group}>E-wallet</Text>
            {EWALLETS.map((p) => row('ewallet', p))}
            <Text style={[styles.group, { marginTop: space.lg }]}>Bank</Text>
            {BANKS.map((p) => row('bank', p))}
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
            <View style={styles.picked}>
              <ProviderTile provider={v.provider} size={44} />
              <View style={{ flex: 1 }}>
                <Text style={styles.rowText}>{v.provider}</Text>
                <Text style={styles.sub}>{v.kind === 'bank' ? 'Rekening bank' : 'E-wallet'}</Text>
              </View>
            </View>
            <TextField label={v.kind === 'bank' ? 'Nomor rekening' : 'Nomor HP'} value={v.account_number} keyboardType="number-pad"
              placeholder={v.kind === 'bank' ? '1234567890' : '0812xxxxxxx'} onChangeText={(account_number) => setV({ ...v, account_number })} error={errs.account_number} />
            <TextField label="Nama akun" value={v.account_name} autoCapitalize="words" placeholder="Sesuai nama di rekening"
              onChangeText={(account_name) => setV({ ...v, account_name })} error={errs.account_name} />
            <Notice tone="error" message={error} />
          </ScrollView>
        )}
        {v ? (
          <View style={styles.actions}>
            <Pressable onPress={() => setV(null)} accessibilityRole="button" style={({ pressed }) => [styles.secondary, pressed && { opacity: 0.7 }]}>
              <Text style={styles.secondaryText}>Kembali</Text>
            </Pressable>
            <Pressable onPress={save} disabled={busy} accessibilityRole="button" style={({ pressed }) => [{ flex: 1 }, (pressed || busy) && { opacity: 0.85 }]}>
              <LinearGradient colors={gradient.button} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.primary}>
                <Text style={styles.primaryText}>{busy ? 'Menyimpan…' : 'Simpan'}</Text>
              </LinearGradient>
            </Pressable>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '88%', alignSelf: 'center', width: '100%', maxWidth: 560,
    backgroundColor: '#121216', borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, borderBottomWidth: 0, borderColor: 'rgba(255,255,255,0.08)',
    paddingBottom: space.xl },
  handle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.25)', marginTop: space.md },
  title: { ...type.heading, fontSize: 20, color: color.text, textAlign: 'center', marginVertical: space.lg },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)' },
  list: { padding: space.lg },
  group: { ...type.caption, color: color.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: space.xs, marginLeft: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.sm, borderRadius: radius.md },
  rowText: { ...type.label, fontSize: 15, color: color.text, flex: 1 },
  sub: { ...type.caption, color: color.textMuted },
  tile: { alignItems: 'center', justifyContent: 'center' },
  logoTile: { backgroundColor: '#FFFFFF', padding: 6, alignItems: 'center', justifyContent: 'center' },
  tileText: { fontFamily: type.label.fontFamily, color: '#FFFFFF', letterSpacing: -0.2 },
  form: { padding: space.xl, gap: space.lg },
  picked: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.md,
    borderWidth: 1, borderColor: 'rgba(117,178,244,0.35)', backgroundColor: color.accentSoft },
  actions: { flexDirection: 'row', gap: space.sm, paddingHorizontal: space.xl, paddingTop: space.md },
  primary: { height: 52, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  primaryText: { ...type.label, fontSize: 16, color: '#FFFFFF' },
  secondary: { flex: 1, height: 52, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' },
  secondaryText: { ...type.label, fontSize: 16, color: color.text },
});
