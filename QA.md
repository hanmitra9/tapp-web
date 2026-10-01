# TAPP — QA & edge cases (Phase 10)

## Verified this phase
- **Concurrency / budget overspend**: two `admin_qualify_views` calls fired in parallel against a campaign
  with budget for only one of them. The campaign row's `FOR UPDATE` lock serialized them — the first got
  the full remaining budget (capped), the second computed a zero delta and wrote no earnings row.
  `earned` landed at exactly `budget`, never over. See `SECURITY.md` for the financial-control model this confirms.
- **RLS performance**: 23 policies re-evaluating `auth.uid()` per row → wrapped as `(select auth.uid())`
  (migration `…016`). 11 foreign keys were missing a covering index → added. Both fixed with no logic change
  (verified against the full local test suite before and after).
- **Campaign expiry**: campaigns past `ends_at` now auto-close via a 15-minute cron (`close_expired_campaigns`),
  independent of any admin action. Existing submissions keep tracking and earning.

## Edge cases (brief §24) — status
| Case | Handling |
|---|---|
| Creator leaves campaign | `leave_campaign`; existing submissions keep tracking/earning |
| Campaign expires | Auto-closed by cron (this phase) |
| Campaign budget reaches zero | Blocked at join/submit; qualification caps at remaining budget |
| Campaign paused / cancelled | Blocked at join/submit; joined creators notified |
| Duplicate content | Global unique canonical URL (`normalize_post_url`) |
| Deleted / private social post | `content_state` on metrics entry auto-flags the submission |
| Late submission | `submission_deadline` checked in `check_submission` |
| Suspicious performance | Admin panel signals (engagement, spike, drop, views≫followers) — human decides |
| Missing / stale metrics | `admin_queue_counts` surfaces both; admin acts |
| API unavailable | N/A in V1 — metrics are entered manually by design (see `README` Phase 5) |
| Rejected content | `admin_review_submission`; reason required, shown to creator |
| Creator suspended / banned | Blocked at every creator RPC via `assert_active_creator` |
| Payout rejected | Funds return to available; creator notified; can re-request |
| Duplicate payout request | Idempotency key + one-open-payout unique index |
| Network failure (app) | `OfflineBanner` (persistent, auto-hides) + network-aware error copy in `lib/errors.ts` |
| Offline app state | `NetworkProvider`/`useOnline`; screens already show retry-capable error states (`LoadState`) |
| Auth expiration | Supabase auto-refresh while foregrounded; expired-session errors map to "log in again" |
| Notification failure | `push_error` recorded per notification; failed sends are retried by the dispatch sweep |

## Known V1 limits (unchanged from earlier phases)
- No platform API verification — metrics are admin-entered.
- No admin MFA yet (see `SECURITY.md`).
- Creator tier (New/Rising/Proven) and reliability score are stored but not yet auto-computed — still manual/flat.
- No automated E2E tests against a running app; all testing here is at the database layer (`supabase/tests/`).
