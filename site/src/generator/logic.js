class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { mode: null, openC: 0, openB: 0, met: 'Views', budget: 25000000, cpm: 3000, bstep: 0 };
  }
  renderVals() {
    const s = this.state;
    const mode = s.mode ?? this.props.startMode ?? 'creator';
    const creator = mode === 'creator';
    const tab = (on) => 'height: 32px; padding: 0 14px; border-radius: 9px; font-weight: 500; font-size: 14px; '
      + (on ? 'color: #FFFFFF; background: #4548F5; border: 1px solid rgba(255,255,255,0.16)' : 'color: #8A8A93; background: transparent; border: 1px solid transparent');

    const faqList = (raw, key) => raw.map((f, i) => {
      const open = s[key] === i;
      return {
        q: f[0], a: f[1], open: open, signText: open ? '×' : '+',
        box: 'border-radius: 16px; ' + (open
          ? 'background: radial-gradient(90% 140% at 0% 0%, rgba(69,72,245,0.22), transparent 60%), #111116; border: 1px solid rgba(125,162,255,0.45); box-shadow: 0 18px 44px -24px rgba(69,72,245,0.9)'
          : 'background: #0F0F13; border: 1px solid rgba(255,255,255,0.07)'),
        sign: 'width: 28px; height: 28px; flex-shrink: 0; border-radius: 14px; display: inline-flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 500; '
          + (open ? 'color: #FFFFFF; background: rgba(69,72,245,0.35)' : 'color: #7DA2FF; background: transparent'),
        toggle: () => this.setState({ [key]: open ? -1 : i }),
      };
    });
    const faqC = faqList([
      ['TAPP itu sebenarnya apa?', 'Tempat brand menaruh campaign dan creator mengerjakannya. Kamu bikin clip pendek dari konten sumber, posting di akunmu sendiri, dan dibayar dari views yang lolos verifikasi.'],
      ['Bagaimana hitungan bayarannya?', 'Qualified views dikali tarif per 1.000 views. Qualified artinya views yang lolos saringan bot dan aktivitas janggal, jadi angka mentah di TikTok bisa berbeda dengan yang dibayar. Rinciannya terlihat per clip.'],
      ['Kapan uangnya bisa ditarik?', 'Penghasilan tertunda 7 hari untuk pengecekan, lalu pindah ke saldo tersedia dan bisa ditarik dengan minimal Rp50.000.'],
      ['Ditarik ke mana?', 'E-wallet (GoPay, OVO, DANA, ShopeePay, LinkAja) atau rekening bank (BCA, BRI, BNI, Mandiri, dan lainnya). Tim TAPP memproses dalam 1 sampai 3 hari kerja.'],
      ['Berapa views minimal supaya dibayar?', 'Tiap campaign punya aturannya sendiri. Di TAPP Campaign, clip mulai dihitung setelah mencapai 5.000 views dan dibayar sampai 100K views per clip, jadi maksimal Rp300.000 per clip.'],
      ['Follower saya masih sedikit, boleh?', 'Boleh. Tidak ada minimum follower. Level naik dari clip yang lolos dan approval rate-mu, jadi creator baru punya jalur yang sama.'],
      ['Clip saya ditolak, lalu?', 'Kamu langsung melihat alasannya. Kalau diminta revisi, perbaiki lalu kirim ulang selama campaign berjalan. Kalau merasa keliru, ajukan keberatan dari dashboard.'],
    ], 'openC');
    const faqB = faqList([
      ['Bagaimana brand bergabung?', 'Akses brand dibuka lewat tim TAPP. Setelah brief siap, kami kirim undangan ke email timmu untuk masuk ke dashboard brand.'],
      ['Views mana yang saya bayar?', 'Hanya qualified views: views yang lolos saringan bot dan aktivitas janggal, lalu direview tim TAPP. Views mentah tetap terlihat di laporan sebagai pembanding.'],
      ['Bisakah saya memilih creator?', 'Campaign ditawarkan ke creator yang cocok dari niche, platform, dan rekam jejak, bukan dari jumlah follower. Account manager-mu bisa membantu mengarahkan profil creator yang dicari.'],
      ['Kalau budget habis di tengah campaign?', 'Campaign otomatis masuk fase segera berakhir dan views berikutnya tidak dibayar, jadi pengeluaranmu tidak pernah melewati budget.'],
      ['Laporan apa yang saya dapat?', 'Views mentah dan qualified, total biaya, CPV, serta performa per platform dan per creator.'],
      ['Berapa biayanya?', 'Kamu membayar reward untuk views yang lolos ditambah fee platform 15% dari reward yang terpakai.'],
    ], 'openB');

    // live chart (brand card 3), values from the reference demo
    const MET = {
      Views: { v: '12K', d: [2, 3.4, 3.1, 5.2, 6.4, 8.8, 12], max: 15 },
      Likes: { v: '9,4K', d: [1.2, 2.1, 2.4, 3.6, 5, 6.8, 9.4], max: 12 },
      Komentar: { v: '1,2K', d: [0.1, 0.3, 0.3, 0.5, 0.7, 0.9, 1.2], max: 1.5 },
      Engagement: { v: '8,9%', d: [6.2, 6.8, 6.5, 7.4, 7.9, 8.4, 8.9], max: 10 },
    };
    const met = s.met || 'Views';
    const W = 330, H = 150, pt = 10, pb = 20;
    const px = (i) => W * i / 6, py = (v) => pt + (H - pt - pb) * (1 - v / MET[met].max);
    const pts = MET[met].d.map((v, i) => [px(i), py(v)]);
    let line = 'M' + pts[0][0].toFixed(1) + ',' + pts[0][1].toFixed(1);
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i - 1] || pts[i], b = pts[i], c = pts[i + 1], e = pts[i + 2] || c;
      line += 'C' + (b[0] + (c[0] - a[0]) / 6).toFixed(1) + ',' + (b[1] + (c[1] - a[1]) / 6).toFixed(1) + ' '
        + (c[0] - (e[0] - b[0]) / 6).toFixed(1) + ',' + (c[1] - (e[1] - b[1]) / 6).toFixed(1) + ' ' + c[0].toFixed(1) + ',' + c[1].toFixed(1);
    }
    const metrics = Object.keys(MET).map((k) => ({
      label: k === 'Engagement' ? 'Eng. rate' : k, value: MET[k].v, on: met === k, pick: () => this.setState({ met: k }),
      style: 'padding: 8px 6px; border-radius: 10px; text-align: left; '
        + (met === k ? 'background: rgba(69,72,245,0.25); border: 1px solid #5B7CFA; color: #C6D6FF' : 'background: rgba(255,255,255,0.04); border: 1px solid #26262C; color: #8A8A93'),
    }));

    // creator wall (reference): demo names and payouts from the reference artifact
    const GLOW = ['#34D07A', '#F2692B', '#2F8CE6', '#3B82F6', '#E2445C', '#F0B429'];
    const people = [
      ['Rani Putri', 'Creator Keuangan'], ['Dimas Pratama', ''], ['Nadia Kusuma', 'Creator Gaming'], ['Bagus Santoso', ''],
      ['Sari Wulandari', 'Creator Edukasi'], ['Ayu Lestari', ''], ['Tika Anjani', 'Creator Lifestyle'], ['Kevin Wijaya', ''],
      ['Lina Marlina', 'Creator Komedi'], ['Rio Hartono', 'Clipper Podcast'], ['Maya Puspita', ''], ['Hendra Gunawan', 'Creator Kripto'],
    ];
    const wall = (offset) => {
      const set = people.slice(offset).concat(people.slice(0, offset));
      const cards = set.map((pp, i) => {
        const name = pp[0], pay = pp[1], g = GLOW[(i + offset) % 6], big = !pay;
        return {
          name: name, sub: pay, ini: name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase(),
          card: 'flex-shrink: 0; height: 88px; min-width: 230px; padding: 0 22px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; border-radius: 16px; background: linear-gradient(180deg, #15151B, #0D0D11); border: 1px solid rgba(255,255,255,0.08)',
          whoRow: 'display: flex; align-items: center; gap: 10px; white-space: nowrap; font-weight: 500; color: #E4E4E7; font-size: ' + (big ? '17px' : '14px'),
          av: 'font-style: normal; width: ' + (big ? '30px' : '24px') + '; height: ' + (big ? '30px' : '24px') + '; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: ' + (big ? '11px' : '9px') + '; font-weight: 600; color: #FFFFFF; background: ' + g + '; box-shadow: 0 0 0 3px ' + g + '33, 0 0 16px ' + g + '99',
        };
      });
      return cards.concat(cards);
    };

    // budget simulator: the budget pays creator rewards; the 15% platform fee is billed on top of rewards used.
    // Clips are paid up to 100K views each, so the views also need at least that many paid clips.
    const rp = (n) => 'Rp' + Math.round(n).toLocaleString('id-ID');
    const compact = (n) => n >= 1e6 ? (n / 1e6).toFixed(1).replace('.', ',').replace(',0', '') + ' jt' : Math.round(n / 1e3) + 'K';
    const chipStyle = (on) => 'height: 34px; padding: 0 13px; border-radius: 10px; font-size: 13px; font-weight: 600; '
      + (on ? 'color: #FFFFFF; background: rgba(69,72,245,0.3); border: 1px solid #7DA2FF' : 'color: #A1A1AA; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1)');
    const budget = s.budget || 25000000, cpm = s.cpm || 3000;
    const views = budget / cpm * 1000;
    const budgets = [10000000, 25000000, 50000000, 100000000].map((b) => ({ label: rp(b / 1e6) + ' jt', on: b === budget, style: chipStyle(b === budget), pick: () => this.setState({ budget: b }) }));
    const cpms = [2000, 3000, 5000].map((c) => ({ label: rp(c), on: c === cpm, style: chipStyle(c === cpm), pick: () => this.setState({ cpm: c }) }));
    const bstep = s.bstep || 0;
    const bsteps = [0, 1, 2, 3].map((i) => ({
      on: i === bstep, pick: () => this.setState({ bstep: i }),
      tab: 'height: 48px; border-radius: 14px; font-size: 14px; font-weight: 600; white-space: nowrap; '
        + (i === bstep ? 'color: #FFFFFF; background: rgba(69,72,245,0.22); border: 1px solid rgba(125,162,255,0.5)' : 'color: #8A8A93; background: transparent; border: 1px solid transparent'),
      panel: (i === bstep ? 'display: grid' : 'display: none') + '; grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr); gap: 32px; padding: 18px',
    }));

    return {
      isCreator: creator, isBrand: !creator,
      budgets: budgets, cpms: cpms, simBudget: rp(budget), simViews: compact(views), simCost: rp(budget * 1.15),
      simClips: Math.ceil(views / 100000).toLocaleString('id-ID'), bsteps: bsteps,
      creatorTab: tab(creator), brandTab: tab(!creator),
      setCreator: () => this.setState({ mode: 'creator' }),
      setBrand: () => this.setState({ mode: 'brand' }),
      faqC: faqC, faqB: faqB,
      metrics: metrics, lcLine: line, lcArea: line + 'L' + px(6) + ',' + (H - pb) + 'L0,' + (H - pb) + 'Z', lcLabel: 'Grafik ' + met + ' 7 hari',
      wall1: wall(0), wall2: wall(4), wall3: wall(8),
    };
  }
}
