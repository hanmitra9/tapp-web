# TAPP — security model (V1)

## Principles
1. **Deny by default.** `anon` has no table access and can call exactly five functions, each read-only or narrowly validated: `check_request` (PostgREST pre-request), `login_policy`, `public_campaigns` (safe campaign fields), `meeting_slots_taken` (booked times only) and `request_meeting` (validated booking insert with per-email and global rate limits). `authenticated` gets explicit table/column grants only.
2. **RLS on every table** (23 public tables). Policy helpers live in the non-exposed `private` schema.
3. **Money and state never come from the client.** Earnings, qualified views, budgets, statuses, and payouts change only inside `SECURITY DEFINER` RPCs that check the caller (`assert_admin`, `assert_active_creator`) and validate transitions.
4. **Append-only history.** `content_metrics`, `performance_snapshots`, `audit_logs` reject UPDATE/DELETE.
5. **Everything sensitive is audited.** RPCs call `write_audit`; direct writes to `brands`, `brand_members`, `campaign_assets`, `campaign_rules`, `creator_payout_methods`, `creator_platforms`, and `profiles.role` are captured by triggers. Account numbers are stored as last-4 only in the audit trail.

## Roles
| Role | Can | Cannot |
|---|---|---|
| Creator | Own profile/socials/payout method; join/leave; submit/resubmit/withdraw own content; request payouts; tickets & objections | Edit status, tier, reliability, qualified views, earnings, budgets; see other creators; see source content before joining |
| Brand (backend-ready) | Own brand's campaigns (draft edits), their submissions/metrics, funnel | Approve campaigns, change terms after draft, see earnings ledger |
| Admin | All RPCs (review, metrics, qualify, payouts, statuses, budgets, disputes, support) | Bypass state machines, write metrics history, delete audit logs |

## Financial controls
- Qualification is totals-based with integer math; per-clip caps and remaining budget enforced under a campaign row lock.
- `campaigns_budget_guard` check constraint: earned ≤ budget unless an audited admin override.
- Payouts: advisory lock + idempotency key + one-open-payout index; admin view flags ledger mismatch (blocks "paid"), flagged submissions, open objections, and payout-method changes within 72h of the request.
- Earnings hold period (default 7 days) before they become payable.

## Abuse controls
- Global unique canonical URL per post; short links rejected; platform/URL mismatch rejected; posts must be published after joining.
- One social account per creator (unique platform+handle).
- Rate limits: 20 submissions/day, 5 support tickets/day, one open objection per submission/payout; Supabase Auth limits for email/OTP.
- Reserved usernames.

## Secrets
- App and admin ship only the **publishable/anon** key.
- Never commit: DB password, `service_role`/secret keys, Vault secrets.
- TikTok / Instagram OAuth (migrations `…031`, `…033`): `TIKTOK_CLIENT_SECRET` / `INSTAGRAM_APP_SECRET` live only in Edge Function secrets; the code exchange runs in `tiktok-oauth`, bound to a one-time `oauth_states` row (service-role only, 10-minute lifetime). Access/refresh tokens go straight to Vault. `connect_platform_account` is revoked from `authenticated`, so a client can never hand the DB an unchecked token or claim an account it didn't log in to.

## Review checklist (run after each migration)
```sql
-- expect exactly: check_request, login_policy, meeting_slots_taken, public_campaigns, request_meeting
select string_agg(proname, ', ' order by proname) from pg_proc where pronamespace in ('public'::regnamespace,'private'::regnamespace) and has_function_privilege('anon', oid, 'execute');
-- the rest should return 'none'
select string_agg(proname, ', ') from pg_proc where pronamespace in ('public'::regnamespace,'private'::regnamespace) and prosecdef and proconfig is null;
select string_agg(relname, ', ') from pg_class where relnamespace='public'::regnamespace and relkind='v' and not coalesce(reloptions @> array['security_invoker=true'], false);
select string_agg(tablename, ', ') from pg_tables where schemaname='public' and not rowsecurity;
```
Plus Supabase Advisors → Security. Remaining "SECURITY DEFINER callable by authenticated" warnings are the intended RPC API; each function authorizes internally.

## Admin two-factor (migration `…026`)
- With `app_settings.require_admin_mfa = true` (default), `is_admin()` is true only for an **AAL2** session (authenticator app verified). An AAL1 admin session gets no admin RLS access and every `admin_*` RPC returns `forbidden`.
- The admin panel forces TOTP setup (QR code) on first sign-in and a 6-digit code on every sign-in after that.
- Lost authenticator: in the Supabase dashboard → Authentication → Users → the admin → remove MFA factor, then they enroll again.

## Known V1 limits
- Metrics are entered manually by admins (no platform API verification yet).
- Payout destination is self-declared; name matching is checked by the admin at transfer time.
