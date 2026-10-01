# Email setup for TAPP

TAPP sends email through **tapp-mailer**, a small service on **Railway** (see `mailer/README.md`), using the **Resend** API.

Why not Gmail SMTP: Railway blocks outbound SMTP on Free, Trial and Hobby plans (SMTP is Pro-only). Resend works over HTTPS on any plan.

What gets sent:
- Auth (via Supabase's Send Email hook → mailer): verification code, password reset code, email change, magic link.
- App (via the database → mailer): brand dashboard invitation (automatic when an admin invites), payout sent, payout rejected.
- Every email: TAPP-branded, Indonesian, reply-to tappcreators@gmail.com.

## What you need
1. **Your domain** (you will host TAPP on it). Resend only sends to real users from a verified domain.
2. A **Resend** account (free: 3.000 emails/month, 100/day).
3. **support@yourdomain → tappcreators@gmail.com**: set up forwarding at your domain provider (most registrars and cPanel hosting have "Email Forwarders"; Cloudflare Email Routing is free if your DNS is on Cloudflare). Replies from users then land in the Gmail inbox.

Then follow `mailer/README.md` steps 1–4, and change `SUPPORT_EMAIL` in `site/assets/config.js` to support@yourdomain.
