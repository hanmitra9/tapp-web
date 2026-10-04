
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

class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = { mode: null, openC: 0, openB: 0, met: 'Views', budget: 25000000, bstep: 0 };
  }
  renderVals() {
    const s = this.state;
    const mode = s.mode ?? this.props.startMode ?? 'creator';
    const creator = mode === 'creator';
    const tab = (on) => 'height: 32px; padding: 0 14px; border-radius: 9px; font-weight: 500; font-size: 14px; '
      + (on ? 'color: #FFFFFF; background: linear-gradient(180deg, #4296F0, #135BA8); border: 1px solid rgba(194,221,250,0.3); box-shadow: 0 6px 18px -8px rgba(12,101,196,0.9), inset 0 1px 0 rgba(255,255,255,0.25)' : 'color: #8A8A93; background: transparent; border: 1px solid transparent');

    const faqList = (raw, key) => raw.map((f, i) => {
      const open = s[key] === i;
      return {
        q: f[0], a: f[1], open: open, signText: open ? '×' : '+',
        box: 'border-radius: 16px; ' + (open
          ? 'background: radial-gradient(80% 160% at 0% 0%, rgba(12,101,196,0.18), transparent 60%), linear-gradient(180deg, #12131A, #0C0C11); border: 1px solid rgba(101,169,242,0.38); box-shadow: 0 24px 60px -30px rgba(12,101,196,0.8), inset 0 1px 0 rgba(255,255,255,0.05)'
          : 'background: linear-gradient(180deg, #101015, #0B0B0F); border: 1px solid rgba(255,255,255,0.07)'),
        sign: 'width: 28px; height: 28px; flex-shrink: 0; border-radius: 14px; display: inline-flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 400; transition: transform .25s ease; '
          + (open ? 'color: #FFFFFF; background: linear-gradient(180deg, #4296F0, #135BA8); transform: rotate(0deg)' : 'color: #A4CCF8; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08)'),
        toggle: () => this.setState({ [key]: open ? -1 : i }),
      };
    });
    const faqC = faqList([
      ['TAPP itu sebenarnya apa?', 'Tempat brand menaruh campaign dan creator mengerjakannya. Kamu bikin clip pendek dari konten sumber, posting di akunmu sendiri, dan dibayar dari views yang lolos verifikasi.'],
      ['Bagaimana hitungan bayarannya?', 'Qualified views dikali tarif per 1.000 views. Qualified artinya views yang lolos saringan bot dan aktivitas janggal, jadi angka mentah di TikTok bisa berbeda dengan yang dibayar. Rinciannya terlihat per clip.'],
      ['Kapan aku dibayar?', 'Setelah clip-mu diterima tim TAPP, bayarannya masuk ke saldomu. Tarik kapan saja setelah saldo mencapai Rp100.000. Setiap pencairan dipotong fee platform 18% dan biaya transfer Rp10.000, lalu bonus level ditambahkan.'],
      ['Dibayar ke mana?', 'E-wallet (GoPay, OVO, DANA, ShopeePay, LinkAja) atau rekening bank (BCA, BRI, BNI, Mandiri, dan lainnya) yang kamu isi di profil. Tim TAPP mentransfer setelah kamu menarik saldo.'],
      ['Berapa views minimal supaya dibayar?', 'Tiap campaign punya aturannya sendiri. Di TAPP Mega Campaign, clip mulai dihitung setelah mencapai 5.000 views dan dibayar sampai 100K views per clip, jadi maksimal Rp300.000 per clip.'],
      ['Follower saya masih sedikit, boleh?', 'Boleh. Tidak ada minimum follower. Level naik dari clip yang lolos dan approval rate-mu, jadi creator baru punya jalur yang sama.'],
      ['Clip saya ditolak, lalu?', 'Kamu langsung melihat alasannya. Kalau diminta revisi, perbaiki lalu kirim ulang selama campaign berjalan. Kalau merasa keliru, ajukan keberatan dari dashboard.'],
    ], 'openC');
    const faqB = faqList([
      ['Bagaimana brand bergabung?', 'Akses brand dibuka lewat tim TAPP. Setelah brief siap, kami kirim undangan ke email timmu untuk masuk ke dashboard brand.'],
      ['Views mana yang saya bayar?', 'Hanya qualified views: views yang lolos saringan bot dan aktivitas janggal, lalu direview tim TAPP. Views mentah tetap terlihat di laporan sebagai pembanding.'],
      ['Bisakah saya memilih creator?', 'Campaign ditawarkan ke creator yang cocok dari platform dan rekam jejak, bukan dari jumlah follower. Account manager-mu bisa membantu mengarahkan profil creator yang dicari.'],
      ['Kalau budget habis di tengah campaign?', 'Campaign otomatis masuk fase segera berakhir dan views berikutnya tidak dibayar, jadi pengeluaranmu tidak pernah melewati budget.'],
      ['Laporan apa yang saya dapat?', 'Views mentah dan qualified, total biaya, CPV, serta performa per platform dan per creator.'],
      ['Berapa biayanya?', 'Satu harga all-in per 1.000 qualified views, tanpa fee tambahan. Kamu hanya membayar views yang lolos verifikasi. Rincian biaya dibahas langsung bersama tim TAPP saat meeting, sesuai brief dan target campaign-mu.'],
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
        + (met === k ? 'background: rgba(12,101,196,0.25); border: 1px solid #4B9BF0; color: #C2DDFA' : 'background: rgba(255,255,255,0.04); border: 1px solid #26262C; color: #8A8A93'),
    }));

    // creator wall (reference): demo names and payouts from the reference artifact
    const GLOW = ['#34D07A', '#F2692B', '#1461B3', '#0A6AD2', '#E2445C', '#F0B429'];
    // three rows, three different sets of creators (demo names and payouts)
    const rows = [
      [['Rani Putri', 'Rp4.250.000'], ['Dimas Pratama', 'Rp1.870.000'], ['Nadia Kusuma', 'Rp3.120.000'], ['Bagus Santoso', 'Rp960.000'],
       ['Sari Wulandari', 'Rp2.480.000'], ['Ayu Lestari', 'Rp5.630.000'], ['Tika Anjani', 'Rp1.340.000'], ['Kevin Wijaya', 'Rp7.210.000']],
      [['Lina Marlina', 'Rp2.050.000'], ['Rio Hartono', 'Rp3.790.000'], ['Maya Puspita', 'Rp1.120.000'], ['Hendra Gunawan', 'Rp6.480.000'],
       ['Fajar Nugroho', 'Rp2.940.000'], ['Citra Ayuningtyas', 'Rp4.870.000'], ['Yoga Pratama', 'Rp1.560.000'], ['Intan Permata', 'Rp3.410.000']],
      [['Arif Setiawan', 'Rp5.120.000'], ['Dewi Anggraini', 'Rp2.230.000'], ['Reza Mahendra', 'Rp8.040.000'], ['Putri Maharani', 'Rp1.790.000'],
       ['Bima Saputra', 'Rp3.660.000'], ['Nabila Zahra', 'Rp2.710.000'], ['Galih Prakoso', 'Rp4.390.000'], ['Salsa Amelia', 'Rp1.250.000']],
    ];
    const wall = (offset) => {
      const set = rows[offset].concat(rows[offset]);
      const cards = set.map((pp, i) => {
        const name = pp[0], pay = pp[1], g = GLOW[(i + offset) % 6], big = false;
        return {
          name: name, sub: pay, ini: name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase(),
          card: 'flex-shrink: 0; height: 88px; min-width: 230px; padding: 0 22px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; border-radius: 16px; background: linear-gradient(180deg, #15151B, #0D0D11); border: 1px solid rgba(255,255,255,0.08)',
          whoRow: 'display: flex; align-items: center; gap: 10px; white-space: nowrap; font-weight: 500; color: #E4E4E7; font-size: ' + (big ? '17px' : '14px'),
          // dark avatar: deep tile, initials and a hairline ring in the accent color, no neon glow
          av: 'font-style: normal; width: 28px; height: 28px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 600; letter-spacing: 0.02em; color: ' + g + '; background: radial-gradient(circle at 30% 25%, ' + g + '26, #0C0C10 72%); box-shadow: inset 0 0 0 1px ' + g + '55, 0 6px 14px -8px ' + g,
        };
      });
      return cards.concat(cards);
    };

    // budget simulator: the budget pays creator rewards at a flat Rp1.000 per 1.000 qualified views.
    // Clips are paid up to 100K views each, so the views also need at least that many paid clips.
    const rp = (n) => 'Rp' + Math.round(n).toLocaleString('id-ID');
    const compact = (n) => n >= 1e6 ? (n / 1e6).toFixed(1).replace('.', ',').replace(',0', '') + ' jt' : Math.round(n / 1e3) + 'K';
    const chipStyle = (on) => 'height: 34px; padding: 0 13px; border-radius: 10px; font-size: 13px; font-weight: 600; '
      + (on ? 'color: #FFFFFF; background: rgba(12,101,196,0.3); border: 1px solid #75B2F4' : 'color: #A1A1AA; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1)');
    const budget = s.budget || 25000000, cpm = 1000;   // simulator assumes Rp1.000 per 1.000 views
    const views = budget / cpm * 1000;
    const BARS = 36, simPct = (budget / 1e6 - 5) / 195 * 100;
    const simBars = Array.from({ length: BARS }, (_, i) => ({
      h: Math.round(16 + 84 * Math.pow(i / (BARS - 1), 1.5) + 5 * Math.sin(i * 1.7)),
      cls: (i + 0.5) / BARS * 100 <= simPct ? 'on' : '',
    }));
    // Slider: no setState while dragging (a re-render would replace the input); update the numbers in place.
    const simVals = (b) => ({ simBudget: rp(b), simViews: compact(b / cpm * 1000), simClips: Math.ceil(b / cpm * 1000 / 100000).toLocaleString('id-ID') });
    const onBudget = (e) => {
      const jt = Number(e.target.value); s.budget = jt * 1e6;
      const pct = (jt - 5) / 195 * 100;
      e.target.parentNode.style.setProperty('--p', pct + '%');
      e.target.parentNode.querySelectorAll('.bsl-bars i').forEach((el, i) => { el.className = (i + 0.5) / BARS * 100 <= pct ? 'on' : ''; });
      const v = simVals(s.budget);
      document.querySelectorAll('[data-sim]').forEach((el) => { const k = el.getAttribute('data-sim'); if (k in v) el.textContent = v[k]; });
    };
    const bstep = s.bstep || 0;
    const bsteps = [0, 1, 2, 3].map((i) => ({
      on: i === bstep, pick: () => this.setState({ bstep: i }),
      tab: 'height: 48px; border-radius: 14px; font-size: 14px; font-weight: 600; white-space: nowrap; '
        + (i === bstep ? 'color: #FFFFFF; background: rgba(12,101,196,0.22); border: 1px solid rgba(117,178,244,0.5)' : 'color: #8A8A93; background: transparent; border: 1px solid transparent'),
      panel: (i === bstep ? 'display: grid' : 'display: none') + '; grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr); gap: 32px; padding: 18px',
    }));

    return {
      isCreator: creator, isBrand: !creator,
      simBudget: rp(budget), simViews: compact(views), simRate: rp(1000), simBudgetJt: budget / 1e6, simPct: simPct, simBars: simBars, onBudget: onBudget,
      simClips: Math.ceil(views / 100000).toLocaleString('id-ID'), bsteps: bsteps,
      creatorTab: tab(creator), brandTab: tab(!creator),
      // Switching audience shows a different page: start it from the top.
      setCreator: () => { this.setState({ mode: 'creator' }); window.scrollTo({ top: 0, behavior: 'instant' }); },
      setBrand: () => { this.setState({ mode: 'brand' }); window.scrollTo({ top: 0, behavior: 'instant' }); },
      faqC: faqC, faqB: faqB,
      metrics: metrics, lcLine: line, lcArea: line + 'L' + px(6) + ',' + (H - pb) + 'L0,' + (H - pb) + 'Z', lcLabel: 'Grafik ' + met + ' 7 hari',
      wall1: wall(0), wall2: wall(1), wall3: wall(2),
    };
  }
}
window.__tappMount(Component);
