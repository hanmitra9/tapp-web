import { forwardRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { color, font, radius, space, type } from '@/theme/tokens';

type Props = TextInputProps & { label: string; error?: string | null; hint?: string; secure?: boolean };

export const TextField = forwardRef<TextInput, Props>(function TextField(
  { label, error, hint, secure = false, onFocus, onBlur, style, ...rest }, ref,
) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(secure);
  return (
    <View style={styles.wrap}>
      <Text style={styles.label} nativeID={`${label}-label`}>{label}</Text>
      <View style={[styles.field, focused && styles.focused, !!error && styles.errored]}>
        <TextInput
          ref={ref}
          accessibilityLabelledBy={`${label}-label`}
          placeholderTextColor={color.textMuted}
          selectionColor={color.blue}
          keyboardAppearance="dark"
          secureTextEntry={hidden}
          onFocus={(e) => { setFocused(true); onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); onBlur?.(e); }}
          style={[styles.input, style]}
          {...rest}
        />
        {secure ? (
          <Pressable onPress={() => setHidden((h) => !h)} hitSlop={10} accessibilityRole="button"
            accessibilityLabel={hidden ? 'Tampilkan kata sandi' : 'Sembunyikan kata sandi'}>
            <Text style={styles.toggle}>{hidden ? 'Lihat' : 'Tutup'}</Text>
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text>
        : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  label: { ...type.label, color: color.textSecondary },
  field: {
    minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg,
    borderRadius: radius.md, backgroundColor: color.surface, borderWidth: 1, borderColor: color.surface,
  },
  focused: { borderColor: color.blue },
  errored: { borderColor: color.danger },
  input: { flex: 1, ...type.body, color: color.text, paddingVertical: 14 },
  toggle: { fontFamily: font.semibold, fontSize: 14, color: color.blue },
  error: { ...type.caption, color: color.danger },
  hint: { ...type.caption, color: color.textMuted },
});
