# Deploying TAPP on your own domain

TAPP is **one website**. The landing page, the signed-in pages (login, dashboard, campaigns, payouts…) and the
admin panel are built together and uploaded as one folder.

```bash
cd app && npm i && cd ../admin && npm i && cd ..
pip install playwright && python3 -m playwright install chromium   # once, for the landing's SEO prerender

python3 site/tools/build_all.py https://tapp.id
```
Upload the **contents of `dist/`** to the domain's web root (cPanel `public_html`, or `/var/www/tapp` on a VPS).

| URL | What |
|---|---|
| `/`, `/campaigns`, `/privacy`, `/terms` | Landing and public pages |
| `/login`, `/register`, `/dashboard`, `/dashboard/campaigns`, `/campaign/…`, `/brand`… | Signed-in pages (served by `app.html` for any path that isn't a file) |
| `/admin/` | Admin panel |

Rules for this are included: `.htaccess` (Apache/cPanel — enable "show hidden files" when uploading),
`deploy/nginx.conf` (VPS), `_redirects` (Netlify). Turn on free SSL (AutoSSL / Let's Encrypt).

## After uploading
1. Supabase → Authentication → URL Configuration → **Site URL** = `https://tapp.id`; add `https://tapp.id/**` to Redirect URLs.
2. SQL: `insert into app_settings (key, value) values ('app_url', to_jsonb('https://tapp.id'::text)) on conflict (key) do update set value = excluded.value;`
3. Railway `tapp-mailer` → variable `APP_URL` = `https://tapp.id` (buttons in emails).
4. `site/assets/config.js` keeps `APP_URL: '/'` (same site). Social links and the support email live there too; it can be edited on the server without rebuilding.

## Check
- Landing → Sign Up / Log In open `/register` / `/login` with the same header and style.
- `/campaigns` → "Ambil campaign" while signed out → login → back on that campaign.
- Signed in, open `/` → the header shows **Dashboard**.
- Refresh a deep URL (e.g. `/dashboard/campaigns`) — must not 404.
- `/admin/` → Masuk works.
