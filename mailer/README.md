# tapp-mailer (Railway Function)

Sends every TAPP email over the **Resend HTTP API**. Railway blocks outbound SMTP on Free/Trial/Hobby plans
(SMTP is Pro-only), so Gmail SMTP will not work from Railway — HTTPS email APIs do.

| Route | Who calls it | What |
|---|---|---|
| `GET /` | you | health: shows whether the Resend key and hook secret are set |
| `GET /logo.png` | email clients | TAPP logo used in every email |
| `POST /auth-hook` | Supabase Auth (Send Email hook, signed) | sign-up OTP, password reset, email change, magic link, invite, reauth |
| `POST /send` | Supabase database (`send_app_email`, Bearer secret) | welcome (after email verified), brand invite, payout paid, payout rejected |

## Variables (Railway → service → Variables)
| Name | Value |
|---|---|
| `RESEND_API_KEY` | from resend.com → API Keys |
| `MAIL_FROM` | `TAPP <support@yourdomain>` — the domain must be verified in Resend |
| `REPLY_TO` | `tappcreators@gmail.com` |
| `SUPPORT_EMAIL` | `tappcreators@gmail.com` (or support@yourdomain later) |
| `MAILER_SECRET` | the value stored in Supabase Vault as `mailer_secret` |
| `SEND_EMAIL_HOOK_SECRET` | from Supabase → Auth → Hooks → Send Email (`v1,whsec_...`) |
| `APP_URL` | website address, e.g. `https://yourdomain` (the signed-in pages live on the same site) |

## Live now
- Railway project **tapp** → function **tapp-mailer** → `https://tapp-mailer-production.up.railway.app`
- Already set: `MAILER_SECRET` (same as Supabase Vault `mailer_secret`), `REPLY_TO`, `SUPPORT_EMAIL`, `PUBLIC_URL`
- Supabase `app_settings.mailer_url` points at it; verified from the database: health 200, unauthenticated /send 401, authenticated /send reaches Resend step.
- Still missing: `RESEND_API_KEY`, `MAIL_FROM`, `APP_URL`, `SEND_EMAIL_HOOK_SECRET`.

## Order of setup (do not enable the Supabase hook before step 3 works)
1. **Resend**: sign up, add your domain, add the DNS records it shows at your domain host, wait for "Verified". Create an API key.
2. **Railway**: project `tapp` → function `tapp-mailer` (code: `index.ts`) → set the variables above → generate a domain.
   Open `https://<railway-domain>/` — it must show `"resend": true`.
3. **Database → mailer**: in Supabase SQL: 
   `insert into app_settings (key, value) values ('mailer_url', to_jsonb('https://<railway-domain>'::text)), ('app_url', to_jsonb('https://yourdomain'::text)) on conflict (key) do update set value = excluded.value;`
   From now on brand invites and payout outcomes are emailed automatically.
5. **Sign-in verification** (optional but recommended, only after 4 works): `update app_settings set value = 'true'::jsonb where key = 'require_login_otp';`
   Every sign-in then needs the password **and** a 6-digit code emailed to the user; password-only sessions are refused by the API (PostgREST pre-request `check_request`). Set back to `false` to turn it off.
4. **Supabase Auth hook**: Authentication → Hooks → **Send Email** → HTTPS → URL `https://<railway-domain>/auth-hook` → generate secret → copy it into Railway `SEND_EMAIL_HOOK_SECRET` → save the hook. Do a test sign-up.

If Resend is down or misconfigured, the hook returns an error and Supabase shows "Email tidak terkirim" instead of silently dropping the code.
