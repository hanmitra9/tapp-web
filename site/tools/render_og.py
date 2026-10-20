"""Renders the social share cover (site/assets/og-image.png, 1200x630) from HTML with Chromium.
Run: python3 site/tools/render_og.py"""
import base64, pathlib
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'assets'
def data(rel, mime):   # inline every asset: a page set from a string can't load file:// URLs
    return f'data:{mime};base64,' + base64.b64encode((ASSETS / rel).read_bytes()).decode()
MARK = data('tapp-mark.svg', 'image/svg+xml')

# Cover: a deep blue gradient with the TAPP "T" in 3D at the centre (extruded layers, lit face, soft glow and floor shadow).
LAYERS = 22
EXTRUDE = ''.join(
    f'<div class="t" style="transform:translate({-i*0.9:.1f}px,{i*1.15:.1f}px);background:linear-gradient(160deg,#1B3FB8,#0B1E6E {40 + i}%,#061048)"></div>'
    for i in range(LAYERS, 0, -1))
HTML = f'''<!doctype html><html><head><meta charset="utf-8"><style>
*{{margin:0;box-sizing:border-box}}
body{{width:1200px;height:630px;overflow:hidden;position:relative;
  background:radial-gradient(900px 600px at 50% 38%,#2F6BFF 0%,#1446D6 30%,#0A2A8F 58%,#051347 82%,#030A26 100%)}}
.sheen{{position:absolute;inset:0;background:radial-gradient(600px 260px at 50% 0%,rgba(170,205,255,.35),transparent 70%)}}
.vig{{position:absolute;inset:0;background:radial-gradient(ellipse 75% 75% at 50% 45%,transparent 55%,rgba(2,6,24,.65))}}
.floor{{position:absolute;left:50%;top:478px;width:420px;height:60px;margin-left:-210px;border-radius:50%;
  background:radial-gradient(closest-side,rgba(2,8,40,.75),transparent);filter:blur(6px)}}
.wrap{{position:absolute;left:50%;top:50%;width:340px;height:340px;margin:-196px 0 0 -170px;
  transform:perspective(1200px) rotateY(-18deg) rotateX(8deg)}}
.t{{position:absolute;inset:0;-webkit-mask:url({MARK}) center/contain no-repeat;mask:url({MARK}) center/contain no-repeat}}
.face{{background:linear-gradient(150deg,#E8F0FF 0%,#8FB4FF 28%,#4C7DFF 55%,#2A55E8 80%,#1D3FC4 100%);
  filter:drop-shadow(0 0 30px rgba(120,170,255,.55))}}
.gloss{{background:linear-gradient(115deg,rgba(255,255,255,.75) 0%,rgba(255,255,255,.15) 35%,transparent 50%);mix-blend-mode:screen}}
.rim{{background:linear-gradient(180deg,rgba(255,255,255,.9),rgba(255,255,255,0) 18%);opacity:.35}}
.glow{{position:absolute;left:50%;top:50%;width:620px;height:620px;margin:-330px 0 0 -310px;border-radius:50%;
  background:radial-gradient(closest-side,rgba(110,160,255,.45),transparent 70%);filter:blur(10px)}}
</style></head><body>
<div class="sheen"></div><div class="glow"></div><div class="floor"></div>
<div class="wrap">{EXTRUDE}<div class="t face"></div><div class="t gloss"></div><div class="t rim"></div></div>
<div class="vig"></div>
</body></html>'''

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args=['--no-sandbox'])
    pg = b.new_page(viewport={'width': 1200, 'height': 630})
    pg.set_content(HTML, wait_until='networkidle'); pg.wait_for_timeout(400)
    pg.screenshot(path=str(ROOT / 'assets' / 'og-image.png'))
    b.close()
print('wrote', ROOT / 'assets' / 'og-image.png')
