# TAPP Creators — V1 foundation (Phase 1)

## Audit
- **Existing work found here:** none (no repo or assets uploaded). A TAPP web prototype + Discord bot exists elsewhere. Share the repo to reconcile any data model it already has.
- **Reused:** approved TAPP identity — TAPP Blue `#4548F5`, existing logo (not recreated).
- **Built now:** full database, business logic, authorization, auth app flow.
- **Architecture:** web only — Expo Router + react-native-web (TS, static web export) → Supabase (Auth, Postgres, Storage). All money/state transitions are Postgres RPCs; the client never computes or writes financial values.

## Layout
```
supabase/
  migrations/…001_schema.sql     tables, enums, indexes, append-only guards
  migrations/…002_functions.sql  onboarding, join, submit, review, metrics, qualify→earnings, payouts, admin actions, read models
  migrations/…003_security.sql   deny-by-default grants, column grants, RLS, storage buckets/policies
  seed.sql                       dev-only campaign
  tests/run.sh                   applies migrations to local Postgres + full workflow & abuse test
app/                             signed-in pages (Expo web), served from the same site
```

## Supabase status (project njffqsbddzztfxxbavpp)
Migrations 001–023 are applied (024 web-only cleanup: pending); cron jobs are set up. RLS is on for all 22 tables, anon has no table or function access, and the RLS helper functions live in a non-exposed `private` schema.

## Setup
1. **Logo:** included in `app/assets/` (extracted from the approved mark; see `brand/`). Replace with vector exports when available.
2. **Supabase:** `supabase link --project-ref <ref> && supabase db push` (dev: `psql -f supabase/seed.sql`).
3. **Auth settings (Dashboard → Authentication):** enable email confirmations; Email OTP expiry = 3600s (templates say 60 minutes).
   Upload `brand/tapp-mark-email.png` to the public `brand` bucket, replace `YOUR-PROJECT` in `supabase/templates/*.html`, then paste: `confirmation.html` → Confirm signup, `recovery.html` → Reset password, `magic_link.html` → Magic link.
4. **First admin:** `update profiles set role='admin' where id='<uuid>';` (SQL editor only).
5. **Cron (optional):** earnings also mature lazily on payout request.
   `select cron.schedule('release-earnings','*/15 * * * *', $$select public.release_matured_earnings()$$);`
6. **Web app:** `cd app && cp .env.example .env` (fill values) → `npm i && npm run web`.
7. **Types:** `supabase gen types typescript --linked > app/src/lib/database.types.ts` and pass to `createClient<Database>`.

## Key rules enforced in the database
- Creator states `pending → verified (onboarded + email) → active (admin)`; only `active` can join/submit/request payouts.
- Duplicate content blocked globally via canonical URL (host-normalised, YouTube ID extraction, TikTok short links rejected).
- Raw metrics and qualification snapshots are append-only; earnings are a ledger computed from totals (no rounding drift).
- Budget: campaign row locked during allocation; allocation capped at remaining budget unless `budget_override`; hitting budget moves campaign to `ending`.
- Payouts: advisory lock + idempotency key + one-open-payout index; rejection returns funds to available.
- Every admin action writes `audit_logs` (append-only).

## Tested (`supabase/tests/run.sh`)
Onboarding gates, privilege escalation attempts, account-sharing, draft-only terms, join idempotency, source-content gating, URL/platform/date/duplicate validation, review reasons, raw>qualified guard, CPM math (185,000 × Rp3,000/1k = Rp555,000), budget cap, hold period, payout idempotency/double-request, payout state machine, notifications, audit visibility.

## Phase 2 — onboarding & profile
- `app/(app)/onboarding.tsx`: 6 steps (profil → akun sosial → konten → penonton → pencairan → periksa). Draft saved in the browser per step (survives refresh/offline); social accounts, payout method, and photo are written to the server immediately. Server errors send the user back to the step that owns the problem.
- `app/(app)/profile/*`: profile (stats, reliability, socials, content, payout) + edit, socials, payout screens. Suspended/banned accounts are read-only.
- Migration `…004`: username availability RPC, reserved usernames, niche/category limits, main-platform fallback, `my_creator_stats` view.
- Routing: signed in + not onboarded → onboarding only; otherwise onboarding is unreachable.

## Phase 3 — marketplace
- Tabs: Beranda · Campaign · Aktivitas · Penghasilan · Profil (`app/(app)/(tabs)/`).
- Beranda: 4 metrics (tersedia, aktif, qualified views, penghasilan), top-3 recommendations, active campaigns, account-status banner.
- Campaign: sort (rekomendasi/terbaru/CPM/deadline), filters (platform, kategori, jenis konten, CPM, deadline), paging, pull-to-refresh, skeleton/empty/error states.
- Detail (`campaign/[id]`): brief, reward model with worked example, budget progress, rules, do/don't, terms. Join/leave with confirmation; source content unlocks only after joining (RLS). The CTA explains why joining is blocked and links to the fix.
- Matching v0 (`campaign_feed`, migration `…005`): transparent rule score — niche 40, platform (main 25 / linked 15), content type 15, category track record ≤10, remaining budget ≤10 — with human-readable reasons. Only campaigns on the creator's linked platforms appear. Not ML; the reasons + outcomes are the data for a future model.
- Aktivitas / Penghasilan: real read-only data now; submit flow (Phase 4) and payouts (Phase 7) extend them.

## Phase 4 — workspace & submissions
- Workspace (`workspace/[id]`): status, CPM, deadline, totals (klip, qualified views, penghasilan), how-it-works, source content, key rules, own submissions with review status/reason, views, earnings. Submit is disabled with a clear reason when the campaign is paused/closed/out of budget or the account isn't active.
- Submit (`submit/[campaignId]`, modal): paste link (auto-detects platform, rejects short links / wrong platform instantly), platform limited to campaign ∩ linked accounts, publish-day chips from join date, optional screenshot (private bucket), caption, rules checklist + confirmation. Resubmit after "perlu revisi" prefills and may replace the link.
- Migration `…006`: shared `check_submission` (single source of rules), idempotent `submit_content` (retry after a lost response returns the same row), `resubmit_content`, `withdraw_submission` (only before review/metrics), `my_submissions` view with latest raw views.
- Aktivitas: latest submissions + "butuh perhatian" count; joined campaigns open the workspace.

## Phase 5 — verification & performance engine (admin)
`admin/` is the internal TAPP Control web app (Vite + React + TS). Same Supabase project and anon key; only `profiles.role = 'admin'` gets in, and every read/RPC is enforced by RLS regardless of the UI.
- Run: `cd admin && cp .env.example .env` (same URL/anon key as the app) → `npm i && npm run dev`. Deploy the static `dist/` anywhere (Vercel/Netlify) — never put the service_role key in it.
- Ringkasan: queue counts (review, flagged, approved-without-metrics, metrics >24h old, creators awaiting approval).
- Verifikasi: FIFO review queue → post link, reported publish date, account handle/followers, creator history, caption, private screenshot. Decisions: setujui / minta revisi / tolak / tandai, with reason presets; non-approve reasons are shown to the creator.
- Performa: record raw metrics (append-only snapshots, post state publik/diprivat/dihapus → auto-flag), review signals (low engagement, ≥10× jump in 24h, views drop, views ≫ followers), then set qualified views with a live earnings preview mirroring the server math (min views, per-clip cap, budget cap). Decreases require an explicit flag + reason.
- Kreator: approve verified creators, suspend/close with reason, verify social-account ownership (`admin_verify_platform`).
- Migration `…007`: `admin_submissions`, `admin_queue_counts` (security-invoker views), `admin_verify_platform`.

## Phase 6 — performance & earnings
- Performa (`performance`, from Beranda / Profil / Penghasilan): totals (views, qualified views, approved clips, campaigns, engagement rate, earnings), qualification rate, daily qualified-views bar chart (7/30/90 days, creator's timezone, tap for values), per-campaign rows with 7-day vs previous-7-day trend → workspace.
- Penghasilan: available vs minimum payout, pending/in-payout/paid, next maturity date + amount, how earnings are calculated (hold period from settings), per-campaign earnings, history with status filters and downward-adjustment rows.
- Migration `…010`: `my_daily_performance(days, tz)` (gap-filled) and `my_campaign_performance()` — both SECURITY INVOKER, scoped by RLS.

## Phase 7 — payouts & notifications
- Creator: "Cairkan" on Penghasilan → confirmation (amount, destination, 1–3 hari kerja) → `request_payout` with a per-screen idempotency key (double taps/retries never duplicate). Open payout shows as a status card; `payouts` screen shows history with a 5-step tracker, reference number when paid, reason when rejected.
- Admin (`/payouts`): queue with snapshot destination (copy button), ledger breakdown, risk flags (ledger mismatch blocks payment, flagged submissions, open disputes, account status), state-machine actions with required reason/reference.
- Notifications: every event is written to `notifications` (in-app inbox `notifications`, bell + unread badge on Beranda; opening one deep-links to workspace / campaign / payouts). Important events also go out by email (`mailer/`). New-campaign alerts only go to active creators whose niche and platforms match.
- Cron: `release-earnings` (15 min).
- Migrations `…011`–`…013` (applied). Native push was removed in `…024` (web only).

## Phase 8 — admin control center
Admin (`admin/`) now covers every operational surface:
- **Campaign**: tabs by status; create/edit drafts atomically (`upsert_campaign_draft`: campaign + platforms + rules), submit → approve/return-to-draft, pause/close/complete/cancel/archive with required reasons, budget top-up/override (`admin_adjust_campaign_budget`), post-launch copy edits (commercial terms stay locked), source-content manager (links or uploads to the private `campaign-assets` bucket), funnel stats, effective CPV, per-platform breakdown.
- **Brand**: create/edit/suspend.
- **Keberatan**: creator objections on rejected/flagged submissions and rejected payouts → review/accept/reject with a message to the creator.
- **Support**: tickets → reply (sent as notification) + status.
- **Audit log**: filter by entity/action, paged, before/after JSON.
Creator app: **Bantuan** (ask a question, see replies and objection outcomes), **Ajukan keberatan** from rejected/flagged submissions and rejected payouts. One open objection per item and 5 tickets/day are enforced in the DB.
Migration `…014` (applied).

## Phase 9 — analytics, audit, security
- **Server events** (`product_events`, migration `…015`): signup, onboarding, approval, joins, submissions and review outcomes, payout requested/completed/rejected — written by triggers, so they're complete regardless of client. Admin sees them only.
- **Client events** (PostHog, optional): `app_opened`, `signup_started/submitted/completed`, `onboarding_step/completed`, `campaign_viewed/joined/left`, `marketplace_filtered`, `submission_started/submitted`, `performance_viewed`, `earnings_viewed`, `payout_started/requested`, `notification_opened`, `dispute_submitted`, `support_ticket_created`. Only the user id is sent. No-op unless `EXPO_PUBLIC_POSTHOG_KEY` is set.
- **Admin Ringkasan**: creator activation funnel (signup → paid out, step conversion) and weekly unique creators per key action.
- **Audit coverage**: triggers on directly-written sensitive tables; account numbers masked to last 4.
- **Fraud signal**: payout flagged when the payout method changed within 72h before the request.
- **Security review**: see `SECURITY.md` (model, roles, controls, checklist). Current state: no anon-callable functions, all definer functions pinned `search_path`, all views security-invoker, RLS on all tables.

## Phase 10 — QA, edge cases, performance
- Concurrency-tested the budget lock directly (see `QA.md`) — confirmed no overspend under parallel qualification.
- Fixed all actionable Supabase performance advisories: RLS initplan caching (`…016`), missing FK indexes. Left "multiple permissive policies" (6, correctness-neutral, union-of-conditions) and "unused index" (29, expected at this data volume) as accepted trade-offs — see `SECURITY.md`.
- New edge case: campaigns past `ends_at` auto-close via cron, independent of admin action.
- App: `NetworkProvider` + `OfflineBanner` (persistent, auto-hiding) for real offline detection (not just radio state); existing screens already had retry-capable error states from earlier phases.
- Full edge-case checklist (brief §24) reviewed against implementation — see `QA.md`.

## Visual restyle — dark theme
Matches the reference fintech style with TAPP Blue replacing the purple:
- Tokens are now semantic (`bg`, `surface`, `surfaceRaised`, `border`, `text`, `textSecondary`, `textMuted`, `blue`, `blueLight`, `onAccent`, `success`…) in `src/theme/tokens.ts`; the whole app was migrated to them, so the palette can change in one place.
- Near-black canvas, dark-gray cards, larger radii (10/16/22/28 + pill), green for money in.
- New components: `BalanceCard` (blue gradient card), `ActionCircle` (round quick actions), `Segmented` (Day/Month/Year-style control); `BarChart` is now a smooth area chart with gradient fill, highlighted column, and white tooltip.
- Welcome: oversized blue ribbons (SVG), 3-slide headline carousel with dots and a round arrow button.
- Home: total earnings headline, gradient "Tersedia untuk dicairkan" card, four quick actions, transaction-style "Sedang kamu kerjakan" list. Floating rounded tab bar.
- Admin panel uses the same dark system (`admin/src/styles.css`): floating sidebar with blue active item, segmented tabs, surface cards for list/detail, gradient first stat, pill badges.

## One website
TAPP is a single website. `site/` holds the landing and public pages; `app/` holds the signed-in pages (login, onboarding, `/dashboard`, campaigns, submit, earnings, payouts, profile, brand portal); `admin/` is the admin panel. They are separate code internally but built and deployed together:
`python3 site/tools/build_all.py https://yourdomain` → upload `dist/` (see `DEPLOY.md`).
- URLs: `/` landing · `/campaigns` public list · `/login`, `/register` · `/dashboard`, `/dashboard/campaigns|activity|earnings|profile` · `/campaign/…`, `/workspace/…`, `/payouts`… · `/brand` · `/admin/`.
- Signed-out pages wear the landing header; the landing header shows **Dashboard** when the visitor is signed in. Any path that isn't a file is served by `app.html`.
- Desktop (≥900px): sidebar, wider content, forms as a centered card. Phones get the mobile layout. Confirmations use the browser dialog (`src/lib/alert.ts`), analytics via `posthog-js`.
- Dev: `cd app && npm run web` (signed-in pages alone) · E2E: build with `build_all.py`, then `cd app && npm run e2e`.

## Brand portal (V1: laporan saja)
Two homes behind one login: `profiles.role = 'brand'` → `/brand` (TAPP for Brands), everyone else → the creator app.
- **Access is invite-only.** Admin → Brand → *Akses brand* → invite an email (Pemilik / Anggota / Hanya lihat) and share the sign-up link (`/register?invite=brand&email=…`; set `VITE_APP_URL` in `admin/.env`). After the email is verified, `claim_brand_invites()` adds the membership and switches the account to brand. Invites expire after 14 days and can be revoked; members can be removed.
- **Ringkasan**: total qualified views, spend, CPV, active campaigns, creators, approved clips, remaining budget, daily trend (7/30/90).
- **Campaign** list with budget burn, and a per-campaign **report**: budget used/remaining, qualified vs total views, CPV, verification pass rate, creator funnel, daily trend, per-platform breakdown, top clips (link to the post).
- Read-only: brands can't create campaigns, touch budgets, or review content (admin keeps approval in V1). Report RPCs only return campaigns of brands the user belongs to.
- Migration `…017` (applied).
- Web fix found while testing: Supabase auth now gets `window.localStorage` explicitly on web — previously a page refresh could lose the session.

## Website (site/) and real data
- `site/` is the public website: landing (Creator/Brand), live **Campaigns** page, **Kebijakan Privasi**, **Syarat Layanan**. Static, deploy with Root Directory `site`. See `site/README.md`. Blog and LinkedIn removed.
- Migration `…018`: `public_campaigns()` — safe, read-only list of open campaigns for signed-out visitors (no rupiah budgets, creators, or earnings; only % budget left).
- Real data: brand **TAPP** + **TAPP Campaign** (Rp3.000 / 1K views, claim from 5.000 views, paid up to 100K views per clip = Rp300.000) created as **draft** with a temporary Rp10.000.000 budget — set the real budget and approve it in Admin → Campaign to publish it. The dev seed campaign "Ruang Cuan" is archived.
- Fee platform: 15% (landing FAQ, estimator copy, and Syarat Layanan).
- Sign-in verification (migration `…020`): password + emailed 6-digit code for app and admin, enforced server-side by a PostgREST pre-request check; **off** until `app_settings.require_login_otp = true`. Welcome email after the sign-up email is verified.
- Email: `mailer/` (Railway Function, Resend API) + migration `…019` (brand invite and payout emails from the database). See `EMAIL.md`.
- App: register screen links to terms/privacy when `EXPO_PUBLIC_SITE_URL` is set.

## Deployment status (live services)
- **Supabase**: migrations 001–023 applied. **To do:** first, once: `bash supabase/tools/sync_migration_history.sh` (live history uses different version numbers for 001–023; without this `db push` would re-run 001). Then `supabase db push` for `…024` (web only: drop push), `…025` (reliability score), `…026` (admin 2FA), `…027` (YouTube auto metrics), `…028` (meeting booking), `…029` (brand reporting), `…030` (automatic view filtering); delete the Edge Function `push-dispatch` (`npx supabase functions delete push-dispatch --project-ref njffqsbddzztfxxbavpp`); then `supabase gen types typescript --linked > app/src/lib/database.types.ts`.
- **Reliability score** (migration `…025`): automatic, `100 × (approved-and-live + 1) / (reviewed + 2)`, recomputed by a trigger on every submission status / post-state change. Shown on the creator's Profil and in Admin → Kreator.
- **Admin 2FA** (migration `…026`): TOTP required for admins, enforced in the DB — see `SECURITY.md`.
- **E2E**: `cd app && npm run e2e` (Playwright) — see `QA.md`.
- **Automatic view filtering** (migration `…030`, Admin → Ringkasan switch, Performa → "Ditahan otomatis"): every 30 minutes, tracking clips with newly recorded views are qualified at their latest raw views unless something looks off — engagement < 0.5% (≥ 5,000 views), ≥ 10× jump within 24h, views dropped, views > 50× followers, post not live, social account not verified, creator not active (thresholds in `app_settings.auto_qualify`). Held clips show the reason and wait for an admin; the reward math is the same function admins use (`private.qualify_views`), so minimum views, per-clip cap and budget cap still apply. Auto decisions appear as "Otomatis" in the qualified-views history and in the audit log.
- **Brand reporting** (migration `…029`): every raw view is accounted for — `raw = qualified (paid) + pending (recorded after the last verification) + excluded (below minimum, above per-clip cap, rejected clips, bots/spikes)`. Cost = rewards + platform fee (`app_settings.platform_fee_pct`, 15%) = total cost. The campaign budget caps rewards only; the fee is billed on top of rewards actually used (matches the Terms). **Effective CPM** = rewards per 1,000 raw views, shown next to the campaign CPM (per 1,000 qualified). Brand pages refresh themselves every minute while open and show when views were last recorded and last verified. **Daily email** at ~08:05 WIB per brand member (toggle in Brand → Akun; cron `brand-daily-report`; sent once Resend is live).
- **Meeting booking** (migration `…028`, page `/meeting`, Admin → Meeting): brands pick a 30-minute slot (Mon–Fri, 10.00–16.30 WIB, 12 hours to 45 days ahead) and leave contact details; one open request per slot, max two open per email, 30 new per hour overall. Admin confirms with a Meet/Zoom link, marks done or cancels. Emails (confirmation to the brand, alert to `admin_emails`, scheduled invite with the link) go out through the mailer once Resend is live; until then the flow works through the admin panel. Every "Jadwalkan Meeting" button on the brand page leads here.
- **YouTube auto metrics** (migration `…027`, Edge Function `fetch-metrics`, **deployed**): every 3 hours, approved/tracking YouTube submissions get their public views, likes and comments recorded from the YouTube Data API (API key only — no creator login). Videos that disappear or turn private are recorded with their last known views and flagged for an admin. Raw metrics only: qualified views are still set in Admin → Performa. To switch on: Google Cloud → enable *YouTube Data API v3* → create an API key → `npx supabase secrets set YOUTUBE_API_KEY=… --project-ref njffqsbddzztfxxbavpp` (or Dashboard → Edge Functions → Secrets), then apply `…027`. Quota: one unit per 50 videos; the free 10,000/day is plenty. TikTok/Instagram still need their OAuth apps (migration `…023`).
- **Railway** project `tapp` → `tapp-mailer` **deployed** (welcome, sign-in code, signup code, reset, brand invite, payout emails). Waiting only for the Resend API key + verified domain.
- **Admin access**: `app_settings.admin_emails` (now `tappcreators@gmail.com`) — listed emails become admin automatically once verified (migration `…021`). Add more emails to the JSON array to add admins.
- **Brand assets**: vector logo set in `brand/svg/` (mark, white/black mark, app icon, horizontal logo for dark/light backgrounds).
- **Five-tier creator system** (migration `…022`): New → Rising → Verified → Proven → Elite, automatic from lifetime qualified views (thresholds in `app_settings.tier_thresholds`: 0 / 50K / 250K / 1M / 5M). Recomputed on every `admin_qualify_views` call; notifies the creator on promotion; logged to the audit trail. Read model for the app: `my_tier_progress()` (current tier, next tier, views remaining).
- **TikTok connect** (migration `…031`, Edge Functions `tiktok-oauth` + `fetch-metrics`, **deployed, off**): creators press *Hubungkan dengan TikTok* in Akun media sosial → TikTok Login Kit → `tiktok-oauth` exchanges the code server-side, reads the username/followers and calls `oauth_complete_tiktok()`, which marks the TikTok account **verified** (login = proof of ownership) and stores tokens in Vault. Every 3h `fetch-metrics` refreshes tokens as needed and records views/likes/comments/shares of the creator's own submitted TikTok videos (`due_for_tiktok_metrics()`), which the auto-qualify sweep then picks up. `connect_platform_account` is no longer callable by clients (tokens only arrive via the server exchange). To switch on: TikTok developer app (Login Kit + Display API; redirect URI `https://njffqsbddzztfxxbavpp.supabase.co/functions/v1/tiktok-oauth`) → `npx supabase secrets set TIKTOK_CLIENT_KEY=… TIKTOK_CLIENT_SECRET=… SITE_URL=https://<site> --project-ref njffqsbddzztfxxbavpp` → apply `…031` → `update app_settings set value = jsonb_set(value,'{tiktok,enabled}','true') where key='platform_oauth_config';`. In sandbox only the app's target users can log in.
- **Auto-record foundation** (migration `…023`): creators connect TikTok/Instagram/YouTube via OAuth (`connect_platform_account` / `disconnect_platform_account`); tokens live in Supabase Vault, never a plain column. A cron sweep (every 3h, currently a no-op until `app_settings.fetch_metrics_url` is set) is meant to call a `fetch-metrics` Edge Function — **not yet built**, since it needs each platform's developer app + App Review before it can call their real API. That function would call `due_for_auto_metrics()` to find what's due, then `record_api_metrics()` to write results — both `service_role`-only, unreachable by any user. Manual admin entry keeps working unchanged in the meantime. Per-platform config (client id, scopes) lives in `app_settings.platform_oauth_config`, all three platforms currently `enabled: false`.
- **One site (Oct 2026)**: the signed-in pages ship in the same build as the landing (`site/tools/build_all.py` → `dist/`), so website buttons point at the same domain (`APP_URL: '/'` in `config.js`) and there is no separate app URL to configure.
- **Website extras**: favicons, social preview image, 404 page, robots.txt, sitemap.xml, web manifest; one command rebuilds everything for a domain: `python3 site/tools/build_all.py https://yourdomain`.
- **Hosting**: see `DEPLOY.md` — Apache `.htaccess` files ship with the site, web app and admin builds; `deploy/nginx.conf` for a VPS.
- Recommended in the Supabase dashboard: Authentication → Password security → enable **leaked password protection**.

## Next
Web only — no Android/iOS release. Remaining work is launch prep; see the checklist in `DEPLOY.md`.
