import { Alert, Platform, type AlertButton } from 'react-native';

// Drop-in for Alert.alert. react-native-web's Alert is a no-op, so on web confirmations use the
// browser's native dialog: OK runs the first non-cancel button, Cancel runs the cancel button.
export function showAlert(title: string, message?: string, buttons?: AlertButton[]) {
  if (Platform.OS !== 'web') return Alert.alert(title, message, buttons);
  const cancel = buttons?.find((b) => b.style === 'cancel');
  const action = buttons?.find((b) => b.style !== 'cancel');
  if (!action) { window.alert([title, message].filter(Boolean).join('\n\n')); return; }
  const ok = window.confirm([title, message].filter(Boolean).join('\n\n'));
  if (ok) action.onPress?.(); else cancel?.onPress?.();
}
