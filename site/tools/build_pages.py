"""Build the sub-pages (campaigns, privacy, terms) with the shared header/footer. Run: python3 site/tools/build_pages.py"""
import os, pathlib
SITE_URL = os.environ.get('SITE_URL', 'https://tapp.example').rstrip('/')
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
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@500;600;700&display=swap" rel="stylesheet">
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
    <div class="col" style="max-width: 340px"><span style="display: flex; align-items: center; gap: 10px; font-weight: 700; font-size: 20px"><img src="assets/tapp-mark.svg" alt="" style="width: 26px; height: 26px">TAPP</span><span style="color: #9A9AA5; font-weight: 500; line-height: 24px">Platform distribusi konten berbasis performa. Mempertemukan brand dan creator, dibayar per view terverifikasi.</span></div>
    <div class="col"><b>Navigation</b><a class="nl" href="index.html">Home</a><a class="nl" href="campaigns.html">Campaigns</a><a class="nl" href="index.html#alur">Cara Kerja</a><a class="nl" href="index.html#faq">FAQ</a><a class="nl" href="privacy.html">Kebijakan Privasi</a><a class="nl" href="terms.html">Syarat Layanan</a></div>
    <div class="col" data-hide-empty><b>Social</b><a class="nl" href="#instagram">Instagram</a><a class="nl" href="#discord">Discord</a></div>
    <div class="col" data-hide-empty><b>Contact</b><a class="nl" href="#mail">Email Support</a><a class="nl" href="#whatsapp">WhatsApp</a></div>
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
    <h1 class="h1">Campaign yang<br><span>Sedang Dibuka</span></h1>
    <p class="lead">Diperbarui langsung dari TAPP. Pilih campaign, daftar, lalu mulai bikin clip dari akunmu sendiri.</p>
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
    var href = app ? app + '/campaign/' + encodeURIComponent(k.id) : '#';
    return '<article style="border-radius: 22px; overflow: hidden; background: linear-gradient(180deg, #131318, #0C0C10); border: 1px solid rgba(255,255,255,0.08); display: flex; flex-direction: column">'
      + '<div style="position: relative; height: 150px; overflow: hidden; background: radial-gradient(70% 90% at 80% 30%, #7DA2FF, transparent 60%), linear-gradient(135deg, #0E1A6B, #4548F5)">'
      + '<img src="assets/tapp-mark-white.svg" alt="" style="position: absolute; right: 26px; top: 34px; width: 74px; height: 74px; filter: drop-shadow(0 0 24px rgba(198,214,255,0.8))">'
      + '<span style="position: absolute; left: 20px; bottom: 16px; font-size: 26px; line-height: 28px; font-weight: 700; letter-spacing: -0.6px; max-width: 60%">' + esc(k.title) + '</span></div>'
      + '<div style="padding: 18px 20px 20px; display: flex; flex-direction: column; gap: 12px">'
      + '<span style="display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 14px">' + esc(k.brand_name) + (k.status === 'ending' ? '<span style="margin-left: auto; font-size: 12px; color: #FFB020">Segera berakhir</span>' : '') + '</span>'
      + '<span class="tab"><span style="font-size: 22px; font-weight: 700">Rp' + nf.format(k.cpm) + '</span><span style="font-size: 13px; color: #8A8A93; font-weight: 600"> /1K views</span></span>'
      + '<div style="display: flex; align-items: center; gap: 10px">' + icons + '<span style="margin-left: auto; font-size: 13px; font-weight: 600; color: #9A9AA5">' + deadline(k.submission_deadline) + '</span></div>'
      + '<div class="tab" style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px">'
      + '<span style="padding: 10px 12px; border-radius: 12px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); display: flex; flex-direction: column; gap: 2px"><span style="font-size: 11px; color: #8A8A93; font-weight: 600">Minimal klaim</span><b style="font-size: 15px">' + short(k.min_views_to_qualify || 0) + ' views</b></span>'
      + '<span style="padding: 10px 12px; border-radius: 12px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); display: flex; flex-direction: column; gap: 2px"><span style="font-size: 11px; color: #8A8A93; font-weight: 600">Maks. per clip</span><b style="font-size: 15px">' + (maxViews ? short(maxViews) + ' views' : 'Tanpa batas') + '</b></span></div>'
      + '<div style="display: flex; flex-direction: column; gap: 8px"><div class="tab" style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 600; color: #9A9AA5"><span>Budget tersisa</span><span style="color: #FFFFFF">' + k.budget_left_pct + '%</span></div>'
      + '<div style="height: 6px; border-radius: 3px; background: #1F1F26"><div style="width: ' + k.budget_left_pct + '%; height: 6px; border-radius: 3px; background: linear-gradient(90deg, #4548F5, #7DA2FF)"></div></div></div>'
      + '<a class="btn" href="' + href + '" style="height: 44px; border-radius: 12px; margin-top: 4px">Ambil campaign</a>'
      + '</div></article>';
  }
  function empty(title, body) {
    return '<div style="grid-column: 1 / -1; padding: 56px 24px; border-radius: 22px; border: 1px dashed rgba(125,162,255,0.3); background: radial-gradient(60% 80% at 50% 0%, rgba(69,72,245,0.12), transparent 70%), #0B0B0F; display: flex; flex-direction: column; align-items: center; gap: 12px; text-align: center">'
      + '<img src="assets/tapp-mark.svg" alt="" style="width: 44px; height: 44px; opacity: 0.85"><h2 style="font-size: 22px; font-weight: 700">' + title + '</h2><p style="font-size: 15px; line-height: 24px; color: #9A9AA5; max-width: 440px">' + body + '</p>'
      + '<a class="btn" href="' + (app ? app + '/register' : '#') + '" style="margin-top: 6px">Daftar gratis</a></div>';
  }
  function draw() {
    var shown = all.filter(function (k) { return active === 'all' || (k.platforms || []).indexOf(active) >= 0; });
    list.innerHTML = shown.length ? shown.map(card).join('') : (all.length ? empty('Belum ada campaign untuk platform ini', 'Coba pilih platform lain, atau cek lagi nanti.') : empty('Campaign pertama segera dibuka', 'Daftar sekarang supaya akunmu sudah terverifikasi saat campaign dibuka.'));
    var plats = ['all'].concat(Array.from(new Set([].concat.apply([], all.map(function (k) { return k.platforms || []; })))));
    filters.innerHTML = all.length ? plats.map(function (p) {
      var on = p === active;
      return '<button data-p="' + p + '" aria-pressed="' + on + '" style="height: 38px; padding: 0 16px; border-radius: 999px; font: inherit; font-weight: 700; font-size: 14px; cursor: pointer; ' + (on ? 'background: rgba(69,72,245,0.25); color: #FFFFFF; border: 1px solid #5B7CFA' : 'background: rgba(255,255,255,0.04); color: #A1A1AA; border: 1px solid rgba(255,255,255,0.1)') + '">' + (p === 'all' ? 'Semua' : esc(NAME[p] || p)) + '</button>';
    }).join('') : '';
    filters.querySelectorAll('button').forEach(function (b) { b.onclick = function () { active = b.getAttribute('data-p'); draw(); }; });
  }
  list.innerHTML = [0, 1, 2].map(function () { return '<div style="height: 420px; border-radius: 22px; background: linear-gradient(90deg, #0F0F13, #16161C, #0F0F13); border: 1px solid rgba(255,255,255,0.06)"></div>'; }).join('');
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
  ('data', 'Data yang kami kumpulkan', '<h3>Data yang kamu berikan</h3>' + UL('Akun: nama lengkap, username, email, kata sandi (disimpan dalam bentuk terenkripsi), negara, dan kota.', 'Profil creator: niche konten, jenis konten, gaya konten, gambaran audiens, dan tingkat pengalaman.', 'Akun media sosial: platform, username, link profil, dan jumlah pengikut yang kamu masukkan.', 'Metode pencairan: nama bank atau e-wallet, nama pemilik, dan nomor rekening atau nomor e-wallet.', 'Submission: link postingan, tanggal posting, catatan, dan tangkapan layar yang kamu unggah.', 'Pesan ke tim TAPP: pertanyaan support dan pengajuan keberatan.') + '<h3>Data yang tercatat saat kamu memakai TAPP</h3>' + UL('Metrik postingan: views, likes, komentar, dan share yang dicatat tim TAPP untuk menghitung qualified views.', 'Riwayat aktivitas penting di akun, misalnya perubahan metode pencairan dan keputusan review, untuk keperluan audit dan keamanan.', 'Data penggunaan aplikasi dan website secara umum (halaman yang dibuka, fitur yang dipakai) yang dikaitkan hanya dengan ID akun, tanpa nama atau email.', 'Token perangkat untuk mengirim notifikasi push, jika kamu mengaktifkannya.')),
  ('pakai', 'Untuk apa data dipakai', UL('Membuat dan mengelola akun, serta memverifikasi email dan akun media sosialmu.', 'Mencocokkan creator dengan campaign yang relevan berdasarkan niche, platform, dan rekam jejak.', 'Mereview submission dan memverifikasi views, termasuk mendeteksi bot, akun palsu, dan lonjakan views yang janggal.', 'Menghitung penghasilan dan memproses pencairan ke rekening bank atau e-wallet milikmu.', 'Menyusun laporan campaign untuk brand.', 'Mengirim notifikasi terkait akun, campaign, submission, dan pencairan.', 'Menanggapi pertanyaan support dan keberatan.', 'Memenuhi kewajiban hukum, termasuk perpajakan dan pencegahan penipuan.')),
  ('bagi', 'Dengan siapa data dibagikan', UL('<b>Brand</b> yang campaign-nya kamu kerjakan dapat melihat username TAPP-mu, link postingan, platform, dan metrik clip untuk campaign tersebut. Brand tidak melihat email, nomor rekening, atau data pencairanmu.', '<b>Penyedia layanan</b> yang membantu TAPP beroperasi: penyimpanan data dan autentikasi (Supabase), pengiriman email, notifikasi push (Expo), analitik produk (PostHog), dan hosting website. Mereka hanya memproses data sesuai instruksi kami.', '<b>Bank dan penyedia e-wallet</b> saat kami memproses pencairan.', '<b>Otoritas yang berwenang</b> jika diwajibkan oleh hukum.') + P('Sebagian penyedia layanan dapat menyimpan data di server di luar Indonesia. Dalam hal itu kami memastikan ada perlindungan yang memadai sesuai ketentuan pelindungan data pribadi yang berlaku.')),
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
  ('creator', 'Ketentuan untuk creator', '<h3>Campaign dan submission</h3>' + UL('Setiap campaign punya brief, tarif per 1.000 views, platform, batas waktu, minimal views untuk klaim, dan batas maksimal per clip. Aturan di halaman campaign berlaku untuk campaign tersebut.', 'Clip harus diposting dari akun yang terhubung ke profil TAPP-mu, setelah kamu bergabung ke campaign, dan dikirim sebelum batas waktu.', 'Satu postingan hanya boleh disubmit satu kali di seluruh TAPP.', 'Tim TAPP dapat menyetujui, meminta revisi, menolak, atau menandai submission. Alasannya akan ditampilkan kepadamu.') + '<h3>Penghasilan</h3>' + UL('Penghasilan dihitung dari qualified views, yaitu views yang lolos verifikasi, dikali tarif campaign per 1.000 views, sampai batas maksimal per clip dan selama budget campaign masih tersedia.', 'Penghasilan tertunda 7 hari untuk pengecekan sebelum menjadi saldo tersedia.', 'Pencairan dapat diajukan mulai Rp50.000 ke rekening bank atau e-wallet atas nama yang sesuai, dan diproses dalam 1 sampai 3 hari kerja.', 'Kamu bertanggung jawab atas kewajiban pajak atas penghasilanmu, kecuali TAPP diwajibkan memotong pajak menurut peraturan yang berlaku.') + '<h3>Yang dilarang</h3>' + UL('Membeli views, memakai bot, akun palsu, atau cara lain untuk menaikkan angka secara tidak wajar.', 'Memakai akun media sosial milik orang lain.', 'Mengirim ulang postingan lama, postingan orang lain, atau konten yang menyesatkan.', 'Menghapus atau mengubah postingan menjadi privat sebelum masa pelacakan campaign selesai.', 'Konten yang melanggar hukum, hak cipta, atau pedoman komunitas platform tempat konten diposting.') + P('Pelanggaran dapat membuat submission ditolak, penghasilan dari submission tersebut dibatalkan, dan akun ditangguhkan atau ditutup.')),
  ('brand', 'Ketentuan untuk brand', UL('Akses brand dibuka lewat undangan dari tim TAPP.', 'Brief, tarif per 1.000 views, platform, dan budget reward disepakati bersama TAPP sebelum campaign disetujui. Setelah disetujui, syarat komersial campaign terkunci.', 'Brand membayar reward untuk qualified views ditambah fee platform sebesar 15% dari reward yang terpakai.', 'Pengeluaran reward tidak melebihi budget campaign. Saat budget habis, campaign berhenti membayar views baru.', 'Brand menjamin memiliki hak atas konten sumber dan materi yang diberikan kepada creator.')),
  ('konten', 'Konten dan hak kekayaan intelektual', P('Konten sumber dan materi brand tetap milik brand. Creator memperoleh izin terbatas untuk memakai materi tersebut hanya untuk campaign yang diikuti. Clip yang diposting creator tetap berada di akun creator. Dengan mengirim submission, creator memberi TAPP dan brand terkait izin untuk menampilkan link, cuplikan, dan metrik clip tersebut dalam laporan campaign dan materi promosi TAPP.', 'Nama, logo, dan tampilan TAPP adalah milik TAPP dan tidak boleh dipakai tanpa izin tertulis.')),
  ('keberatan', 'Keberatan dan support', P(f'Jika kamu tidak setuju dengan keputusan review atau penolakan pencairan, ajukan keberatan dari aplikasi. Tim TAPP akan meninjau ulang dan mengabarkan keputusannya. Pertanyaan lain dapat dikirim lewat menu Bantuan di aplikasi atau {MAIL}.')),
  ('tutup', 'Penangguhan dan penutupan akun', P('Kamu dapat meminta penutupan akun kapan saja. Saldo tersedia yang sudah memenuhi syarat akan dicairkan terlebih dahulu. TAPP dapat menangguhkan atau menutup akun yang melanggar Syarat Layanan ini, dengan memberitahukan alasannya.')),
  ('batas', 'Batasan tanggung jawab', P('TAPP disediakan sebagaimana adanya. Metrik bergantung pada data dari platform media sosial pihak ketiga yang dapat berubah atau tidak tersedia. Sejauh diizinkan hukum, TAPP tidak bertanggung jawab atas kerugian tidak langsung, termasuk kehilangan pendapatan, akibat gangguan layanan pihak ketiga, perubahan kebijakan platform, atau tindakan pengguna lain.')),
  ('hukum', 'Hukum yang berlaku', P('Syarat Layanan ini diatur oleh hukum Republik Indonesia. Perselisihan akan diupayakan diselesaikan secara musyawarah terlebih dahulu, dan jika tidak berhasil, melalui Pengadilan Negeri Denpasar.')),
  ('ubah', 'Perubahan syarat', P('Kami dapat memperbarui Syarat Layanan ini. Perubahan penting akan diumumkan lewat aplikasi atau email sebelum berlaku. Dengan tetap memakai TAPP setelah perubahan berlaku, kamu menyetujui syarat yang baru.')),
], 'Syarat Layanan TAPP untuk creator dan brand: akun, campaign, penghasilan, pencairan, dan aturan konten.')

# ───────────────────────────── 404 ─────────────────────────────
NOTFOUND = head('Halaman tidak ditemukan | TAPP', 'Halaman ini tidak ada di TAPP.', '404') + header('') + """
<main style="min-height: 60vh; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 18px">
  <img src="assets/tapp-mark.svg" alt="" style="width: 72px; height: 72px; filter: drop-shadow(0 0 30px rgba(69,72,245,0.9))">
  <span class="pill">404</span>
  <h1 class="h1">Halaman Ini<br><span>Tidak Ditemukan</span></h1>
  <p class="lead">Mungkin link-nya salah atau halamannya sudah dipindah.</p>
  <div style="display: flex; gap: 12px; flex-wrap: wrap; justify-content: center"><a class="btn" href="index.html">Ke beranda</a><a class="btn ghost" href="campaigns.html">Lihat campaign</a></div>
</main>
""" + FOOT + '\n</body>\n</html>\n'
# 404 pages are served from any path, so asset links must be absolute
(ROOT / '404.html').write_text(NOTFOUND.replace('__SITE_URL__', SITE_URL).replace('href="assets/', 'href="/assets/').replace('src="assets/', 'src="/assets/').replace('href="index.html', 'href="/index.html').replace('href="campaigns.html', 'href="/campaigns.html').replace('href="privacy.html', 'href="/privacy.html').replace('href="terms.html', 'href="/terms.html').replace('href="site.webmanifest', 'href="/site.webmanifest'))

# ───────────────────────────── robots + sitemap ─────────────────────────────
(ROOT / 'robots.txt').write_text(f"User-agent: *\nAllow: /\nDisallow: /src/\nDisallow: /tools/\n\nSitemap: {SITE_URL}/sitemap.xml\n")
urls = ['', 'campaigns', 'privacy', 'terms']
(ROOT / 'sitemap.xml').write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
  + ''.join(f'  <url><loc>{SITE_URL}/{u}</loc><changefreq>{"daily" if u == "campaigns" else "weekly"}</changefreq></url>\n' for u in urls) + '</urlset>\n')
print('pages built for', SITE_URL)
