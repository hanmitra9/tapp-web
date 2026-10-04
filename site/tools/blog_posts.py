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

  dict(slug='sistem-level-creator', cat='Produk', date='2026-10-01', cover='level', popular=True,
    title='Sistem Level TAPP: Syarat dan Bonus Tiap Level',
    excerpt='Dari New sampai Elite: syarat qualified views, bonus tarif sampai +15%, dan contoh hitungannya.',
    body='''
<p>Di TAPP, semua creator mulai dari titik yang sama. Level tidak ditentukan oleh jumlah follower, tapi oleh hasil kerjamu: total qualified views dari clip yang lolos review. Level naik otomatis, tanpa perlu mengajukan apa pun.</p>
<h2>Syarat dan bonus tiap level</h2>
<table class="bl-table"><thead><tr><th>Level</th><th>Syarat total qualified views</th><th>Bonus tarif</th></tr></thead><tbody>
<tr><td><b>New</b></td><td>Mulai dari 0</td><td>Tarif standar</td></tr>
<tr><td><b>Rising</b></td><td>100.000</td><td>+2%</td></tr>
<tr><td><b>Verified</b></td><td>500.000</td><td>+5%</td></tr>
<tr><td><b>Proven</b></td><td>2 juta</td><td>+10%</td></tr>
<tr><td><b>Elite</b></td><td>10 juta</td><td>+15%</td></tr>
</tbody></table>
<h2>Cara bonus dihitung</h2>
<p>Bayaran clip masuk ke saldomu. Saat kamu menarik saldo, TAPP menambahkan bonus tarif <b>di atas</b> jumlah yang ditarik, sesuai level kamu saat itu. Bonus ini dibayar TAPP, jadi tidak mengurangi budget brand.</p>
<p>Setiap pencairan dikenai biaya tarik Rp10.000, dengan minimal saldo Rp100.000.</p>
<ul>
<li>Tarik saldo Rp300.000 di level <b>Verified</b>: bonus +5% = <b>Rp15.000</b>, dikurangi biaya tarik Rp10.000, diterima <b>Rp305.000</b>.</li>
<li>Tarik saldo yang sama di level <b>Elite</b>: bonus +15% = <b>Rp45.000</b>, dikurangi biaya tarik Rp10.000, diterima <b>Rp335.000</b>.</li>
</ul>
<p>Rincian bonus dan biaya tercantum di riwayat pencairan dan di email bukti transfer.</p>
<h2>Selain bonus</h2>
<ul>
<li>Level tampil di profil creator-mu bersama approval rate dan reliability score.</li>
<li>Rekam jejak yang kuat membuat profilmu lebih mudah dilirik brand untuk campaign berikutnya.</li>
</ul>
<h2>Tips naik level lebih cepat</h2>
<ul>
<li>Ikuti brief dengan teliti supaya clip lolos review sejak awal.</li>
<li>Posting konsisten di akun yang sama dan sudah terverifikasi.</li>
<li>Ikut beberapa campaign sekaligus. Semua qualified views dari setiap campaign dijumlahkan.</li>
<li>Hindari cara instan seperti membeli views. Views seperti ini tersaring, tidak dihitung, dan bisa menurunkan reliability score.</li>
</ul>
'''),

  dict(slug='dari-views-ke-rekening', cat='Panduan', date='2026-09-30', cover='payout', popular=True,
    title='Dari Views ke Rekening: Cara Pembayaran di TAPP',
    excerpt='Bayaran clip masuk ke saldo, lalu kamu tarik ke rekening atau e-wallet kapan saja.',
    body='''
<p>Di TAPP, bayaran setiap clip yang diterima masuk ke <b>saldo</b>-mu. Kamu bebas menariknya ke rekening atau e-wallet kapan saja setelah saldo mencapai minimum.</p>
<h2>Alurnya</h2>
<ol>
<li>Submit clip lewat <b>Ambil Campaign</b>.</li>
<li>TAPP memantau views clip-mu secara otomatis.</li>
<li>Tim TAPP mereview clip dan menghitung qualified views-nya. Bayarannya masuk ke saldo.</li>
<li>Buka menu <b>Pembayaran</b> dan tekan <b>Tarik</b>. Tim TAPP mentransfer, biasanya dalam 1x24 jam kerja, lalu kamu menerima email konfirmasi.</li>
</ol>
<h2>Ketentuan penarikan</h2>
<table class="bl-table"><tbody>
<tr><td>Minimal saldo</td><td>Rp100.000</td></tr>
<tr><td>Biaya tarik</td><td>Rp10.000 per pencairan</td></tr>
<tr><td>Bonus level</td><td>+2% sampai +15% dari jumlah yang ditarik</td></tr>
</tbody></table>
<p>Tips: tarik saldo sekaligus dalam jumlah lebih besar supaya biaya tarik terasa lebih kecil. Kalau levelmu naik, bonus saat menarik juga ikut naik.</p>
<h2>Metode pembayaran</h2>
<p>E-wallet seperti GoPay, OVO, DANA, ShopeePay, dan LinkAja, atau rekening bank seperti BCA, BRI, BNI, Mandiri, dan lainnya. Atur di <b>Profil → Pembayaran</b>.</p>
<h2>Kalau transfer gagal</h2>
<p>Biasanya karena nama atau nomor rekening tidak cocok. Kamu akan menerima email berisi alasannya dan saldomu kembali utuh. Perbaiki data di profil, lalu tarik lagi.</p>
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
<p>Setiap hari, tim brand bisa menerima ringkasan berisi qualified views baru, biaya views, dan status setiap campaign. Laporan ini bisa dimatikan dari menu Akun di dashboard brand.</p>
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
  dict(slug='biaya-campaign-brand', cat='Brand', date='2026-10-04', cover='fee', popular=True,
    title='Biaya Campaign di TAPP: Bayar Views Terverifikasi + Fee 18%',
    excerpt='Struktur biaya yang jelas: biaya views dari qualified views, ditambah fee kerjasama 18%.',
    body='''
<p>Di TAPP, brand tidak membayar per posting atau per jumlah follower. Kamu membayar views yang lolos verifikasi, ditambah fee kerjasama yang jelas sejak awal.</p>
<h2>Dua komponen biaya</h2>
<ul>
<li><b>Biaya views</b>: qualified views dikali tarif per 1.000 views (CPM) yang disepakati bersama tim TAPP.</li>
<li><b>Fee kerjasama 18%</b>: dihitung dari biaya views.</li>
</ul>
<h2>Contoh hitungan</h2>
<table class="bl-table"><tbody>
<tr><td>Tarif campaign</td><td>Rp3.000 / 1.000 qualified views</td></tr>
<tr><td>Qualified views terkumpul</td><td>2.000.000</td></tr>
<tr><td>Biaya views</td><td>Rp6.000.000</td></tr>
<tr><td>Fee kerjasama (18%)</td><td>Rp1.080.000</td></tr>
<tr><td><b>Total biaya</b></td><td><b>Rp7.080.000</b></td></tr>
</tbody></table>
<h2>Apa saja yang termasuk?</h2>
<ul>
<li>Pencarian, seleksi, dan pembayaran creator, termasuk verifikasi akun lewat kode bio.</li>
<li>Pemantauan views otomatis setiap 6 jam dan penyaringan bot serta aktivitas janggal.</li>
<li>Review setiap clip oleh tim TAPP sebelum dihitung.</li>
<li>Satu tagihan ke TAPP, jadi kamu tidak perlu mengurus pembayaran ke banyak creator.</li>
<li>Dashboard brand, laporan harian, dan pendampingan account manager.</li>
</ul>
<h2>Budget selalu terkendali</h2>
<p>Kamu menetapkan budget di awal. Kalau budget habis di tengah jalan, campaign otomatis masuk fase segera berakhir dan views berikutnya tidak ditagih. Views mentah yang tidak lolos tetap terlihat di laporan sebagai pembanding, tapi tidak pernah kamu bayar.</p>
'''),

  dict(slug='tips-clip-lolos-review', cat='Panduan', date='2026-09-26', cover='tips',
    title='7 Tips Bikin Clip yang Lolos Review dan Ramai Views',
    excerpt='Dari hook 3 detik pertama sampai hashtag campaign: kebiasaan creator yang clip-nya cepat diterima.',
    body='''
<p>Clip yang lolos review sejak awal berarti bayaran lebih cepat dan level naik lebih cepat. Ini kebiasaan yang paling sering kami lihat dari creator dengan approval rate tinggi.</p>
<ol>
<li><b>Baca brief sampai habis.</b> Bagian Lakukan dan Hindari adalah alasan paling umum clip diminta revisi.</li>
<li><b>Hook di 3 detik pertama.</b> Potong langsung ke momen paling menarik dari konten sumber.</li>
<li><b>Satu clip, satu ide.</b> Clip pendek yang fokus lebih sering ditonton sampai habis.</li>
<li><b>Pakai subtitle.</b> Banyak orang menonton tanpa suara.</li>
<li><b>Pakai hashtag campaign.</b> Brand memantau jangkauan hashtag-nya, dan ini membantu clip-mu ditemukan.</li>
<li><b>Posting dari akun yang terverifikasi</b> dan setelah kamu bergabung ke campaign. Video lama tidak dihitung.</li>
<li><b>Jangan beli views.</b> Lonjakan tidak wajar akan tersaring dan bisa menurunkan reliability score.</li>
</ol>
<p>Setelah posting, submit lewat <b>Ambil Campaign</b>. TAPP langsung memeriksa link-mu dan menampilkan hasilnya.</p>
'''),

  dict(slug='clip-ditolak-revisi-keberatan', cat='Panduan', date='2026-09-25', cover='review',
    title='Clip Ditolak atau Perlu Revisi? Ini yang Harus Dilakukan',
    excerpt='Arti setiap status review, cara kirim ulang, dan cara mengajukan keberatan.',
    body='''
<p>Setiap clip yang kamu submit direview tim TAPP. Statusnya selalu terlihat di workspace campaign, lengkap dengan alasannya.</p>
<h2>Arti status</h2>
<ul>
<li><b>Menunggu review</b>: clip sudah masuk antrean. Kalau salah submit, tekan <b>Tarik submission</b>.</li>
<li><b>Perlu revisi</b>: ada yang perlu diperbaiki. Baca catatan reviewer, perbaiki, lalu tekan <b>Kirim ulang</b>.</li>
<li><b>Diterima</b>: views clip-mu dihitung. Setelah bayarannya masuk ke saldomu, statusnya berubah jadi <b>Masuk saldo</b>.</li>
<li><b>Ditandai</b>: clip sedang diperiksa ulang oleh tim TAPP.</li>
<li><b>Ditolak</b>: clip tidak memenuhi syarat, misalnya bukan dari akunmu, diposting sebelum bergabung, atau melanggar brief.</li>
</ul>
<h2>Merasa keputusannya keliru?</h2>
<p>Untuk clip yang ditolak atau ditandai, tekan <b>Ajukan keberatan</b> di workspace dan jelaskan alasannya. Tim TAPP akan meninjau ulang.</p>
<h2>Hindari penolakan</h2>
<ul>
<li>Pastikan postingan tetap publik dan tidak dihapus selama campaign berjalan.</li>
<li>Submit link video dari akun yang sudah kamu verifikasi.</li>
<li>Ikuti daftar Lakukan dan Hindari di brief.</li>
</ul>
'''),

  dict(slug='bayar-per-views-vs-endorse', cat='Brand', date='2026-09-24', cover='compare',
    title='Bayar per Views vs Endorse: Mana yang Lebih Efisien?',
    excerpt='Endorse membayar di depan untuk satu akun. Clipping membayar hasil dari banyak akun sekaligus.',
    body='''
<p>Endorse klasik membayar satu creator di depan, berapa pun hasilnya. Model clipping di TAPP membalik logikanya: banyak creator memposting, dan kamu membayar views yang benar-benar terjadi.</p>
<table class="bl-table"><thead><tr><th></th><th>Endorse</th><th>Clipping di TAPP</th></tr></thead><tbody>
<tr><td>Dasar biaya</td><td>Tarif per posting</td><td>Qualified views</td></tr>
<tr><td>Risiko sepi views</td><td>Ditanggung brand</td><td>Tidak dibayar</td></tr>
<tr><td>Jumlah akun</td><td>Satu atau beberapa</td><td>Puluhan sampai ratusan</td></tr>
<tr><td>Bot dan views palsu</td><td>Sulit dicek</td><td>Disaring sebelum dibayar</td></tr>
<tr><td>Laporan</td><td>Screenshot dari creator</td><td>Dashboard dan laporan harian</td></tr>
</tbody></table>
<h2>Kapan endorse masih cocok?</h2>
<p>Kalau kamu butuh wajah tertentu untuk mewakili brand. Untuk menyebarkan pesan seluas-luasnya dengan biaya yang terukur, clipping jauh lebih efisien.</p>
<p>Biaya di TAPP terdiri dari biaya views ditambah fee kerjasama 18%. Rinciannya bisa kamu baca di artikel <a href="blog-biaya-campaign-brand.html">Biaya Campaign di TAPP</a>.</p>
'''),

  dict(slug='mulai-di-tapp', cat='Panduan', date='2026-09-23', cover='start',
    title='Pertama Kali di TAPP: Dari Daftar Sampai Clip Pertama',
    excerpt='Panduan singkat untuk creator baru, langkah demi langkah.',
    body='''
<ol>
<li><b>Daftar</b> dengan email, lalu masukkan kode verifikasi yang dikirim ke inbox-mu.</li>
<li><b>Isi profil</b>: nama, username, negara, akun sosial (TikTok, Instagram, atau YouTube), pengalaman, dan metode pembayaran berupa rekening bank atau e-wallet.</li>
<li><b>Kirim untuk ditinjau.</b> Tim TAPP memeriksa profilmu. Setelah disetujui, kamu bisa bergabung ke campaign.</li>
<li><b>Verifikasi akun sosial</b> dengan kode bio di <b>Profil → Akun sosial</b>, atau langsung saat mengambil campaign.</li>
<li><b>Pilih campaign</b> di tab Campaign. Baca tarif, minimal views, dan brief-nya.</li>
<li><b>Tekan Ambil Campaign</b>, unduh konten sumber, lalu buat clip-mu.</li>
<li><b>Posting dan submit.</b> Kembali ke campaign, pilih videomu, dan kirim.</li>
</ol>
<p>Tidak ada minimum follower. Kamu bisa submit sampai 20 clip per hari, dan semua qualified views-mu dihitung untuk naik level.</p>
'''),

  dict(slug='cara-tapp-deteksi-bot', cat='Produk', date='2026-09-22', cover='shield',
    title='Cara TAPP Menyaring Views Bot dan Aktivitas Janggal',
    excerpt='Pengecekan otomatis tiap 6 jam, pola yang diperhatikan, dan review manusia sebelum bayar.',
    body='''
<p>Kepercayaan brand bergantung pada satu hal: views yang dibayar harus nyata. Karena itu setiap clip di TAPP melewati beberapa lapis pengecekan.</p>
<h2>1. Kepemilikan akun</h2>
<p>Akun creator diverifikasi lewat kode bio, dan setiap link dicek apakah benar diposting dari akun tersebut.</p>
<h2>2. Riwayat views</h2>
<p>TAPP membaca views, likes, dan komentar setiap 6 jam selama 30 hari. Riwayat ini memperlihatkan pertumbuhan yang wajar dan yang tidak.</p>
<h2>3. Pola yang diperhatikan</h2>
<ul>
<li>Lonjakan views yang tidak wajar dalam waktu singkat.</li>
<li>Engagement yang terlalu rendah dibanding jumlah views.</li>
<li>Views yang terlalu besar dibanding ukuran akun.</li>
</ul>
<h2>4. Review manusia</h2>
<p>Hasil pengecekan otomatis tidak langsung menolak clip. Tim TAPP melihat semuanya sebelum memutuskan berapa qualified views yang dibayar. Views yang tidak lolos tetap terlihat di laporan brand sebagai views mentah, tapi tidak dibayar.</p>
'''),
]