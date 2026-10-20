"""Renders the social share cover (site/assets/og-image.png, 1200x630) from HTML with Chromium.
Run: python3 site/tools/render_og.py"""
import base64, pathlib
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'assets'
def data(rel, mime):   # inline every asset: a page set from a string can't load file:// URLs
    return f'data:{mime};base64,' + base64.b64encode((ASSETS / rel).read_bytes()).decode()
IT, G, MARK = data('fonts/InterTight-Variable.woff2', 'font/woff2'), data('fonts/Geist-Variable.woff2', 'font/woff2'), data('tapp-mark.svg', 'image/svg+xml')

HTML = f'''<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{{font-family:IT;src:url({IT}) format("woff2");font-weight:100 900}}
@font-face{{font-family:G;src:url({G}) format("woff2");font-weight:100 900}}
*{{margin:0;box-sizing:border-box}}
body{{width:1200px;height:630px;overflow:hidden;background:#05070F;font-family:G;color:#fff;position:relative}}
.bg{{position:absolute;inset:0;background:
  radial-gradient(620px 520px at 905px 300px,rgba(46,98,255,.55),rgba(20,50,170,.18) 45%,transparent 70%),
  radial-gradient(500px 300px at 120px 640px,rgba(12,101,196,.35),transparent 70%),
  linear-gradient(180deg,#070A16,#04050B)}}
.grid{{position:absolute;inset:0;background-image:linear-gradient(rgba(140,170,255,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(140,170,255,.06) 1px,transparent 1px);
  background-size:44px 44px;-webkit-mask-image:radial-gradient(ellipse 70% 80% at 75% 50%,#000 20%,transparent 75%)}}
.left{{position:absolute;left:84px;top:72px;width:620px}}
.brand{{display:flex;align-items:center;gap:14px;font-family:IT;font-weight:700;font-size:34px;letter-spacing:-.5px}}
.brand img{{width:42px;height:42px}}
h1{{font-family:IT;font-weight:700;font-size:92px;line-height:94px;letter-spacing:-3.5px;margin-top:70px}}
h1 span{{background:linear-gradient(90deg,#9CC3FF,#5B7CFF 55%,#7B6CFF);-webkit-background-clip:text;color:transparent}}
p{{font-size:27px;line-height:38px;color:rgba(214,224,255,.72);margin-top:26px;max-width:560px}}
.pills{{display:flex;gap:12px;margin-top:40px}}
.pill{{padding:11px 18px;border-radius:999px;font-size:19px;font-weight:600;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);color:#E4EAFF}}
.mark{{position:absolute;right:120px;top:120px;width:380px;height:380px;filter:drop-shadow(0 0 60px rgba(70,110,255,.9)) drop-shadow(0 0 14px rgba(150,180,255,.8))}}
.ring{{position:absolute;right:58px;top:58px;width:504px;height:504px;border-radius:50%;border:1px solid rgba(140,170,255,.22);box-shadow:inset 0 0 80px rgba(60,100,255,.15)}}
.ring.r2{{right:118px;top:118px;width:384px;height:384px;border-color:rgba(140,170,255,.12)}}
.card{{position:absolute;padding:16px 20px;border-radius:18px;background:rgba(12,16,32,.82);border:1px solid rgba(160,185,255,.22);
  box-shadow:0 20px 50px -20px rgba(0,0,0,.9);backdrop-filter:blur(8px);display:flex;align-items:center;gap:14px}}
.ico{{width:44px;height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:700}}
.k{{font-size:15px;color:rgba(214,224,255,.6)}} .v{{font-family:IT;font-size:26px;font-weight:700;letter-spacing:-.5px}}
</style></head><body>
<div class="bg"></div><div class="grid"></div>
<div class="ring"></div><div class="ring r2"></div>
<img class="mark" src="{MARK}">
<div class="card" style="right:430px;top:96px"><div class="ico" style="background:rgba(52,208,122,.16);color:#34D07A">+</div>
  <div><div class="k">Saldo masuk</div><div class="v" style="color:#5BE39A">Rp930.000</div></div></div>
<div class="card" style="right:70px;bottom:78px"><div class="ico" style="background:rgba(91,124,255,.18);color:#9DB4FF">▶</div>
  <div><div class="k">Qualified views</div><div class="v">1,2 jt</div></div></div>
<div class="left">
  <div class="brand"><img src="{MARK}">TAPP</div>
  <h1>Klipmu<br><span>jadi cuan.</span></h1>
  <p>Ambil campaign brand, posting di akunmu, dibayar per 1.000 views.</p>
  <div class="pills"><span class="pill">Cair mulai Rp50rb</span><span class="pill">Bonus rank s/d 15%</span></div>
</div>
</body></html>'''

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args=['--no-sandbox'])
    pg = b.new_page(viewport={'width': 1200, 'height': 630})
    pg.set_content(HTML, wait_until='networkidle'); pg.wait_for_timeout(400)
    pg.screenshot(path=str(ROOT / 'assets' / 'og-image.png'))
    b.close()
print('wrote', ROOT / 'assets' / 'og-image.png')
