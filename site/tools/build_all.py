"""Build the whole TAPP website for a domain:   python3 site/tools/build_all.py https://yourdomain

One site, one upload. Produces dist/ at the repo root:
  /                      landing, campaigns, privacy, terms, 404 (from site/)
  /login, /dashboard/... signed-in pages: the web app, served by app.html for every path that isn't a file
  /admin/                admin panel
Upload the contents of dist/ to the domain's web root (.htaccess, nginx and Netlify rules are included).
Flags: --no-prerender skips the landing's SEO prerender (needs Playwright + Chromium).
       --skip-landing reuses the committed, prerendered landing (index.html) and only swaps in the site URL —
       what the Docker build uses, so it needs no browser."""
import os, re, sys, shutil, subprocess, pathlib
here = pathlib.Path(__file__).resolve().parent
repo = here.parents[1]
args = [a for a in sys.argv[1:] if not a.startswith('--')]
url = (args[0] if args else os.environ.get('SITE_URL', 'https://tapp.example')).rstrip('/')
env = {**os.environ, 'SITE_URL': url}
SUPA = {'url': 'https://njffqsbddzztfxxbavpp.supabase.co', 'key': 'sb_publishable_1Nl1WjCA3Ddeu4kvPtZhEA_xWCMQZ-x'}

# 1. landing + static pages (written into site/)
if '--skip-landing' not in sys.argv:
    subprocess.run([sys.executable, str(here / 'build_landing.py')] + ([] if '--no-prerender' in sys.argv else ['--prerender']), check=True, env=env)
subprocess.run([sys.executable, str(here / 'build_pages.py')], check=True, env=env)

# 2. web app at the domain root (no /app prefix)
subprocess.run(['npx', 'expo', 'export', '--platform', 'web', '--output-dir', 'dist'], cwd=repo / 'app', check=True,
               env={**os.environ, 'APP_BASE': '', 'EXPO_PUBLIC_SUPABASE_URL': SUPA['url'], 'EXPO_PUBLIC_SUPABASE_ANON_KEY': SUPA['key'], 'EXPO_PUBLIC_SITE_URL': url})

# 3. admin panel under /admin/
subprocess.run(['npx', 'vite', 'build', '--outDir', 'dist', '--emptyOutDir'], cwd=repo / 'admin', check=True,
               env={**os.environ, 'ADMIN_BASE': '/admin/', 'VITE_SUPABASE_URL': SUPA['url'], 'VITE_SUPABASE_ANON_KEY': SUPA['key'], 'VITE_APP_URL': url})

# 4. assemble
out = repo / 'dist'
shutil.rmtree(out, ignore_errors=True)
shutil.copytree(repo / 'site', out, ignore=shutil.ignore_patterns('src', 'tools', 'README.md', '__pycache__'))
app = repo / 'app' / 'dist'
for f in app.rglob('*'):
    if f.is_dir() or f.name in ('.htaccess', '_redirects', 'metadata.json'):
        continue
    rel = f.relative_to(app)
    dest = out / ('app.html' if str(rel) == 'index.html' else rel)
    if dest.exists():
        sys.exit(f'conflict: app file {rel} would overwrite site file {dest.relative_to(out)}')
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(f, dest)
shutil.copytree(repo / 'admin' / 'dist', out / 'admin')
if '--skip-landing' in sys.argv:   # committed landing was built for another URL: point canonical/og at this one
    idx = out / 'index.html'
    html = idx.read_text()
    m = re.search(r'<link rel="canonical" href="(https?://[^/"]+)/"', html)
    if m: idx.write_text(html.replace(m.group(1), url))
(out / '_redirects').write_text('/admin/*  /admin/index.html  200\n/*  /app.html  200\n')   # Netlify: files win, then the SPA
print('done:', url, '-> upload the contents of', out)
