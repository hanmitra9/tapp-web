import posthog from 'posthog-js';

// Client-side product events. Server-truth events (approvals, payouts paid, joins…) are written by the
// database into `product_events`, so they're counted even if the client never reports them.
// Privacy: only the TAPP user id (uuid) is sent — never names, emails, handles, or payout details.
// No-op without EXPO_PUBLIC_POSTHOG_KEY.
export type EventName =
  | 'app_opened' | 'signup_started' | 'signup_submitted' | 'signup_completed' | 'onboarding_step' | 'onboarding_completed'
  | 'campaign_viewed' | 'take_campaign_started' | 'campaign_joined' | 'campaign_left' | 'marketplace_filtered'
  | 'submission_started' | 'submission_submitted' | 'performance_viewed' | 'earnings_viewed'
  | 'payout_started' | 'payout_requested' | 'payout_card_saved' | 'views_card_shared' | 'referral_shared' | 'notification_opened' | 'dispute_submitted' | 'support_ticket_created';

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

export function track(event: EventName, props?: Props) { try { ph()?.capture(event, props); } catch { /* ignore */ } }
export function identify(userId: string) { try { ph()?.identify(userId); } catch { /* ignore */ } }
export function resetAnalytics() { try { ph()?.reset(); } catch { /* ignore */ } }

let lastOpen = 0;
export function trackAppOpened() {
  const now = Date.now();
  if (now - lastOpen < 30 * 60_000) return;
  lastOpen = now;
  track('app_opened');
}
