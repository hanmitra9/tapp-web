# TAPP blog articles. Facts here must match the product (app, landing FAQ, campaign rules).
# Each post: slug, category (Panduan · Produk · News · Brand), ISO date, title, excerpt, cover art kind, body HTML.

POSTS = [
  dict(slug='ambil-campaign', cat='Produk', date='2026-10-04', cover='wizard',
    title='Ambil Campaign: Cara Baru Join dan Submit Clip di TAPP',
    excerpt='Pilih akun, verifikasi, lalu pilih video langsung dari akunmu. Semua dalam satu alur tiga langkah.',
    body='''
<p>Mulai hari ini, mengambil campaign di TAPP cukup lewat satu tombol: <b>Ambil Campaign</b>. Alur tiga langkah ini menggantikan form submit yang dulu terpisah, jadi kamu tidak perlu lagi bolak-balik antara halaman profil, campaign, dan workspace.</p>
<h2>1. Pilih akun</h2>
<p>TAPP menampilkan platform yang diterima campaign tersebut, misalnya TikTok, Instagram, dan YouTube. Pilih akun yang akan kamu pakai untuk posting. Belum punya akun terhubung? Tekan <b>Hubungkan akun</b> dan isi username-nya langsung di situ.</p>
<h2>2. Verifikasi</h2>
<p>Untuk TikTok dan Instagram, TAPP memberi kode unik yang kamu tempel di bio. Setelah disimpan, tekan <b>Cek bio sekarang</b>. Kalau akunmu sudah pernah diverifikasi, langkah ini otomatis dilewati.</p>
<h2>3. Pilih video</h2>
<p>Untuk Instagram dan YouTube Shorts, TAPP menampilkan video terbaru dari akunmu lengkap dengan thumbnail, views, likes, dan komentar. Pilih sampai lima video sekaligus. Untuk TikTok, tempel link videonya dan TAPP menampilkan preview sebelum kamu submit.</p>
<ul>
<li>Video yang diposting sebelum kamu bergabung otomatis tidak bisa dipilih, karena tidak dihitung.</li>
<li>Video yang sudah pernah disubmit ditandai, jadi tidak ada submit ganda.</li>
<li>Kalau link yang ditempel ternyata dari akun lain, TAPP langsung memberi tahu.</li>
</ul>
<h2>Setelah submit</h2>
<p>Begitu terkirim, TAPP langsung membuka setiap video untuk memastikan postingannya ada, milik akunmu, dan berapa views-nya saat ini. Pengecekan diulang otomatis setiap 6 jam selama campaign berjalan.</p>
<p>Belum posting? Pilih <b>Nanti saja</b>. Kamu tetap tercatat bergabung dan konten sumber langsung terbuka di workspace.</p>
'''),

  dict(slug='verifikasi-kode-bio', cat='Panduan', date='2026-10-03', cover='verify',
    title='Cara Verifikasi Akun TikTok dan Instagram Lewat Kode Bio',
    excerpt='Satu kode di bio membuktikan akun itu milikmu, supaya views clip-mu bisa dihitung.',
    body='''
<p>Supaya views bisa dibayar, TAPP perlu memastikan clip diposting dari akun milikmu sendiri. Caranya sederhana: tempel kode unik di bio akunmu.</p>
<h2>Langkah verifikasi</h2>
<ol>
<li>Buka <b>Profil → Akun sosial</b>, atau langsung dari langkah Verifikasi saat mengambil campaign.</li>
<li>Tekan <b>Dapatkan kode bio</b>, lalu salin kodenya.</li>
<li>Buka TikTok atau Instagram, edit profil, dan tempel kode di bio. Simpan.</li>
<li>Kembali ke TAPP dan tekan <b>Cek bio sekarang</b>.</li>
</ol>
<p>Kalau kodenya ditemukan, akunmu langsung terverifikasi. Setelah itu kodenya boleh dihapus dari bio.</p>
<h2>Kalau kode tidak terbaca</h2>
<p>Pastikan akunmu publik dan bionya sudah tersimpan, lalu cek lagi beberapa saat kemudian. Kalau profilmu tetap tidak bisa dibaca otomatis, tekan <b>Minta cek manual</b>. Tim TAPP akan memeriksanya, biasanya kurang dari 1x24 jam. Biarkan kodenya tetap di bio sampai statusnya berubah.</p>
<h2>Kenapa perlu verifikasi?</h2>
<p>Verifikasi mencegah orang lain mengklaim clip dari akun yang bukan miliknya. Hasilnya, bayaran selalu jatuh ke creator yang benar-benar membuat dan memposting clip.</p>
'''),

  dict(slug='qualified-views', cat='Panduan', date='2026-10-02', cover='views', popular=True,
    title='Qualified Views: Views Seperti Apa yang Dibayar?',
    excerpt='Angka di TikTok bisa berbeda dengan yang dibayar. Ini cara TAPP menyaring views.',
    body='''
<p>Bayaranmu di TAPP dihitung dari <b>qualified views</b> dikali tarif per 1.000 views campaign. Qualified views adalah views yang lolos saringan, jadi angkanya bisa lebih kecil dari angka mentah yang terlihat di aplikasi.</p>
<h2>Yang tidak dihitung</h2>
<ul>
<li>Views dari promosi berbayar atau iklan.</li>
<li>Views dari bot atau aktivitas janggal, misalnya lonjakan tidak wajar dalam waktu singkat.</li>
<li>Views dari akun repost, atau video yang bukan diposting dari akunmu yang terverifikasi.</li>
<li>Video yang diposting sebelum kamu bergabung ke campaign.</li>
</ul>
<h2>Bagaimana TAPP memantau</h2>
<p>Setiap clip dicek otomatis saat disubmit, lalu diulang setiap 6 jam selama 30 hari. Riwayat views ini membantu tim TAPP melihat pola yang wajar dan yang tidak. Hasil akhirnya tetap direview manusia sebelum bayaran dihitung.</p>
<h2>Aturan tiap campaign</h2>
<p>Setiap campaign bisa punya minimal views dan batas bayaran per clip. Di TAPP Mega Campaign, misalnya, clip mulai dihitung setelah 5.000 views dan dibayar sampai 100K views per clip. Aturannya selalu tertulis di halaman detail campaign sebelum kamu bergabung.</p>
'''),

  dict(slug='sistem-level-creator', cat='Produk', date='2026-10-01', cover='level',
    title='Sistem Level TAPP: Dari New Sampai Elite',
    excerpt='Level naik otomatis dari total qualified views, bukan dari jumlah follower.',
    body='''
<p>Di TAPP, semua creator mulai dari titik yang sama. Level tidak ditentukan oleh jumlah follower, tapi oleh hasil kerjamu: total qualified views dari clip yang lolos review.</p>
<h2>Lima level creator</h2>
<ul>
<li><b>New</b>: level awal setiap creator.</li>
<li><b>Rising</b>: mulai dari 100K qualified views.</li>
<li><b>Verified</b>: mulai dari 500K qualified views.</li>
<li><b>Proven</b>: mulai dari 2 juta qualified views.</li>
<li><b>Elite</b>: mulai dari 10 juta qualified views.</li>
</ul>
<h2>Apa untungnya naik level?</h2>
<p>Setiap naik level, bonus tarifmu ikut naik. Level juga tampil di profil creator-mu bersama approval rate dan reliability score, jadi rekam jejakmu terlihat jelas.</p>
<h2>Tips naik level lebih cepat</h2>
<ul>
<li>Ikuti brief dengan teliti supaya clip lolos review sejak awal.</li>
<li>Posting konsisten di akun yang sama dan sudah terverifikasi.</li>
<li>Hindari cara instan seperti membeli views. Views seperti ini tersaring dan bisa menurunkan reliability score.</li>
</ul>
'''),

  dict(slug='dari-views-ke-rekening', cat='Panduan', date='2026-09-30', cover='payout', popular=True,
    title='Dari Views ke Rekening: Cara Pembayaran di TAPP',
    excerpt='Tidak perlu mengajukan penarikan. Bayaran ditransfer setelah clip-mu diterima.',
    body='''
<p>Di TAPP, kamu tidak perlu menekan tombol tarik dana. Setelah clip-mu diterima tim TAPP, bayarannya ditransfer langsung ke rekening atau e-wallet yang kamu isi di profil.</p>
<h2>Alurnya</h2>
<ol>
<li>Submit clip lewat <b>Ambil Campaign</b>.</li>
<li>TAPP memantau views clip-mu secara otomatis.</li>
<li>Tim TAPP mereview clip dan menghitung qualified views-nya.</li>
<li>Bayaran ditransfer, dan kamu menerima email konfirmasi berisi jumlah dan tujuan transfer.</li>
</ol>
<h2>Metode pembayaran</h2>
<p>E-wallet seperti GoPay, OVO, DANA, ShopeePay, dan LinkAja, atau rekening bank seperti BCA, BRI, BNI, Mandiri, dan lainnya. Atur di <b>Profil → Pembayaran</b>.</p>
<h2>Kalau transfer gagal</h2>
<p>Biasanya karena nama atau nomor rekening tidak cocok. Kamu akan menerima email berisi alasannya. Perbaiki data di profil, lalu tim TAPP akan mentransfer ulang.</p>
<p>Semua bayaran tercatat di menu <b>Pembayaran</b>, lengkap dengan clip dan tanggal transfernya.</p>
'''),

  dict(slug='memantau-clip-brand', cat='Brand', date='2026-09-29', cover='brand',
    title='Cara Brand Memantau Clip dan Laporan Campaign',
    excerpt='Views mentah, qualified views, biaya, dan jangkauan hashtag, semuanya di satu dashboard.',
    body='''
<p>Setelah campaign berjalan, brand bisa memantau hasilnya dari dashboard brand TAPP tanpa perlu menghubungi creator satu per satu.</p>
<h2>Yang terlihat di dashboard</h2>
<ul>
<li><b>Views mentah dan qualified views</b>, supaya kamu tahu berapa yang benar-benar dibayar.</li>
<li><b>Total biaya dan sisa budget</b> campaign.</li>
<li><b>Performa per platform dan per creator</b>.</li>
<li><b>Jangkauan hashtag campaign</b>, berupa jumlah video dan total views dari hashtag yang kamu pakai (saat ini untuk TikTok).</li>
</ul>
<h2>Laporan harian lewat email</h2>
<p>Setiap hari, tim brand bisa menerima ringkasan berisi qualified views baru, reward creator, dan status setiap campaign. Laporan ini bisa dimatikan dari menu Akun di dashboard brand.</p>
<h2>Budget tidak pernah terlewati</h2>
<p>Kalau budget habis di tengah campaign, campaign otomatis masuk fase segera berakhir dan views berikutnya tidak dibayar. Pengeluaranmu selalu berada di bawah budget yang disepakati.</p>
'''),

  dict(slug='menyiapkan-materi-video', cat='Brand', date='2026-09-28', cover='assets',
    title='Menyiapkan Materi Video untuk Creator TAPP',
    excerpt='Brief yang jelas dan konten sumber yang rapi membuat clip lebih cepat jadi dan lebih banyak yang lolos.',
    body='''
<p>Kualitas clip sangat dipengaruhi materi yang kamu berikan. Semakin jelas brief dan konten sumbernya, semakin cepat creator bekerja dan semakin banyak clip yang lolos review.</p>
<h2>Konten sumber</h2>
<ul>
<li>Berikan video dalam kualitas terbaik yang kamu punya, idealnya file asli, bukan hasil unduhan ulang.</li>
<li>Sertakan momen kunci yang ingin ditonjolkan, misalnya potongan podcast, adegan film, atau demo produk.</li>
<li>Kalau ada logo, musik, atau aset grafis yang wajib dipakai, lampirkan sekalian.</li>
</ul>
<h2>Brief yang jelas</h2>
<ul>
<li><b>Tujuan</b>: awareness, penjualan, atau trafik ke akun brand.</li>
<li><b>Lakukan</b>: misalnya sebut nama brand di 3 detik pertama.</li>
<li><b>Hindari</b>: misalnya musik berhak cipta atau klaim yang tidak boleh dibuat.</li>
<li><b>Hashtag campaign</b>, supaya jangkauannya bisa dihitung di laporan.</li>
</ul>
<p>Konten sumber hanya terbuka untuk creator yang sudah bergabung ke campaign, jadi materimu tetap terjaga.</p>
'''),

  dict(slug='tapp-mega-campaign', cat='News', date='2026-09-27', cover='mega', popular=True,
    title='TAPP Mega Campaign Dibuka untuk Semua Creator',
    excerpt='Campaign pertama TAPP terbuka untuk semua creator. Tanpa minimal follower.',
    body='''
<p>TAPP Mega Campaign resmi dibuka. Ini campaign pertama TAPP dan terbuka untuk semua creator, baik yang baru mulai maupun yang sudah berpengalaman.</p>
<h2>Ringkasan campaign</h2>
<ul>
<li><b>Tarif</b>: Rp3.000 per 1.000 qualified views.</li>
<li><b>Minimal views</b>: clip mulai dihitung setelah 5.000 views.</li>
<li><b>Batas per clip</b>: dibayar sampai 100K views, jadi maksimal Rp300.000 per clip.</li>
<li><b>Platform</b>: TikTok, Instagram, dan YouTube.</li>
</ul>
<h2>Cara ikut</h2>
<ol>
<li>Daftar di TAPP dan lengkapi profilmu.</li>
<li>Buka TAPP Mega Campaign lalu tekan <b>Ambil Campaign</b>.</li>
<li>Unduh konten sumber, buat clip sesuai brief, dan posting di akunmu.</li>
<li>Kembali ke campaign dan pilih videomu untuk disubmit.</li>
</ol>
<p>Tidak ada minimum follower. Yang dihitung adalah views dari clip-mu.</p>
'''),
]
