# Deploying TAPP on your own domain

TAPP is **one website**. The landing page, the signed-in pages (login, dashboard, campaigns, payouts…) and the
admin panel are built together and uploaded as one folder.

```bash
cd app && npm i && cd ../admin && npm i && cd ..
pip install playwright && python3 -m playwright install chromium   # once, for the landing's SEO prerender

python3 site/tools/build_all.py https://tappcreators.com
```
Upload the **contents of `dist/`** to the domain's web root (cPanel `public_html`, or `/var/www/tapp` on a VPS).

| URL | What |
|---|---|
| `/`, `/campaigns`, `/privacy`, `/terms` | Landing and public pages |
| `/login`, `/register`, `/dashboard`, `/dashboard/campaigns`, `/campaign/…`, `/brand`… | Signed-in pages (served by `app.html` for any path that isn't a file) |
| `/admin/` | Admin panel |

Rules for this are included: `.htaccess` (Apache/cPanel — enable "show hidden files" when uploading),
`deploy/nginx.conf` (VPS), `_redirects` (Netlify). Turn on free SSL (AutoSSL / Let's Encrypt).

## Railway (Docker)
The repo's `Dockerfile` builds everything (landing is taken prerendered from the repo) and serves it with nginx on `$PORT`.
Create a service from this GitHub repo in Railway, generate a domain, and set the service variable `SITE_URL` to that
URL (used for canonical/og links). Every push to the deployed branch redeploys.

## Cloudflare (domain + hosting in one place, no Railway)
Buy the domain in Cloudflare Registrar, then Workers & Pages → Create → Pages → connect this GitHub repo:
- Production branch `main`, build command `bash deploy/cloudflare-pages.sh`, output directory `dist`
- Variables: `SITE_URL=https://<domain>`, `NODE_VERSION=22`, `PYTHON_VERSION=3.11`
- Custom domains → add the domain (DNS and SSL are set up automatically since the domain is on Cloudflare)

Routing comes from `dist/_redirects` (`/admin/*` → admin, everything else that isn't a file → `app.html`). After the
first deploy, check `/`, `/privacy`, `/login`, `/dashboard` and `/admin/` load; then the Railway service can be removed.

## After uploading
1. Supabase → Authentication → URL Configuration → **Site URL** = `https://tappcreators.com`; add `https://tappcreators.com/**` to Redirect URLs.
2. SQL: `insert into app_settings (key, value) values ('app_url', to_jsonb('https://tappcreators.com'::text)) on conflict (key) do update set value = excluded.value;`
3. Railway `tapp-mailer` → variable `APP_URL` = `https://tappcreators.com` (buttons in emails).
4. `site/assets/config.js` keeps `APP_URL: '/'` (same site). Social links and the support email live there too; it can be edited on the server without rebuilding.

## Check
- Landing → Sign Up / Log In open `/register` / `/login` with the same header and style.
- `/campaigns` → "Ambil campaign" while signed out → login → back on that campaign.
- Signed in, open `/` → the header shows **Dashboard**.
- Refresh a deep URL (e.g. `/dashboard/campaigns`) — must not 404.
- `/admin/` → Masuk works.
