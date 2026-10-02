"""Build site/index.html from the landing design (src/landing.dc.html).

  - template -> <template id="tpl">, logic -> assets/landing.js (with a tiny renderer)
  - canvas asset URLs -> local files in assets/
  - --prerender: bake the creator view into the HTML (SEO / no-JS) using Playwright
Run:  python3 site/tools/build_landing.py --prerender
"""
import re, sys, os, pathlib
SITE_URL = os.environ.get('SITE_URL', 'https://tappcreators.com').rstrip('/')
ROOT = pathlib.Path(__file__).resolve().parents[1]
src = (ROOT / 'src' / 'landing.dc.html').read_text()
src = src.replace('/_blob/58aec98a357608dc6fa8a4a440fc9214', 'assets/tapp-mark.svg').replace('/_blob/2d5aebeddb5d0a63b818258d6ea37530', 'assets/tapp-mark-white.svg')
helmet = re.search(r'<helmet>(.*?)</helmet>', src, re.S).group(1)
tpl = re.search(r'</helmet>(.*)</x-dc>', src, re.S).group(1)
logic = re.search(r'<script type="text/x-dc" data-dc-script[^>]*>(.*?)</script>', src, re.S).group(1)

RUNTIME = r'''
// Minimal renderer for the landing template: {{holes}}, <sc-if>, <sc-for>, on* handlers, setState re-render.
class DCLogic { constructor(props) { this.props = props || {}; this.state = {}; } setState(p) { Object.assign(this.state, p); window.__tappRender(); } }
(function () {
  const get = (ctx, path) => path.trim().split('.').reduce((o, k) => (o == null ? undefined : o[k]), ctx);
  const interp = (str, ctx) => str.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, p) => { const v = /^(true|false)$/.test(p) ? p === 'true' : get(ctx, p); return v == null ? '' : String(v); });
  function renderInto(parent, nodes, ctx) {
    for (const n of nodes) {
      if (n.nodeType === 3) { parent.appendChild(document.createTextNode(interp(n.textContent, ctx))); continue; }
      if (n.nodeType !== 1) continue;
      const tag = n.localName;
      if (tag === 'sc-if') { const m = n.getAttribute('value').match(/\{\{\s*(.+?)\s*\}\}/); if (get(ctx, m[1])) renderInto(parent, n.childNodes, ctx); continue; }
      if (tag === 'sc-for') { const list = get(ctx, n.getAttribute('list').match(/\{\{\s*(.+?)\s*\}\}/)[1]) || []; const as = n.getAttribute('as');
        list.forEach((it, i) => renderInto(parent, n.childNodes, { ...ctx, [as]: it, $index: i })); continue; }
      const el = document.createElementNS(n.namespaceURI, tag);
      for (const a of n.attributes) {
        const whole = a.value.match(/^\{\{\s*(.+?)\s*\}\}$/);
        // The HTML parser lowercases onClick -> onclick, so match handlers case-insensitively.
        if (/^on[a-z]+$/i.test(a.name)) { const fn = whole && get(ctx, whole[1]); const ev = a.name.slice(2).toLowerCase(); if (typeof fn === 'function') el.addEventListener(ev === 'change' ? 'input' : ev, fn); continue; }
        el.setAttribute(a.name, interp(a.value, ctx));
      }
      renderInto(el, n.childNodes, ctx);
      parent.appendChild(el);
    }
  }
  window.__tappMount = function (Component) {
    const tpl = document.getElementById('tpl').content;
    const root = document.getElementById('root');
    const mode = new URLSearchParams(location.search).get('mode') === 'brand' ? 'brand' : 'creator';
    const inst = new Component({ startMode: mode });
    window.__tappRender = () => {
      const frag = document.createDocumentFragment();
      renderInto(frag, tpl.childNodes, inst.renderVals());
      root.replaceChildren(frag);
      if (window.TAPP_applyLinks) window.TAPP_applyLinks(root);
    };
    window.__tappRender();
  };
})();
'''
(ROOT / 'assets' / 'landing.js').write_text(RUNTIME + '\n' + logic.strip() + '\nwindow.__tappMount(Component);\n')

head_links = '\n'.join(re.findall(r'<link[^>]*>', helmet))
style = re.search(r'<style>(.*?)</style>', helmet, re.S).group(1)
def page(root_html=''):
    return f'''<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>TAPP: Dibayar untuk setiap view yang nyata</title>
<meta name="description" content="TAPP mempertemukan brand dan creator short-form. Creator dibayar untuk setiap 1.000 views yang lolos verifikasi, brand hanya membayar hasil yang terbukti.">
<meta name="theme-color" content="#07070A">
<meta property="og:title" content="TAPP: Dibayar untuk setiap view yang nyata">
<meta property="og:description" content="Kerjakan campaign dari brand, posting di akunmu sendiri, dan dibayar dari views yang lolos verifikasi.">
<link rel="icon" href="assets/tapp-mark.svg" type="image/svg+xml">
<link rel="icon" href="assets/icons/favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="assets/icons/apple-touch-icon.png">
<link rel="manifest" href="site.webmanifest">
<meta property="og:type" content="website">
<meta property="og:site_name" content="TAPP">
<meta property="og:locale" content="id_ID">
<meta property="og:image" content="__SITE_URL__/assets/og-image.png">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<link rel="canonical" href="__SITE_URL__/">
<meta property="og:url" content="__SITE_URL__/">
{head_links}
<style>{style}</style>
</head>
<body>
<div id="root">{root_html}</div>
<template id="tpl">{tpl}</template>
<script src="assets/config.js"></script>
<script src="assets/links.js"></script>
<script src="assets/landing.js"></script>
</body>
</html>
'''
(ROOT / 'index.html').write_text(page().replace('__SITE_URL__', SITE_URL))

if '--prerender' in sys.argv:
    import asyncio, threading, http.server, functools
    from playwright.async_api import async_playwright
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', 8791), functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT)))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    async def go():
        async with async_playwright() as p:
            b = await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args=['--no-sandbox'])
            pg = await b.new_page()
            await pg.goto('http://127.0.0.1:8791/index.html', wait_until='load')
            await pg.wait_for_timeout(800)
            html = await pg.evaluate("document.getElementById('root').innerHTML")
            await b.close()
            return html
    (ROOT / 'index.html').write_text(page(asyncio.run(go())).replace('__SITE_URL__', SITE_URL))
print('built', (ROOT / 'index.html').stat().st_size, 'bytes')
