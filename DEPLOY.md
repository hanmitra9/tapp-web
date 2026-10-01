# Deploying TAPP on your own domain

Three separate things to upload. Build each with its own command; none of the build output lives inside
another folder, so you can host them on different (sub)domains or servers if you want.

| Part | Source | Build with | Output |
|---|---|---|---|
| Website | `site/` | `python3 site/tools/build_app.py` *(see below)* → actually: `python3 site/tools/build_all.py URL` | `site/` itself (already built, `.htaccess` included) |
| Web app | `app/` | `python3 site/tools/build_app.py URL` | `app/dist/` |
| Admin panel | `admin/` | `python3 site/tools/build_admin.py ADMIN_URL APP_URL` | `admin/dist/` |

## Option A — three subdomains (simplest DNS, recommended)
`tapp.id`, `app.tapp.id`, `admin.tapp.id`.

```bash
cd app && npm i && cd ../admin && npm i && cd ..
pip install playwright && python3 -m playwright install chromium     # once, for the website's SEO prerender

python3 site/tools/build_all.py   https://tapp.id
python3 site/tools/build_app.py   https://app.tapp.id
python3 site/tools/build_admin.py https://admin.tapp.id https://app.tapp.id
```
Upload:
- contents of `site/` → `tapp.id` web root
- contents of `app/dist/` → `app.tapp.id` web root
- contents of `admin/dist/` → `admin.tapp.id` web root

Each already has its own `.htaccess` (enable "show hidden files" when uploading via cPanel File Manager). Turn on free SSL (AutoSSL / Let's Encrypt) for all three.

## Option B — one domain, sub-paths (`/app`, `/admin`)
If you can only get one subdomain working, or prefer a single site:
```bash
python3 site/tools/build_all.py   https://tapp.id
python3 site/tools/build_app.py                      # defaults to /app
python3 site/tools/build_admin.py                     # defaults to /admin, app at /app
```
Upload `site/` to the web root, then copy `app/dist/` into `site_root/app/` and `admin/dist/` into `site_root/admin/` on the server (or just upload them as extra folders alongside `site/`'s contents).

## After uploading (either option)
1. `site/assets/config.js` → set `APP_URL` to wherever you put the app (e.g. `https://app.tapp.id` or `/app`), then re-upload that one file (or re-run `build_all.py`, it doesn't touch config.js). Add social links here too.
2. Supabase → Authentication → URL Configuration → **Site URL** = your app URL; add it to Redirect URLs too.
3. SQL: `insert into app_settings (key, value) values ('app_url', to_jsonb('<your app URL>'::text)) on conflict (key) do update set value = excluded.value;`
4. Railway `tapp-mailer` → variable `APP_URL` = your app URL (buttons in emails).

## VPS (Nginx)
`deploy/nginx.conf` sets up Option A (three server blocks) under `/var/www/tapp/{site,app,admin}`. Build as in Option A, copy each output into place, run certbot for all three subdomains.

## Check
- Website → Sign Up / Log In open the app and land on the right screen.
- `/campaigns` → "Ambil campaign" while signed out → login → back on that campaign.
- Refresh a deep app URL (e.g. the campaigns list) — must not 404.
- Admin URL → Daftar / Masuk work.
