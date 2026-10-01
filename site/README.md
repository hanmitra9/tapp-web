# TAPP website (tapp landing + campaigns + legal)

Static site. `python3 site/tools/build_all.py https://yourdomain` also builds the web app into `site/app/` and the admin panel into `site/admin/`, so one upload serves everything. Pages:
- `index.html` — landing (Creator / Brand), prerendered for SEO, interactive via `assets/landing.js`
- `campaigns.html` — live list of open campaigns (reads `public_campaigns()` from Supabase, read-only)
- `privacy.html`, `terms.html` — Kebijakan Privasi & Syarat Layanan (add the legal entity name/address once registered; have them reviewed)
- `404.html`, `robots.txt`, `sitemap.xml`, `site.webmanifest`, icons and social preview image (`assets/og-image.png`)

## Settings — `assets/config.js` (edit, then redeploy; no rebuild)
| Key | What |
|---|---|
| `APP_URL` | Web app address. Default `/app` (bundled in this folder) — leave it unless the app is hosted elsewhere. |
| `SUPPORT_EMAIL` | Every contact link. Now `tappcreators@gmail.com`; switch to `support@<domain>` once you have one. |
| `DISCORD_URL`, `INSTAGRAM_URL`, `WHATSAPP_URL` | Leave empty to hide the link (the floating Discord button and empty footer columns hide too). |

## Deploy
See `../DEPLOY.md` (cPanel/Apache `.htaccess` included, Nginx config in `../deploy/`).
Before uploading, rebuild for your domain so links, sitemap and social previews use it:
`python3 site/tools/build_all.py https://yourdomain`

## Editing the landing design
The design lives in `src/landing.dc.html` (same file as the design canvas). Its generator is in `src/generator/`.
After changing it: `python3 site/tools/build_all.py https://yourdomain` (needs Playwright + Chromium for the prerender).
