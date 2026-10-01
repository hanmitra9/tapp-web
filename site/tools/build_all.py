"""Build the TAPP website for a domain:   python3 site/tools/build_all.py https://yourdomain

Writes only site/ (landing, campaigns, privacy, terms, 404, robots.txt, sitemap.xml) — the website's own
pages. The web app and admin panel are separate builds; see build_app.py / build_admin.py, or DEPLOY.md
for the full picture of what goes where."""
import os, sys, subprocess, pathlib
here = pathlib.Path(__file__).resolve().parent
url = (sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith('--') else os.environ.get('SITE_URL', 'https://tapp.example')).rstrip('/')
env = {**os.environ, 'SITE_URL': url}
subprocess.run([sys.executable, str(here / 'build_landing.py'), '--prerender'], check=True, env=env)
subprocess.run([sys.executable, str(here / 'build_pages.py')], check=True, env=env)
print('done:', url)
