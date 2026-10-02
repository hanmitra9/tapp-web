"""Build the sub-pages (campaigns, privacy, terms) with the shared header/footer. Run: python3 site/tools/build_pages.py"""
import os, pathlib
SITE_URL = os.environ.get('SITE_URL', 'https://tappcreators.com').rstrip('/')
ROOT = pathlib.Path(__file__).resolve().parents[1]

def head(title, desc, path=''):
    return f'''<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content="{desc}">
<meta name="theme-color" content="#07070A">
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
<link rel="canonical" href="__SITE_URL__/{path}">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:url" content="__SITE_URL__/{path}">
<link rel="preload" href="assets/fonts/Geist-Variable.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="assets/site.css">
</head>
<body>
<div class="wrap">
<div class="glow-top" aria-hidden="true"></div>'''

def header(active):
    on = lambda k: ' on' if k == active else ''
    return f'''<header class="top">
  <a class="logo" href="index.html" aria-label="TAPP beranda"><img src="assets/tapp-mark.svg" alt=""></a>
  <nav><a class="nl{on('campaigns')}" href="campaigns.html">Campaigns</a><a class="nl" href="index.html#alur">Cara Kerja</a><a class="nl" href="#mail">Contact</a><a class="nl" href="#app:/login">Log In</a></nav>
  <a class="btn" href="#app:/register" style="height: 42px; padding: 0 20px; font-size: 14px">Sign Up</a>
</header>'''

FOOT = '''<footer class="bot">
  <div class="cols">
    <div class="col" style="max-width: 340px"><span style="display: flex; align-items: center; gap: 10px; font-weight: 600; font-size: 20px"><img src="assets/tapp-mark.svg" alt="" style="width: 26px; height: 26px">TAPP</span><span style="color: #9A9AA5; font-weight: 400; line-height: 24px">Platform distribusi konten berbasis performa. Brand membayar hasil yang terverifikasi, creator dibayar untuk kerja yang terbukti.</span></div>
    <div class="col"><b>Navigation</b><a class="nl" href="index.html">Home</a><a class="nl" href="campaigns.html">Campaigns</a><a class="nl" href="index.html#alur">Cara Kerja</a><a class="nl" href="index.html#faq">FAQ</a><a class="nl" href="privacy.html">Kebijakan Privasi</a><a class="nl" href="terms.html">Syarat Layanan</a></div>
    <div class="col" data-hide-empty><b>Social</b><a class="nl" href="#instagram">Instagram</a><a class="nl" href="#discord">Discord</a></div>
    <div class="col" data-hide-empty><b>Contact</b><a class="nl" href="#mail">Email Support</a><a class="nl" href="#whatsapp" data-config-text="WHATSAPP_LABEL">WhatsApp Creator</a><a class="nl" href="#whatsapp-brand" data-config-text="WHATSAPP_BRAND_LABEL">WhatsApp Brand</a></div>
  </div>
  <div class="copy">© 2026 TAPP. Hak cipta dilindungi.</div>
</footer>
</div>
<script src="assets/config.js"></script>
<script src="assets/links.js"></script>'''

# ───────────────────────────── Campaigns (live) ─────────────────────────────
CAMPAIGNS = head('Campaign TAPP: yang sedang dibuka', 'Daftar campaign yang sedang dibuka di TAPP: tarif per 1.000 views, minimal views, dan platform.', 'campaigns') + header('campaigns') + '''
<main>
  <div style="display: flex; flex-direction: column; gap: 18px; align-items: flex-start; margin-bottom: 36px">
    <span class="pill">Campaign terbuka</span>
    <h1 class="h1">Brief yang<br><span>Sedang Dibuka</span></h1>
    <p class="lead">Diperbarui langsung dari sistem TAPP. Pilih brief yang cocok, bergabung, dan mulai mengedit dari akunmu sendiri.</p>
  </div>
  <div role="toolbar" aria-label="Filter platform" id="filters" style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 24px"></div>
  <div id="list" aria-live="polite" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 18px"></div>
</main>
''' + FOOT + r'''
<script>
(function () {
  var c = window.TAPP_CONFIG || {};
  var list = document.getElementById('list'), filters = document.getElementById('filters');
  var ICON = {
    tiktok: '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-label="TikTok"><path d="M16.6 5.8A4.3 4.3 0 0 1 15 3.2h-2.7v11.6a2.3 2.3 0 1 1-2.4-2.3c.2 0 .5 0 .7.1V9.8a5.1 5.1 0 1 0 4.4 5V9.2c1 .7 2.2 1.1 3.5 1.1V7.6c-.8 0-1.6-.3-2.3-.8z"/></svg>',
    instagram: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-label="Instagram"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/></svg>',
    youtube: '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-label="YouTube"><path d="M21.6 7.2a2.6 2.6 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.6 2.6 0 0 0 2.4 7.2 27 27 0 0 0 2 12a27 27 0 0 0 .4 4.8 2.6 2.6 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.6 2.6 0 0 0 1.8-1.8A27 27 0 0 0 22 12a27 27 0 0 0-.4-4.8zM10 15V9l5.2 3z"/></svg>'
  };
  var NAME = { tiktok: 'TikTok', instagram: 'Instagram', youtube: 'YouTube', x: 'X', facebook: 'Facebook', other: 'Lainnya' };
  var nf = new Intl.NumberFormat('id-ID');
  var short = function (n) { return n >= 1000 ? nf.format(Math.round(n / 100) / 10) + 'K' : nf.format(n); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]; }); };
  var app = (c.APP_URL || '').replace(/\/$/, '');
  var all = [], active = 'all';

  function deadline(iso) {
    if (!iso) return 'Tanpa batas waktu';
    var d = Math.ceil((new Date(iso) - Date.now()) / 864e5);
    return d <= 0 ? 'Berakhir hari ini' : d + ' hari lagi';
  }
  function card(k) {
    var maxViews = k.max_earning_per_submission ? Math.round(k.max_earning_per_submission / k.cpm * 1000) : null;
    var icons = (k.platforms || []).map(function (p) { return '<span style="display: inline-flex; color: #D4D4D8">' + (ICON[p] || esc(NAME[p] || p)) + '</span>'; }).join('');
    var href = c.APP_URL ? app + '/campaign/' + encodeURIComponent(k.id) : '#';
    return '<article style="border-radius: 18px; overflow: hidden; background: linear-gradient(180deg, #131318, #0C0C10); border: 1px solid rgba(255,255,255,0.08); display: flex; flex-direction: column">'
      + (/^https:\/\//.test(k.banner_url || '')
        ? '<div style="position: relative; aspect-ratio: 2 / 1; overflow: hidden; background: #131318"><img src="' + esc(k.banner_url) + '" alt="' + esc(k.title) + '" loading="lazy" style="width: 100%; height: 100%; object-fit: cover; display: block"></div>'
        : '<div style="position: relative; height: 150px; overflow: hidden; background: radial-gradient(70% 90% at 80% 30%, #7DA2FF, transparent 60%), linear-gradient(135deg, #0E1A6B, #4548F5)">'
          + '<img src="assets/tapp-mark-white.svg" alt="" style="position: absolute; right: 26px; top: 34px; width: 74px; height: 74px; filter: drop-shadow(0 0 24px rgba(198,214,255,0.8))">'
          + '<span style="position: absolute; left: 20px; bottom: 16px; font-size: 26px; line-height: 28px; font-weight: 600; letter-spacing: -0.6px; max-width: 60%">' + esc(k.title) + '</span></div>')
      + '<div style="padding: 18px 20px 20px; display: flex; flex-direction: column; gap: 12px">'
      + '<span style="display: flex; align-items: center; gap: 8px; font-weight: 600; font-size: 14px">' + esc(k.brand_name) + (k.status === 'ending' ? '<span style="margin-left: auto; font-size: 12px; color: #FFB020">Segera berakhir</span>' : '') + '</span>'
      + '<span class="tab"><span style="font-size: 22px; font-weight: 600">Rp' + nf.format(k.cpm) + '</span><span style="font-size: 13px; color: #8A8A93; font-weight: 500"> /1K views</span></span>'
      + '<div style="display: flex; align-items: center; gap: 10px">' + icons + '<span style="margin-left: auto; font-size: 13px; font-weight: 500; color: #9A9AA5">' + deadline(k.submission_deadline) + '</span></div>'
      + '<div class="tab" style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px">'
      + '<span style="padding: 10px 12px; border-radius: 12px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); display: flex; flex-direction: column; gap: 2px"><span style="font-size: 11px; color: #8A8A93; font-weight: 500">Minimal klaim</span><b style="font-size: 15px">' + short(k.min_views_to_qualify || 0) + ' views</b></span>'
      + '<span style="padding: 10px 12px; border-radius: 12px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); display: flex; flex-direction: column; gap: 2px"><span style="font-size: 11px; color: #8A8A93; font-weight: 500">Maks. per clip</span><b style="font-size: 15px">' + (maxViews ? short(maxViews) + ' views' : 'Tanpa batas') + '</b></span></div>'
      + '<div style="display: flex; flex-direction: column; gap: 8px"><div class="tab" style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 500; color: #9A9AA5"><span>Budget tersisa</span><span style="color: #FFFFFF">' + k.budget_left_pct + '%</span></div>'
      + '<div style="height: 6px; border-radius: 3px; background: #1F1F26"><div style="width: ' + k.budget_left_pct + '%; height: 6px; border-radius: 3px; background: linear-gradient(90deg, #4548F5, #7DA2FF)"></div></div></div>'
      + '<a class="btn" href="' + href + '" style="height: 44px; border-radius: 12px; margin-top: 4px">Ambil campaign</a>'
      + '</div></article>';
  }
  function empty(title, body) {
    return '<div style="grid-column: 1 / -1; padding: 56px 24px; border-radius: 18px; border: 1px dashed rgba(125,162,255,0.3); background: radial-gradient(60% 80% at 50% 0%, rgba(69,72,245,0.12), transparent 70%), #0B0B0F; display: flex; flex-direction: column; align-items: center; gap: 12px; text-align: center">'
      + '<img src="assets/tapp-mark.svg" alt="" style="width: 44px; height: 44px; opacity: 0.85"><h2 style="font-size: 22px; font-weight: 600">' + title + '</h2><p style="font-size: 15px; line-height: 24px; color: #9A9AA5; max-width: 440px">' + body + '</p>'
      + '<a class="btn" href="' + (c.APP_URL ? app + '/register' : '#') + '" style="margin-top: 6px">Daftar gratis</a></div>';
  }
  function draw() {
    var shown = all.filter(function (k) { return active === 'all' || (k.platforms || []).indexOf(active) >= 0; });
    list.innerHTML = shown.length ? shown.map(card).join('') : (all.length ? empty('Belum ada campaign untuk platform ini', 'Coba pilih platform lain, atau cek lagi nanti.') : empty('Campaign pertama segera dibuka', 'Daftar sekarang supaya akunmu sudah terverifikasi saat campaign dibuka.'));
    var plats = ['all'].concat(Array.from(new Set([].concat.apply([], all.map(function (k) { return k.platforms || []; })))));
    filters.innerHTML = all.length ? plats.map(function (p) {
      var on = p === active;
      return '<button data-p="' + p + '" aria-pressed="' + on + '" style="height: 38px; padding: 0 16px; border-radius: 999px; font: inherit; font-weight: 600; font-size: 14px; cursor: pointer; ' + (on ? 'background: rgba(69,72,245,0.25); color: #FFFFFF; border: 1px solid #5B7CFA' : 'background: rgba(255,255,255,0.04); color: #A1A1AA; border: 1px solid rgba(255,255,255,0.1)') + '">' + (p === 'all' ? 'Semua' : esc(NAME[p] || p)) + '</button>';
    }).join('') : '';
    filters.querySelectorAll('button').forEach(function (b) { b.onclick = function () { active = b.getAttribute('data-p'); draw(); }; });
  }
  list.innerHTML = [0, 1, 2].map(function () { return '<div style="height: 420px; border-radius: 18px; background: linear-gradient(90deg, #0F0F13, #16161C, #0F0F13); border: 1px solid rgba(255,255,255,0.06)"></div>'; }).join('');
  fetch(c.SUPABASE_URL + '/rest/v1/rpc/public_campaigns', { method: 'POST', headers: { apikey: c.SUPABASE_ANON_KEY, 'Content-Type': 'application/json' }, body: '{}' })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (rows) { all = rows || []; draw(); })
    .catch(function () { list.innerHTML = '<div style="grid-column: 1 / -1; padding: 32px; border-radius: 18px; background: rgba(255,90,95,0.1); border: 1px solid rgba(255,90,95,0.35); color: #FFB4B6">Daftar campaign belum bisa dimuat. Periksa koneksi lalu muat ulang halaman.</div>'; });
})();
</script>
</body>
</html>
'''
(ROOT / 'campaigns.html').write_text(CAMPAIGNS.replace('__SITE_URL__', SITE_URL))

# ───────────────────────────── Meeting booking (brands) ─────────────────────────────
MEETING = head('Jadwalkan Meeting dengan TAPP', 'Pilih jadwal 30–60 menit dengan tim TAPP untuk membahas tujuan, audiens, platform, dan budget campaign brand-mu.', 'meeting') + header('meeting') + '''
<main>
  <div class="mtg">
    <div style="display: flex; flex-direction: column; gap: 18px; align-items: flex-start">
      <span class="pill">Book a Meeting</span>
      <h1 class="h1">Jadwalkan<br><span>Meeting Strategi</span></h1>
      <p class="lead">Pilih waktu yang paling longgar. Kita petakan tujuan, audiens, platform, dan tarif per 1.000 views. Kamu pulang dengan angka yang jelas, bukan janji.</p>
      <div class="mtg-points">
        <div><b>30–60 menit</b><span>Online, link dikirim lewat email</span></div>
        <div><b>Tanpa biaya</b><span>Tidak ada komitmen sampai brief disetujui</span></div>
        <div><b>Senin–Jumat</b><span>10.00–17.00 WIB</span></div>
      </div>
    </div>
    <form id="mtg" class="mtg-card" novalidate>
      <div class="mtg-step"><span class="mtg-n">01</span><b>Pilih tanggal</b></div>
      <div class="cal-head"><button type="button" id="prev" aria-label="Bulan sebelumnya">&#8249;</button><b id="month"></b><button type="button" id="next" aria-label="Bulan berikutnya">&#8250;</button></div>
      <div class="cal" id="cal" role="grid" aria-label="Tanggal"></div>
      <div class="mtg-step"><span class="mtg-n">02</span><b>Pilih jam <span class="mtg-muted">(WIB)</span></b></div>
      <div class="slots" id="slots" aria-live="polite"><span class="mtg-muted">Pilih tanggal dulu.</span></div>
      <div class="mtg-step"><span class="mtg-n">03</span><b>Tentang brand-mu</b></div>
      <div class="fgrid">
        <label>Nama<input name="name" autocomplete="name" required maxlength="80"></label>
        <label>Brand / perusahaan<input name="company" autocomplete="organization" required maxlength="120"></label>
        <label>Email kerja<input name="email" type="email" autocomplete="email" required maxlength="160"></label>
        <label><span>WhatsApp <span class="mtg-muted">(opsional)</span></span><input name="whatsapp" type="tel" autocomplete="tel" placeholder="+62…" maxlength="20"></label>
        <label class="wide">Perkiraan budget<select name="budget"><option value="">Belum tahu</option><option value="<10jt">Di bawah Rp10 juta</option><option value="10-50jt">Rp10–50 juta</option><option value="50-100jt">Rp50–100 juta</option><option value=">100jt">Di atas Rp100 juta</option></select></label>
        <label class="wide"><span>Tujuan campaign <span class="mtg-muted">(opsional)</span></span><textarea name="goal" rows="3" maxlength="1000" placeholder="Misal: launching produk baru, target Gen Z di TikTok"></textarea></label>
      </div>
      <div id="msg" role="alert"></div>
      <button class="btn" id="go" type="submit" style="width: 100%; height: 50px">Kirim Permintaan Meeting</button>
    </form>
  </div>
  '''+(ROOT / 'src' / 'generator' / 'contact_cards.html').read_text()+'''
</main>
<style>
.mtg{display:grid;grid-template-columns:minmax(0,0.9fr) minmax(0,1.1fr);gap:56px;align-items:start}
.mtg-points{display:flex;flex-direction:column;gap:10px;margin-top:10px;width:100%}
.mtg-points div{display:flex;flex-direction:column;gap:2px;padding:14px 16px;border-radius:14px;background:#0F0F13;border:1px solid var(--line)}
.mtg-points b{font-size:15px}.mtg-points span{font-size:14px;color:var(--t2)}
.mtg-card{display:flex;flex-direction:column;gap:14px;padding:24px;border-radius:20px;background:linear-gradient(180deg,#15151D,#0D0D12 55%,#0A0A0E);border:1px solid rgba(255,255,255,0.08);box-shadow:inset 0 1px 0 rgba(255,255,255,0.05),0 30px 70px -40px rgba(69,72,245,0.7)}
.mtg-step{display:flex;align-items:center;gap:10px;margin-top:6px;font-size:15px}
.mtg-n{display:inline-flex;width:28px;height:28px;align-items:center;justify-content:center;border-radius:9px;background:rgba(69,72,245,0.18);border:1px solid rgba(125,162,255,0.35);font-size:12px;color:var(--bl2)}
.mtg-muted{color:var(--t3);font-weight:400}
.cal-head{display:flex;align-items:center;justify-content:space-between}
.cal-head button{width:34px;height:34px;border-radius:10px;border:1px solid var(--line);background:#111116;color:#F4F4F5;font-size:20px;cursor:pointer}
.cal-head button:disabled{opacity:.3;cursor:default}
.cal{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px;text-align:center}
.cal .dow{font-size:12px;color:var(--t3);padding:4px 0}
.cal button{height:40px;border-radius:10px;border:1px solid transparent;background:transparent;color:#D4D4D8;font:inherit;font-size:14px;cursor:pointer}
.cal button:hover:not(:disabled){background:#17171E}
.cal button:disabled{color:#3F3F46;cursor:default}
.cal button.on,.slots button.on{background:linear-gradient(180deg,#7A88FF,#4F57F5);border-color:rgba(198,214,255,0.4);color:#FFFFFF}
.slots{display:grid;grid-template-columns:repeat(auto-fill,minmax(78px,1fr));gap:8px;min-height:40px}
.slots button{height:38px;border-radius:10px;border:1px solid var(--line);background:#111116;color:#E4E4E7;font:inherit;font-size:14px;cursor:pointer;font-variant-numeric:tabular-nums}
.slots button:disabled{text-decoration:line-through;color:#4A4A52;cursor:default}
.fgrid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.fgrid label{display:flex;flex-direction:column;gap:6px;font-size:13px;color:var(--t2)}
.fgrid .wide{grid-column:1/-1}
.fgrid input,.fgrid select,.fgrid textarea{font:inherit;font-size:15px;color:#F4F4F5;background:#0B0B10;border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:11px 12px;outline:none}
.fgrid input:focus,.fgrid select:focus,.fgrid textarea:focus{border-color:#7A88FF}
#msg:empty{display:none}
#msg{padding:12px 14px;border-radius:12px;font-size:14px;line-height:21px}
#msg.err{background:rgba(255,90,95,0.1);border:1px solid rgba(255,90,95,0.35);color:#FFB4B6}
.mtg-done{display:flex;flex-direction:column;gap:12px;align-items:flex-start}
.mtg-done h2{font-size:26px;font-weight:500;letter-spacing:-0.02em}
.mtg-done p{color:var(--t2);font-size:15px;line-height:24px}
@media (max-width:900px){.bcontact{grid-template-columns:minmax(0,1fr) !important}.mtg{grid-template-columns:minmax(0,1fr);gap:32px}.fgrid{grid-template-columns:minmax(0,1fr)}.mtg-card{padding:18px}}
</style>
''' + FOOT + r'''
<script>
(function () {
  var c = window.TAPP_CONFIG || {};
  var form = document.getElementById('mtg'), cal = document.getElementById('cal'), slotsEl = document.getElementById('slots'), msg = document.getElementById('msg');
  var monthEl = document.getElementById('month'), prev = document.getElementById('prev'), next = document.getElementById('next'), go = document.getElementById('go');
  var MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  var DOW = ['Sen','Sel','Rab','Kam','Jum','Sab','Min'];
  var TIMES = []; for (var h = 10; h <= 16; h++) { TIMES.push([h, 0]); TIMES.push([h, 30]); }
  // Jakarta is UTC+7 all year (no DST): a WIB wall-clock time maps to one fixed instant.
  var jkt = function (y, m, d, h, mi) { return new Date(Date.UTC(y, m, d, h - 7, mi)); };
  var nowJ = new Date(Date.now() + 7 * 3600e3);                     // "now" read as Jakarta wall clock via UTC getters
  var today = { y: nowJ.getUTCFullYear(), m: nowJ.getUTCMonth(), d: nowJ.getUTCDate() };
  var minAt = Date.now() + 12 * 3600e3, maxAt = Date.now() + 45 * 864e5;   // same window the server enforces
  var view = { y: today.y, m: today.m }, day = null, slot = null, taken = {};
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };

  function bookable(y, m, d) {
    var dow = new Date(Date.UTC(y, m, d)).getUTCDay();             // 0 Sunday
    if (dow === 0 || dow === 6) return false;
    return TIMES.some(function (t) { var at = jkt(y, m, d, t[0], t[1]).getTime(); return at >= minAt && at <= maxAt; });
  }
  function drawCal() {
    monthEl.textContent = MONTHS[view.m] + ' ' + view.y;
    prev.disabled = view.y === today.y && view.m === today.m;
    var lastAllowed = new Date(maxAt + 7 * 3600e3);
    next.disabled = view.y > lastAllowed.getUTCFullYear() || (view.y === lastAllowed.getUTCFullYear() && view.m >= lastAllowed.getUTCMonth());
    var first = (new Date(Date.UTC(view.y, view.m, 1)).getUTCDay() + 6) % 7, days = new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate();
    var html = DOW.map(function (d) { return '<span class="dow">' + d + '</span>'; }).join('');
    for (var i = 0; i < first; i++) html += '<span></span>';
    for (var d = 1; d <= days; d++) {
      var ok = bookable(view.y, view.m, d), on = day && day.y === view.y && day.m === view.m && day.d === d;
      html += '<button type="button" data-d="' + d + '"' + (ok ? '' : ' disabled') + (on ? ' class="on" aria-pressed="true"' : '') + '>' + d + '</button>';
    }
    cal.innerHTML = html;
    cal.querySelectorAll('button[data-d]').forEach(function (b) { b.onclick = function () { day = { y: view.y, m: view.m, d: +b.getAttribute('data-d') }; slot = null; drawCal(); drawSlots(); }; });
  }
  function drawSlots() {
    if (!day) { slotsEl.innerHTML = '<span class="mtg-muted">Pilih tanggal dulu.</span>'; return; }
    slotsEl.innerHTML = TIMES.map(function (t) {
      var at = jkt(day.y, day.m, day.d, t[0], t[1]), iso = at.toISOString(), ms = at.getTime();
      var off = ms < minAt || ms > maxAt || taken[ms];
      return '<button type="button" data-iso="' + iso + '"' + (off ? ' disabled' : '') + (slot === iso ? ' class="on" aria-pressed="true"' : '') + '>' + pad(t[0]) + '.' + pad(t[1]) + '</button>';
    }).join('');
    slotsEl.querySelectorAll('button[data-iso]').forEach(function (b) { b.onclick = function () { slot = b.getAttribute('data-iso'); drawSlots(); }; });
  }
  prev.onclick = function () { view.m--; if (view.m < 0) { view.m = 11; view.y--; } drawCal(); };
  next.onclick = function () { view.m++; if (view.m > 11) { view.m = 0; view.y++; } drawCal(); };
  drawCal();

  var api = function (fn, body) {
    return fetch(c.SUPABASE_URL + '/rest/v1/rpc/' + fn, { method: 'POST', headers: { apikey: c.SUPABASE_ANON_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) { var e = new Error(j.message || ('http_' + r.status)); throw e; } return j; }); });
  };
  api('meeting_slots_taken', { p_days: 45 }).then(function (rows) { (rows || []).forEach(function (iso) { taken[new Date(iso).getTime()] = true; }); drawSlots(); }).catch(function () {});

  var ERR = {
    meeting_slot_taken: 'Jam itu baru saja diambil. Pilih jam lain.',
    meeting_slot_invalid: 'Jam itu di luar jadwal meeting. Pilih jam lain.',
    meeting_slot_out_of_range: 'Pilih jadwal minimal 12 jam dari sekarang dan maksimal 45 hari ke depan.',
    meeting_too_many_open: 'Email ini sudah punya permintaan meeting yang menunggu konfirmasi. Kami akan segera menghubungimu.',
    meeting_rate_limited: 'Sedang banyak permintaan. Coba lagi beberapa menit lagi.',
  };
  function fail(text, withMail) {
    msg.className = 'err';
    msg.innerHTML = text + (withMail && c.SUPPORT_EMAIL ? ' Atau kirim email ke <a href="' + mailto() + '" style="color:#C6D6FF;text-decoration:underline">' + c.SUPPORT_EMAIL + '</a>.' : '');
  }
  function mailto() {
    var f = form.elements, when = slot ? new Date(slot).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'full', timeStyle: 'short' }) + ' WIB' : '-';
    var body = 'Nama: ' + f.name.value + '\nBrand: ' + f.company.value + '\nWhatsApp: ' + f.whatsapp.value + '\nJadwal pilihan: ' + when + '\nBudget: ' + f.budget.value + '\nTujuan: ' + f.goal.value;
    return 'mailto:' + c.SUPPORT_EMAIL + '?subject=' + encodeURIComponent('Permintaan meeting: ' + f.company.value) + '&body=' + encodeURIComponent(body);
  }
  form.onsubmit = function (e) {
    e.preventDefault(); msg.textContent = '';
    var f = form.elements;
    if (!slot) return fail('Pilih tanggal dan jam meeting dulu.');
    if (f.name.value.trim().length < 2) return fail('Isi namamu.');
    if (f.company.value.trim().length < 2) return fail('Isi nama brand atau perusahaan.');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.value.trim())) return fail('Email belum valid.');
    var wa = f.whatsapp.value.trim();
    if (wa && !/^\+?[0-9][0-9 -]{7,19}$/.test(wa)) return fail('Nomor WhatsApp belum valid.');
    go.disabled = true; go.textContent = 'Mengirim…';
    api('request_meeting', { p_name: f.name.value.trim(), p_company: f.company.value.trim(), p_email: f.email.value.trim(), p_slot: slot,
      p_whatsapp: wa || null, p_goal: f.goal.value.trim() || null, p_budget_range: f.budget.value || null })
      .then(function () {
        var when = new Date(slot).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
        form.innerHTML = '<div class="mtg-done"><span class="mtg-n">&#10003;</span><h2>Permintaan terkirim</h2><p>Jadwal pilihanmu: <b style="color:#F4F4F5">' + when + ' WIB</b>. Tim TAPP akan mengonfirmasi dan mengirim link meeting ke <b style="color:#F4F4F5">' + f.email.value.trim().replace(/[<>&"]/g, '') + '</b>, biasanya dalam 1 hari kerja.</p><a class="btn ghost" href="index.html?mode=brand">Kembali ke beranda</a></div>';
      })
      .catch(function (err) {
        go.disabled = false; go.textContent = 'Kirim Permintaan Meeting';
        var key = Object.keys(ERR).filter(function (k) { return String(err.message).indexOf(k) === 0; })[0];
        if (key === 'meeting_slot_taken') { taken[new Date(slot).getTime()] = true; slot = null; drawSlots(); }
        if (key) fail(ERR[key]); else fail('Permintaan belum terkirim karena gangguan koneksi.', true);
      });
  };
})();
</script>
</body>
</html>
'''
(ROOT / 'meeting.html').write_text(MEETING.replace('__SITE_URL__', SITE_URL))

# ───────────────────────────── Legal pages ─────────────────────────────
def legal(fname, title, lead, sections, desc):
    toc = ''.join(f'<a href="#{sid}">{t}</a>' for sid, t, _ in sections)
    body = ''.join(f'<h2 id="{sid}">{t}</h2>{html}' for sid, t, html in sections)
    page = head(f'{title} | TAPP', desc, fname.replace('.html', '')) + header('') + f'''
<main>
  <div style="display: flex; flex-direction: column; gap: 16px; align-items: flex-start">
    <span class="pill">Berlaku sejak 30 September 2026</span>
    <h1 class="h1">{title}</h1>
    <p class="lead">{lead}</p>
  </div>
  <div class="legal">
    <nav class="toc" aria-label="Daftar isi">{toc}</nav>
    <article class="doc">{body}
      <p class="note">Dokumen ini disusun sebagai dasar awal dan perlu ditinjau oleh konsultan hukum sebelum TAPP diluncurkan secara resmi. Setelah TAPP memiliki badan usaha, nama dan alamat resminya perlu ditambahkan di dokumen ini.</p>
    </article>
  </div>
</main>
''' + FOOT + '\n</body>\n</html>\n'
    (ROOT / fname).write_text(page.replace('__SITE_URL__', SITE_URL))

P = lambda *xs: ''.join(f'<p>{x}</p>' for x in xs)
UL = lambda *xs: '<ul>' + ''.join(f'<li>{x}</li>' for x in xs) + '</ul>'
MAIL = '<a href="#mail">email support TAPP</a>'

legal('privacy.html', 'Kebijakan Privasi', 'Bagaimana TAPP mengumpulkan, memakai, dan melindungi data pribadimu saat kamu memakai website dan aplikasi TAPP.', [
  ('ringkas', 'Ringkasan', P('TAPP adalah platform distribusi konten berbasis performa yang dikelola oleh tim TAPP ("TAPP", "kami"). Kebijakan ini menjelaskan data yang kami kumpulkan dari creator, brand, dan pengunjung, untuk apa data itu dipakai, dan hak yang kamu miliki berdasarkan Undang-Undang Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi.', 'Kami tidak menjual data pribadimu. Data dipakai untuk menjalankan campaign, memverifikasi views, membayar creator, dan menjaga platform dari penipuan.')),
  ('data', 'Data yang kami kumpulkan', '<h3>Data yang kamu berikan</h3>' + UL('Akun: nama lengkap, username, email, kata sandi (disimpan dalam bentuk terenkripsi), negara, dan kota.', 'Profil creator: niche konten, jenis konten, gaya konten, gambaran audiens, dan tingkat pengalaman.', 'Akun media sosial: platform, username, link profil, dan jumlah pengikut yang kamu masukkan.', 'Metode pencairan: nama bank atau e-wallet, nama pemilik, dan nomor rekening atau nomor e-wallet.', 'Submission: link postingan, tanggal posting, catatan, dan tangkapan layar yang kamu unggah.', 'Pesan ke tim TAPP: pertanyaan support dan pengajuan keberatan.') + '<h3>Data yang tercatat saat kamu memakai TAPP</h3>' + UL('Metrik postingan: views, likes, komentar, share, dan simpanan yang dicatat tim TAPP atau diambil otomatis lewat API resmi platform untuk menghitung qualified views.', 'Riwayat aktivitas penting di akun, misalnya perubahan metode pencairan dan keputusan review, untuk keperluan audit dan keamanan.', 'Data penggunaan aplikasi dan website secara umum (halaman yang dibuka, fitur yang dipakai) yang dikaitkan hanya dengan ID akun, tanpa nama atau email.', 'Token perangkat untuk mengirim notifikasi push, jika kamu mengaktifkannya.')),
  ('terhubung', 'Akun TikTok dan Instagram yang kamu hubungkan', P('Jika kamu menekan "Hubungkan dengan TikTok" atau "Hubungkan dengan Instagram", kamu login langsung di TikTok atau Instagram dan memberi izin kepada TAPP. Kami tidak pernah melihat kata sandi akun tersebut.') + UL(
    '<b>Yang kami ambil:</b> ID akun, username, jumlah pengikut, serta views, likes, komentar, share, dan simpanan dari postingan yang <b>kamu submit ke campaign</b>. Postingan lain tidak kami simpan.',
    '<b>Untuk apa:</b> membuktikan akun itu milikmu (satu akun hanya untuk satu creator) dan menghitung bayaranmu per 1.000 qualified views secara otomatis.',
    '<b>Yang tidak kami lakukan:</b> memposting, mengirim pesan, atau mengubah apa pun di akunmu, dan menjual atau membagikan data ini ke pihak lain selain brand campaign terkait (sebatas metrik clip).',
    '<b>Keamanan:</b> token akses disimpan terenkripsi dan hanya dipakai di server TAPP.',
    f'<b>Memutus dan menghapus data:</b> kamu bisa mencabut izin kapan saja dari pengaturan aplikasi TikTok/Instagram, atau meminta kami lewat {MAIL}. Saat diputus, token langsung dihapus. Untuk penghapusan seluruh data, lihat bagian "Hak kamu".')),
  ('pakai', 'Untuk apa data dipakai', UL('Membuat dan mengelola akun, serta memverifikasi email dan akun media sosialmu.', 'Mencocokkan creator dengan campaign yang relevan berdasarkan niche, platform, dan rekam jejak.', 'Mereview submission dan memverifikasi views, termasuk mendeteksi bot, akun palsu, dan lonjakan views yang janggal.', 'Menghitung penghasilan dan memproses pencairan ke rekening bank atau e-wallet milikmu.', 'Menyusun laporan campaign untuk brand.', 'Mengirim notifikasi terkait akun, campaign, submission, dan pencairan.', 'Menanggapi pertanyaan support dan keberatan.', 'Memenuhi kewajiban hukum, termasuk perpajakan dan pencegahan penipuan.')),
  ('bagi', 'Dengan siapa data dibagikan', UL('<b>Brand</b> yang campaign-nya kamu kerjakan dapat melihat username TAPP-mu, link postingan, platform, dan metrik clip untuk campaign tersebut. Brand tidak melihat email, nomor rekening, atau data pencairanmu.', '<b>Penyedia layanan</b> yang membantu TAPP beroperasi: penyimpanan data dan autentikasi (Supabase), pengiriman email, analitik produk (PostHog), dan hosting website. Mereka hanya memproses data sesuai instruksi kami.', '<b>Bank dan penyedia e-wallet</b> saat kami memproses pencairan.', '<b>Otoritas yang berwenang</b> jika diwajibkan oleh hukum.') + P('Sebagian penyedia layanan dapat menyimpan data di server di luar Indonesia. Dalam hal itu kami memastikan ada perlindungan yang memadai sesuai ketentuan pelindungan data pribadi yang berlaku.')),
  ('simpan', 'Berapa lama data disimpan', P('Data akun disimpan selama akunmu aktif. Catatan keuangan (penghasilan dan pencairan) serta catatan audit disimpan selama diwajibkan oleh ketentuan perpajakan dan akuntansi, paling lama 10 (sepuluh) tahun setelah transaksi sesuai ketentuan perpajakan. Setelah akun ditutup, data yang tidak lagi dibutuhkan dihapus atau dianonimkan.')),
  ('aman', 'Keamanan data', P('Akses ke data dibatasi per peran: creator hanya melihat datanya sendiri, brand hanya melihat data campaign miliknya, dan admin TAPP bekerja lewat fungsi yang tercatat. Kata sandi disimpan dalam bentuk terenkripsi, koneksi memakai HTTPS, dan riwayat perubahan sensitif dicatat. Nomor rekening di catatan audit hanya disimpan empat digit terakhir.')),
  ('hak', 'Hak kamu', UL('Mengakses dan mendapatkan salinan data pribadimu.', 'Memperbaiki data yang tidak akurat, sebagian besar bisa langsung lewat halaman profil di aplikasi.', 'Meminta penghapusan data atau penutupan akun, dengan pengecualian data yang wajib kami simpan menurut hukum.', 'Menarik persetujuan, misalnya mematikan notifikasi push.', 'Mengajukan keberatan atas pemrosesan data tertentu.') + P(f'Ajukan permintaan lewat {MAIL}. Kami menanggapi paling lambat 3 x 24 jam untuk konfirmasi penerimaan dan menyelesaikannya sesuai jangka waktu yang ditetapkan peraturan.')),
  ('anak', 'Pengguna di bawah umur', P('TAPP ditujukan untuk pengguna berusia 17 tahun ke atas. Pengguna berusia 17 tahun yang belum dewasa menurut hukum harus mendapat izin orang tua atau wali untuk mendaftar dan menerima pembayaran. Jika kami mengetahui akun dibuat tanpa izin tersebut, akun dapat dibatasi.')),
  ('ubah', 'Perubahan kebijakan', P('Kami dapat memperbarui kebijakan ini. Perubahan penting akan kami umumkan lewat aplikasi atau email sebelum berlaku. Tanggal berlaku terbaru selalu tercantum di bagian atas halaman ini.')),
  ('kontak', 'Kontak', P(f'Pertanyaan tentang privasi dapat dikirim ke {MAIL}. Kami menanggapi dalam 3 x 24 jam hari kerja.')),
], 'Kebijakan Privasi TAPP: data yang dikumpulkan, penggunaannya, dan hak pengguna menurut UU PDP.')

legal('terms.html', 'Syarat Layanan', 'Aturan memakai TAPP untuk creator dan brand. Dengan membuat akun, kamu menyetujui syarat ini.', [
  ('umum', 'Ketentuan umum', P('Syarat Layanan ini mengatur penggunaan website dan aplikasi TAPP yang dikelola oleh tim TAPP ("TAPP", "kami"). TAPP mempertemukan brand yang ingin kontennya didistribusikan dengan creator yang membuat dan memposting clip pendek, lalu membayar creator berdasarkan views yang lolos verifikasi.', 'Dengan mendaftar atau memakai TAPP, kamu menyetujui Syarat Layanan ini dan <a href="privacy.html">Kebijakan Privasi</a>.')),
  ('akun', 'Akun', UL('Kamu harus berusia minimal 17 tahun. Jika belum dewasa menurut hukum, kamu wajib mendapat izin orang tua atau wali.', 'Data yang kamu masukkan harus benar dan milikmu sendiri. Satu orang hanya boleh memiliki satu akun creator.', 'Akun media sosial yang dihubungkan harus milikmu dan hanya boleh terhubung ke satu akun TAPP.', 'Kamu bertanggung jawab menjaga kerahasiaan kata sandi dan semua aktivitas di akunmu.', 'Akun creator dapat digunakan untuk campaign setelah disetujui tim TAPP.')),
  ('creator', 'Ketentuan untuk creator', '<h3>Campaign dan submission</h3>' + UL('Setiap campaign punya brief, tarif per 1.000 views, platform, batas waktu, minimal views untuk klaim, dan batas maksimal per clip. Aturan di halaman campaign berlaku untuk campaign tersebut.', 'Clip harus diposting dari akun yang terhubung ke profil TAPP-mu, setelah kamu bergabung ke campaign, dan dikirim sebelum batas waktu.', 'Satu postingan hanya boleh disubmit satu kali di seluruh TAPP.', 'Tim TAPP dapat menyetujui, meminta revisi, menolak, atau menandai submission. Alasannya akan ditampilkan kepadamu.') + '<h3>Penghasilan</h3>' + UL('Penghasilan dihitung dari qualified views, yaitu views yang lolos verifikasi, dikali tarif campaign per 1.000 views, sampai batas maksimal per clip dan selama budget campaign masih tersedia.', 'Setelah clip diterima, tim TAPP mentransfer bayarannya langsung ke rekening bank atau e-wallet atas nama yang sesuai di profilmu. Tidak ada saldo yang perlu ditarik.', 'Tidak ada potongan fee dari bayaranmu. Creator level Rising ke atas mendapat bonus tarif dari TAPP di atas bayaran clip, makin tinggi level makin besar bonusnya. Jumlah yang ditransfer terlihat di riwayat pembayaranmu.', 'Kamu bertanggung jawab atas kewajiban pajak atas penghasilanmu, kecuali TAPP diwajibkan memotong pajak menurut peraturan yang berlaku.') + '<h3>Yang dilarang</h3>' + UL('Membeli views, memakai bot, akun palsu, atau cara lain untuk menaikkan angka secara tidak wajar.', 'Memakai akun media sosial milik orang lain.', 'Mengirim ulang postingan lama, postingan orang lain, atau konten yang menyesatkan.', 'Menghapus atau mengubah postingan menjadi privat sebelum masa pelacakan campaign selesai.', 'Konten yang melanggar hukum, hak cipta, atau pedoman komunitas platform tempat konten diposting.') + P('Pelanggaran dapat membuat submission ditolak, penghasilan dari submission tersebut dibatalkan, dan akun ditangguhkan atau ditutup.')),
  ('brand', 'Ketentuan untuk brand', UL('Akses brand dibuka lewat undangan dari tim TAPP.', 'Brief, tarif per 1.000 views, platform, dan budget reward disepakati bersama TAPP sebelum campaign disetujui. Setelah disetujui, syarat komersial campaign terkunci.', 'Brand membayar reward untuk qualified views ditambah fee platform sebesar 15% dari reward yang terpakai.', 'Pengeluaran reward tidak melebihi budget campaign. Saat budget habis, campaign berhenti membayar views baru.', 'Brand menjamin memiliki hak atas konten sumber dan materi yang diberikan kepada creator.')),
  ('konten', 'Konten dan hak kekayaan intelektual', P('Konten sumber dan materi brand tetap milik brand. Creator memperoleh izin terbatas untuk memakai materi tersebut hanya untuk campaign yang diikuti. Clip yang diposting creator tetap berada di akun creator. Dengan mengirim submission, creator memberi TAPP dan brand terkait izin untuk menampilkan link, cuplikan, dan metrik clip tersebut dalam laporan campaign dan materi promosi TAPP.', 'Nama, logo, dan tampilan TAPP adalah milik TAPP dan tidak boleh dipakai tanpa izin tertulis.')),
  ('keberatan', 'Keberatan dan support', P(f'Jika kamu tidak setuju dengan keputusan review atau pembayaran, ajukan keberatan dari aplikasi. Tim TAPP akan meninjau ulang dan mengabarkan keputusannya. Pertanyaan lain dapat dikirim lewat menu Bantuan di aplikasi atau {MAIL}.')),
  ('tutup', 'Penangguhan dan penutupan akun', P('Kamu dapat meminta penutupan akun kapan saja. Clip yang sudah diterima akan dibayar terlebih dahulu. TAPP dapat menangguhkan atau menutup akun yang melanggar Syarat Layanan ini, dengan memberitahukan alasannya.')),
  ('batas', 'Batasan tanggung jawab', P('TAPP disediakan sebagaimana adanya. Metrik bergantung pada data dari platform media sosial pihak ketiga yang dapat berubah atau tidak tersedia. Sejauh diizinkan hukum, TAPP tidak bertanggung jawab atas kerugian tidak langsung, termasuk kehilangan pendapatan, akibat gangguan layanan pihak ketiga, perubahan kebijakan platform, atau tindakan pengguna lain.')),
  ('hukum', 'Hukum yang berlaku', P('Syarat Layanan ini diatur oleh hukum Republik Indonesia. Perselisihan akan diupayakan diselesaikan secara musyawarah terlebih dahulu, dan jika tidak berhasil, melalui Pengadilan Negeri Denpasar.')),
  ('ubah', 'Perubahan syarat', P('Kami dapat memperbarui Syarat Layanan ini. Perubahan penting akan diumumkan lewat aplikasi atau email sebelum berlaku. Dengan tetap memakai TAPP setelah perubahan berlaku, kamu menyetujui syarat yang baru.')),
], 'Syarat Layanan TAPP untuk creator dan brand: akun, campaign, penghasilan, pencairan, dan aturan konten.')

# ───────────────────────────── 404 ─────────────────────────────
NOTFOUND = head('Halaman tidak ditemukan | TAPP', 'Halaman ini tidak ada di TAPP.', '404') + header('') + """
<main style="min-height: 60vh; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 18px">
  <img src="assets/tapp-mark.svg" alt="" style="width: 72px; height: 72px; filter: drop-shadow(0 0 24px rgba(69,72,245,0.45))">
  <span class="pill">404</span>
  <h1 class="h1">Halaman Ini<br><span>Tidak Ditemukan</span></h1>
  <p class="lead">Mungkin link-nya salah atau halamannya sudah dipindah.</p>
  <div style="display: flex; gap: 12px; flex-wrap: wrap; justify-content: center"><a class="btn" href="index.html">Ke beranda</a><a class="btn ghost" href="campaigns.html">Lihat campaign</a></div>
</main>
""" + FOOT + '\n</body>\n</html>\n'
# 404 pages are served from any path, so asset links must be absolute
(ROOT / '404.html').write_text(NOTFOUND.replace('__SITE_URL__', SITE_URL).replace('href="assets/', 'href="/assets/').replace('src="assets/', 'src="/assets/').replace('href="index.html', 'href="/index.html').replace('href="campaigns.html', 'href="/campaigns.html').replace('href="privacy.html', 'href="/privacy.html').replace('href="terms.html', 'href="/terms.html').replace('href="site.webmanifest', 'href="/site.webmanifest').replace('href="assets/fonts', 'href="/assets/fonts'))

# ───────────────────────────── robots + sitemap ─────────────────────────────
(ROOT / 'robots.txt').write_text(f"User-agent: *\nAllow: /\nDisallow: /src/\nDisallow: /tools/\n\nSitemap: {SITE_URL}/sitemap.xml\n")
urls = ['', 'campaigns', 'privacy', 'terms', 'meeting']
(ROOT / 'sitemap.xml').write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
  + ''.join(f'  <url><loc>{SITE_URL}/{u}</loc><changefreq>{"daily" if u == "campaigns" else "weekly"}</changefreq></url>\n' for u in urls) + '</urlset>\n')
print('pages built for', SITE_URL)
