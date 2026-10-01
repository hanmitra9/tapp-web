"""Build the TAPP admin panel:   python3 site/tools/build_admin.py https://yourdomain/admin https://yourdomain/app
Writes to admin/dist/ (not inside site/) — upload that folder to wherever your admin URL points."""
import os, sys, subprocess, pathlib
repo = pathlib.Path(__file__).resolve().parents[2]
admin_target = sys.argv[1] if len(sys.argv) > 1 else '/admin'
app_url = sys.argv[2] if len(sys.argv) > 2 else '/app'
base = (admin_target if admin_target.startswith('/') else '/' + admin_target.split('/', 3)[-1]).rstrip('/') + '/'
subprocess.run(['npx', 'vite', 'build', '--outDir', 'dist', '--emptyOutDir'], cwd=repo / 'admin', check=True,
               env={**os.environ, 'ADMIN_BASE': base, 'VITE_SUPABASE_URL': 'https://njffqsbddzztfxxbavpp.supabase.co',
                    'VITE_SUPABASE_ANON_KEY': 'sb_publishable_1Nl1WjCA3Ddeu4kvPtZhEA_xWCMQZ-x', 'VITE_APP_URL': app_url})
print('built admin/dist for', admin_target)
