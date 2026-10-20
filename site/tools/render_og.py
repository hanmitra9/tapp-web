"""Renders the social share cover (site/assets/og-image.png, 1200x630) from HTML with Chromium.
Run: python3 site/tools/render_og.py"""
import base64, pathlib
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'assets'
def data(rel, mime):   # inline every asset: a page set from a string can't load file:// URLs
    return f'data:{mime};base64,' + base64.b64encode((ASSETS / rel).read_bytes()).decode()
MARK = data('tapp-mark.svg', 'image/svg+xml')

# Cover in the landing hero's style: near-black canvas, blue glow, and the TAPP "T" extruded in 3D at the centre.
LAYERS = 30
MASK = f'-webkit-mask:url({MARK}) center/contain no-repeat;mask:url({MARK}) center/contain no-repeat'
SIDES = ''.join(f'<div class="t side" style="transform:translate({i * .9:.1f}px,{i * 1.1:.1f}px);'
                f'background:linear-gradient(160deg,hsl(214 78% {34 - i * .7:.0f}%),hsl(222 80% {20 - i * .4:.0f}%))"></div>'
                for i in range(LAYERS, 0, -1))
HTML = f'''<!doctype html><html><head><meta charset="utf-8"><style>
*{{margin:0;box-sizing:border-box}}
body{{width:1200px;height:630px;overflow:hidden;position:relative;background:#07080D}}
.bg{{position:absolute;inset:0;background:radial-gradient(520px 380px at 50% 52%,rgba(12,101,196,.45),rgba(12,60,140,.12) 55%,transparent 75%),
  radial-gradient(900px 240px at 50% 0%,rgba(117,178,244,.10),transparent 70%)}}
.grid{{position:absolute;inset:0;background-image:radial-gradient(rgba(150,180,230,.16) 1px,transparent 1.4px);background-size:28px 28px;
  -webkit-mask-image:radial-gradient(ellipse 60% 70% at 50% 50%,#000 10%,transparent 70%)}}
.ring{{position:absolute;left:50%;top:50%;border-radius:50%;border:1px solid rgba(117,178,244,.18)}}
.floor{{position:absolute;left:50%;top:505px;width:420px;height:60px;margin-left:-210px;border-radius:50%;
  background:radial-gradient(closest-side,rgba(46,128,240,.55),rgba(12,60,140,.2) 60%,transparent)}}
.wrap{{position:absolute;left:50%;top:50%;width:340px;height:340px;margin:-180px 0 0 -170px;
  transform:perspective(1100px) rotateY(-20deg) rotateX(10deg);transform-style:preserve-3d;
  filter:drop-shadow(0 0 40px rgba(46,128,240,.55)) drop-shadow(0 30px 40px rgba(0,0,0,.7))}}
.t{{position:absolute;inset:0;{MASK}}}
.face{{background:linear-gradient(165deg,#FFFFFF 0%,#D6E8FF 28%,#7DB6FF 58%,#2E80F0 82%,#1A56C8 100%)}}
.gloss{{background:linear-gradient(120deg,rgba(255,255,255,0) 35%,rgba(255,255,255,.75) 46%,rgba(255,255,255,0) 56%);mix-blend-mode:screen}}
.rim{{transform:translate(-1.2px,-1.2px);background:rgba(255,255,255,.9);z-index:-1}}
</style></head><body>
<div class="bg"></div><div class="grid"></div>
<div class="ring" style="width:470px;height:470px;margin:-235px 0 0 -235px"></div>
<div class="ring" style="width:640px;height:640px;margin:-320px 0 0 -320px;border-color:rgba(117,178,244,.08)"></div>
<div class="floor"></div>
<div class="wrap">{SIDES}<div class="t rim"></div><div class="t face"></div><div class="t gloss"></div></div>
</body></html>'''

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args=['--no-sandbox'])
    pg = b.new_page(viewport={'width': 1200, 'height': 630})
    pg.set_content(HTML, wait_until='networkidle'); pg.wait_for_timeout(400)
    pg.screenshot(path=str(ROOT / 'assets' / 'og-image.png'))
    b.close()
print('wrote', ROOT / 'assets' / 'og-image.png')
