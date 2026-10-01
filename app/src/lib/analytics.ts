import PostHog from 'posthog-react-native';

// Client-side product events. Server-truth events (approvals, payouts paid, joins…) are written by the
// database into `product_events`, so they're counted even if the app never reports them.
// Privacy: only the TAPP user id (uuid) is sent — never names, emails, handles, or payout details.
export type EventName =
  | 'app_opened' | 'signup_started' | 'signup_submitted' | 'signup_completed' | 'onboarding_step' | 'onboarding_completed'
  | 'campaign_viewed' | 'campaign_joined' | 'campaign_left' | 'marketplace_filtered'
  | 'submission_started' | 'submission_submitted' | 'performance_viewed' | 'earnings_viewed'
  | 'payout_started' | 'payout_requested' | 'notification_opened' | 'push_enabled' | 'dispute_submitted' | 'support_ticket_created';

type Props = Record<string, string | number | boolean | null | undefined>;

const key = process.env.EXPO_PUBLIC_POSTHOG_KEY;
const host = process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com';

let client: PostHog | null = null;
function ph(): PostHog | null {
  if (!key) return null;                          // no key → analytics is a no-op (dev, tests, forks)
  if (!client) {
    try { client = new PostHog(key, { host, captureAppLifecycleEvents: false, flushAt: 20 }); }
    catch { client = null; }
  }
  return client;
}

export function track(event: EventName, props?: Props) {
  try { ph()?.capture(event, props as Record<string, string | number | boolean | null>); } catch { /* never break the app */ }
}
export function identify(userId: string) {
  try { ph()?.identify(userId); } catch { /* ignore */ }
}
export function resetAnalytics() {
  try { ph()?.reset(); } catch { /* ignore */ }
}

// app_opened at most once per 30 minutes of foreground time.
let lastOpen = 0;
export function trackAppOpened() {
  const now = Date.now();
  if (now - lastOpen < 30 * 60_000) return;
  lastOpen = now;
  track('app_opened');
}
