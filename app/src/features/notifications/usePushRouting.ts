import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { enablePush, pushState } from './push';
import { openNotification } from './route';

// Mounted once inside the signed-in app: refreshes the device token silently and routes taps on pushes.
export function usePushRouting(uid: string | undefined, ready: boolean) {
  useEffect(() => {
    if (!uid || !ready || Platform.OS === 'web') return;   // no native pushes on web
    pushState().then((s) => { if (s === 'granted') enablePush(uid, false).catch(() => {}); });
    Notifications.getLastNotificationResponseAsync().then((r) => {
      if (r) openNotification(r.notification.request.content.data).catch(() => {});
    });
    const sub = Notifications.addNotificationResponseReceivedListener((r) => {
      openNotification(r.notification.request.content.data).catch(() => {});
    });
    return () => sub.remove();
  }, [uid, ready]);
}
