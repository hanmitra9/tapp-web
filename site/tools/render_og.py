"""Renders the social share cover (site/assets/og-image.png, 1200x630) from HTML with Chromium.
Run: python3 site/tools/render_og.py"""
import base64, pathlib
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'assets'
def data(rel, mime):   # inline every asset: a page set from a string can't load file:// URLs
    return f'data:{mime};base64,' + base64.b64encode((ASSETS / rel).read_bytes()).decode()
MARK = data('tapp-mark.svg', 'image/svg+xml')

# Cover in the landing hero's style: near-black canvas, the TAPP app tile glowing at the centre, rings and
# light circuits running out to both sides.
PATHS = ['M600 315 C 470 315, 420 250, 250 250 S 60 250, 0 250', 'M600 315 C 470 315, 430 390, 260 390 S 70 390, 0 390',
         'M600 315 C 730 315, 780 230, 950 230 S 1140 230, 1200 230', 'M600 315 C 730 315, 770 410, 940 410 S 1130 410, 1200 410']
CIRC = ''.join(f'<path d="{d}" stroke="#0C65C4" stroke-width="7" opacity=".45" filter="url(#b)"/><path d="{d}" stroke="#75B2F4" stroke-width="1.6" opacity=".9"/>'
               + f'<path d="{d}" stroke="#E6F1FF" stroke-width="2.4" stroke-dasharray="26 1400" stroke-dashoffset="-{120 + i * 90}" stroke-linecap="round"/>'
               for i, d in enumerate(PATHS))
DOTS = ''.join(f'<circle cx="{x}" cy="{y}" r="{r}" fill="#9CC3FF" opacity="{o}"/>' for x, y, r, o in
               [(180, 120, 1.6, .5), (330, 520, 1.2, .4), (470, 160, 1.4, .6), (760, 120, 1.6, .55), (880, 520, 1.3, .45), (1030, 150, 1.2, .4), (1110, 500, 1.6, .5), (90, 470, 1.2, .35)])
HTML = f'''<!doctype html><html><head><meta charset="utf-8"><style>
*{{margin:0;box-sizing:border-box}}
body{{width:1200px;height:630px;overflow:hidden;position:relative;background:#07080D}}
.bg{{position:absolute;inset:0;background:radial-gradient(520px 380px at 50% 50%,rgba(12,101,196,.42),rgba(12,60,140,.12) 55%,transparent 75%),
  radial-gradient(900px 240px at 50% 0%,rgba(117,178,244,.10),transparent 70%)}}
.grid{{position:absolute;inset:0;background-image:radial-gradient(rgba(150,180,230,.16) 1px,transparent 1.4px);background-size:28px 28px;
  -webkit-mask-image:radial-gradient(ellipse 60% 70% at 50% 50%,#000 10%,transparent 70%)}}
svg{{position:absolute;inset:0}}
.ring{{position:absolute;left:50%;top:50%;border-radius:50%;border:1px solid rgba(117,178,244,.22)}}
.tile{{position:absolute;left:50%;top:50%;width:250px;height:250px;margin:-125px 0 0 -125px;border-radius:64px;
  background:linear-gradient(160deg,#6FB2FF 0%,#2E80F0 38%,#1557C2 72%,#0E3F96 100%);
  box-shadow:0 0 0 1px rgba(190,220,255,.35),inset 0 2px 0 rgba(255,255,255,.55),inset 0 -14px 30px rgba(5,25,80,.55),
    0 0 70px rgba(46,128,240,.75),0 0 160px rgba(12,101,196,.55),0 40px 80px -30px rgba(0,0,0,.9)}}
.tile:before{{content:"";position:absolute;inset:0;border-radius:64px;background:linear-gradient(170deg,rgba(255,255,255,.35),rgba(255,255,255,0) 45%)}}
.mark{{position:absolute;left:50%;top:50%;width:150px;height:150px;margin:-72px 0 0 -75px;background:#fff;
  -webkit-mask:url({MARK}) center/contain no-repeat;mask:url({MARK}) center/contain no-repeat;filter:drop-shadow(0 6px 10px rgba(5,25,80,.45))}}
</style></head><body>
<div class="bg"></div><div class="grid"></div>
<svg width="1200" height="630" viewBox="0 0 1200 630" fill="none"><defs><filter id="b"><feGaussianBlur stdDeviation="4"/></filter></defs>{CIRC}{DOTS}</svg>
<div class="ring" style="width:430px;height:430px;margin:-215px 0 0 -215px"></div>
<div class="ring" style="width:600px;height:600px;margin:-300px 0 0 -300px;border-color:rgba(117,178,244,.10)"></div>
<div class="tile"></div><div class="mark"></div>
</body></html>'''

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args=['--no-sandbox'])
    pg = b.new_page(viewport={'width': 1200, 'height': 630})
    pg.set_content(HTML, wait_until='networkidle'); pg.wait_for_timeout(400)
    pg.screenshot(path=str(ROOT / 'assets' / 'og-image.png'))
    b.close()
print('wrote', ROOT / 'assets' / 'og-image.png')
