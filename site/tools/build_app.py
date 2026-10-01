"""Build the TAPP web app:   python3 site/tools/build_app.py https://yourdomain/app
Writes to app/dist/ (not inside site/) — upload that folder to wherever APP_URL points.
With no argument, builds for APP_URL=/app (same domain, sub-path — see DEPLOY.md option B)."""
import os, sys, subprocess, pathlib
repo = pathlib.Path(__file__).resolve().parents[2]
target = sys.argv[1] if len(sys.argv) > 1 else '/app'
base = target if target.startswith('/') else '/' + target.split('/', 3)[-1] if target.count('/') > 2 else ''
site_url = '' if target.startswith('/') else target.rsplit('/app', 1)[0]
subprocess.run(['npx', 'expo', 'export', '--platform', 'web', '--output-dir', 'dist'], cwd=repo / 'app', check=True,
               env={**os.environ, 'APP_BASE': base, 'EXPO_PUBLIC_SUPABASE_URL': 'https://njffqsbddzztfxxbavpp.supabase.co',
                    'EXPO_PUBLIC_SUPABASE_ANON_KEY': 'sb_publishable_1Nl1WjCA3Ddeu4kvPtZhEA_xWCMQZ-x', 'EXPO_PUBLIC_SITE_URL': site_url})
print('built app/dist for', target)
