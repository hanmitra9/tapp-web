import posthog from 'posthog-js';
import type { EventName } from './analytics';

// Web build of src/lib/analytics.ts (Metro picks *.web.ts for the web bundle). Same API, same event
// names, same privacy rule: only the TAPP user id is sent. No-op without EXPO_PUBLIC_POSTHOG_KEY.
type Props = Record<string, string | number | boolean | null | undefined>;
const key = process.env.EXPO_PUBLIC_POSTHOG_KEY;
const host = process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com';

let ready = false;
function ph() {
  if (!key || typeof window === 'undefined') return null;
  if (!ready) {
    try {
      posthog.init(key, { api_host: host, capture_pageview: false, autocapture: false, persistence: 'localStorage', disable_session_recording: true });
      ready = true;
    } catch { return null; }
  }
  return posthog;
}

export function track(event: EventName, props?: Props) { try { ph()?.capture(event, { ...props, platform: 'web' }); } catch { /* ignore */ } }
export function identify(userId: string) { try { ph()?.identify(userId); } catch { /* ignore */ } }
export function resetAnalytics() { try { ph()?.reset(); } catch { /* ignore */ } }

let lastOpen = 0;
export function trackAppOpened() {
  const now = Date.now();
  if (now - lastOpen < 30 * 60_000) return;
  lastOpen = now;
  track('app_opened');
}
