import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import { track } from '@/lib/analytics';

const TOKEN_KEY = 'tapp:push-token';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

export type PushState = 'granted' | 'denied' | 'undetermined' | 'unsupported';

export async function pushState(): Promise<PushState> {
  if (Platform.OS === 'web' || !Device.isDevice) return 'unsupported';   // web push is out of scope for V1
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'undetermined';
}

// Ask (if needed), fetch the Expo token, and store it for this user. Throws a coded error on failure.
export async function enablePush(uid: string, ask = true): Promise<void> {
  if (Platform.OS === 'web' || !Device.isDevice) throw { code: 'push_unsupported' };
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted' && ask) ({ status } = await Notifications.requestPermissionsAsync());
  if (status !== 'granted') throw { code: 'push_denied' };

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Notifikasi TAPP', importance: Notifications.AndroidImportance.DEFAULT, lightColor: '#4548F5',
    });
  }
  const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) throw { code: 'push_no_project' };
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;

  const { error } = await supabase.from('push_tokens')
    .upsert({ token, user_id: uid, platform: Platform.OS === 'ios' ? 'ios' : 'android', updated_at: new Date().toISOString() }, { onConflict: 'token' });
  if (error) throw error;
  await AsyncStorage.setItem(TOKEN_KEY, token);
  if (ask) track('push_enabled');
}

// Called on sign-out and when the user turns push off. Never throws: sign-out must not be blocked.
export async function disablePush(): Promise<void> {
  try {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    if (token) await supabase.from('push_tokens').delete().eq('token', token);
    await AsyncStorage.removeItem(TOKEN_KEY);
  } catch { /* best effort */ }
}

export async function hasRegisteredToken() { return !!(await AsyncStorage.getItem(TOKEN_KEY)); }
