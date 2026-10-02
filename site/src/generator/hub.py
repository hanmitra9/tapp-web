# Creator-side sections in the "hub" layout: centered TAPP mark wired to floating cards, level arc, portfolio.
import math
from parts import ICON, BLOB_WHITE, FLOAT, CARD
from hero2 import clip, EYE

def _btn(label, href, primary=True):
    st = ('background: linear-gradient(180deg, #5767FF, #3B44E4); border: 1px solid rgba(255,255,255,0.14); box-shadow: 0 8px 24px -14px rgba(69,72,245,0.9), inset 0 1px 0 rgba(255,255,255,0.2)'
          if primary else 'background: #111115; border: 1px solid rgba(255,255,255,0.1)')
    return f'<a class="{"btn-p" if primary else "btn-s"}" href="{href}" style="display: inline-flex; align-items: center; white-space: nowrap; height: 50px; padding: 0 24px; border-radius: 12px; font-weight: 500; font-size: 15px; {st}">{label}</a>'

def _mini_mark(sz=22, r=7):
    return f'<i style="font-style: normal; width: {sz}px; height: {sz}px; border-radius: {r}px; background: linear-gradient(180deg, #4F6BFF, #2238C2); display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0"><img src="{BLOB_WHITE}" alt="" style="width: {sz*0.6:.0f}px; height: {sz*0.6:.0f}px"></i>'

def _badge(color, size=46):
    pts = lambda r, cx, cy: ' '.join(f'{cx+r*math.cos(math.radians(60*k-90)):.1f},{cy+r*math.sin(math.radians(60*k-90)):.1f}' for k in range(6))
    return (f'<svg width="{size}" height="{size}" viewBox="0 0 48 48" aria-hidden="true"><defs><linearGradient id="bd{color[1:]}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0.9"></stop><stop offset="0.35" stop-color="{color}"></stop><stop offset="1" stop-color="{color}" stop-opacity="0.45"></stop></linearGradient></defs>'
            f'<polygon points="{pts(21, 24, 24)}" fill="url(#bd{color[1:]})" stroke="#FFFFFF" stroke-opacity="0.35" stroke-width="1.2"></polygon>'
            f'<polygon points="{pts(13, 24, 24)}" fill="#07070A" fill-opacity="0.35"></polygon>'
            f'<image href="{BLOB_WHITE}" x="15" y="15" width="18" height="18"></image></svg>')

# ── Hero ──────────────────────────────────────────────────────────────────────────────
# Stage is a fixed 1200×400 canvas (scaled down by CSS on smaller screens) so the wires meet the cards exactly.
WIRES = [
    'M290 112 H410 Q420 112 427 119 L462 154 Q469 161 479 161 H540',   # clip   → hub
    'M272 306 H392 Q402 306 409 299 L470 238 Q477 231 487 231 H540',   # campaign → hub
    'M890 92 H812 Q802 92 795 99 L744 150 Q737 157 727 157 H660',      # payout → hub
    'M1000 292 H884 Q874 292 867 285 L794 212 Q787 205 777 205 H660',  # level → hub
]

def _wires():
    base = ''.join(f'<path d="{d}" stroke="#4548F5" stroke-width="5" opacity="0.45" filter="url(#hwb)"></path><path d="{d}" stroke="#7DA2FF" stroke-width="1.4" opacity="0.75"></path>' for d in WIRES)
    pulses = ''.join(f'<path class="pulse" pathLength="100" style="animation-delay: -{i*0.9:.1f}s" d="{d}"></path>' for i, d in enumerate(WIRES))
    return f'<svg class="hwire" viewBox="0 0 1200 400" aria-hidden="true" style="position: absolute; inset: 0; width: 1200px; height: 400px"><defs><filter id="hwb" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="3"></feGaussianBlur></filter></defs><g fill="none" stroke-linecap="round" stroke-linejoin="round">{base}{pulses}</g></svg>'

def _payout_card():
    return f'''<div style="width: 260px; padding: 14px 16px; border-radius: 16px; {FLOAT}; display: flex; flex-direction: column; gap: 10px">
      <span style="display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600"><span style="display: inline-flex; color: #D4D4D8">{ICON['tt']}</span>@rani.clips</span>
      <div class="tabular" style="display: flex; justify-content: space-between; gap: 10px">
        <span style="display: flex; flex-direction: column; gap: 3px"><span style="font-size: 11px; font-weight: 500; color: #8A8A93">Qualified views</span><b style="display: flex; align-items: center; gap: 5px; font-size: 17px">{EYE}86K</b></span>
        <span style="display: flex; flex-direction: column; gap: 3px; text-align: right"><span style="font-size: 11px; font-weight: 500; color: #8A8A93">Estimasi Payout</span><b style="font-size: 17px; color: #34D07A">Rp258.000</b></span>
      </div>
    </div>'''

def _campaign_card():
    return f'''<div style="width: 252px; padding: 14px; border-radius: 16px; {FLOAT}; display: flex; flex-direction: column; gap: 9px">
      <div style="position: relative; height: 62px; border-radius: 10px; overflow: hidden; background: linear-gradient(135deg, #0E1A6B, #4548F5)">
        <img src="{BLOB_WHITE}" alt="" style="position: absolute; right: 12px; top: 9px; width: 44px; height: 44px; opacity: 0.9"><span style="position: absolute; left: 12px; bottom: 9px; font-size: 16px; font-weight: 600; letter-spacing: -0.3px">TAPP Campaign</span>
      </div>
      <span style="display: flex; align-items: center; justify-content: space-between"><span style="display: flex; align-items: center; gap: 7px; font-size: 12px; font-weight: 600">{_mini_mark(18, 6)}TAPP</span><span style="font-size: 10px; font-weight: 600; padding: 3px 7px; border-radius: 6px; background: rgba(255,255,255,0.06)">CLIPPING</span></span>
      <span class="tabular"><b style="font-size: 16px">Rp3.000</b><span style="font-size: 11px; color: #8A8A93; font-weight: 500"> /1K Views</span></span>
      <span style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 500; color: #9A9AA5"><span>Budget Tersisa</span><span class="tabular" style="color: #FFFFFF">100%</span></span>
      <span style="height: 5px; border-radius: 3px; background: #1F1F26; display: block"><span style="display: block; width: 100%; height: 5px; border-radius: 3px; background: linear-gradient(90deg, #4548F5, #7DA2FF)"></span></span>
    </div>'''

def _level_card():
    return f'''<div style="width: 160px; padding: 14px; border-radius: 16px; {FLOAT}; display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center">
      <span style="font-size: 12px; font-weight: 600; color: #D4D4D8">Your Level</span>
      {_badge('#8A8A93', 54)}
      <b style="font-size: 18px">New</b>
      <span style="width: 100%; height: 1px; background: rgba(255,255,255,0.08)"></span>
      <span style="font-size: 11px; font-weight: 500; color: #9A9AA5; line-height: 15px">Rising di <b class="tabular" style="color: #FFFFFF">100K</b> qualified views</span>
    </div>'''

HUB = f'''<div class="hub" style="position: absolute; left: 540px; top: 120px; width: 120px; height: 120px; border-radius: 30px; display: flex; align-items: center; justify-content: center; background: linear-gradient(180deg, #5B74FF, #2238C2); border: 1px solid rgba(198,214,255,0.6); box-shadow: 0 0 0 10px rgba(69,72,245,0.14), 0 0 0 22px rgba(69,72,245,0.06), 0 0 90px rgba(69,72,245,0.85), inset 0 1px 0 rgba(255,255,255,0.35)"><img src="{BLOB_WHITE}" alt="" style="width: 62px; height: 62px"></div>'''

AV = ''.join(f'<i style="font-style: normal; width: 26px; height: 26px; border-radius: 13px; margin-left: {0 if k==0 else -8}px; background: {c}; border: 2px solid #07070A; display: inline-flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 600">{n}</i>'
             for k, (n, c) in enumerate([('RP', '#34D07A'), ('DP', '#F2692B'), ('NK', '#2F8CE6')]))

def hero_hub():
    return f'''<div class="hero2" style="position: relative; max-width: 1280px; margin: 0 auto; padding: 8px 0 24px">
  <div class="hstage-wrap" style="position: relative; height: 400px; overflow: visible">
    <div class="hstage" style="position: absolute; left: 50%; top: 0; width: 1200px; height: 400px; margin-left: -600px">
      <div aria-hidden="true" style="position: absolute; left: 380px; top: 20px; width: 440px; height: 320px; background-image: radial-gradient(rgba(125,162,255,0.35) 1px, transparent 1.4px); background-size: 16px 16px; -webkit-mask-image: radial-gradient(closest-side, #000, transparent); mask-image: radial-gradient(closest-side, #000, transparent)"></div>
      {_wires()}
      <div class="hc" style="position: absolute; left: 170px; top: 6px">{clip(120, 196, 'quote', '', '128K', 'tt', small=True)}</div>
      <div class="hc" style="position: absolute; left: 20px; top: 214px">{_campaign_card()}</div>
      <div class="hc" style="position: absolute; left: 890px; top: 40px">{_payout_card()}</div>
      <div class="hc" style="position: absolute; left: 1000px; top: 206px">{_level_card()}</div>
      {HUB}
    </div>
  </div>
  <div class="pad" style="position: relative; display: flex; flex-direction: column; align-items: center; gap: 20px; text-align: center; padding: 0 24px">
    <h1 class="hero-h" style="font-size: 62px; line-height: 66px; font-weight: 500">Dibayar Untuk Setiap<br> <span style="color: #7DA2FF">View Yang Nyata</span></h1>
    <p style="font-size: 19px; line-height: 29px; color: #A1A1AA; font-weight: 400; max-width: 560px">Ambil brief dari brand, posting dari akunmu sendiri, dan terima bayaran untuk setiap 1.000 views yang lolos verifikasi.</p>
    <div style="display: flex; gap: 12px; flex-wrap: wrap; justify-content: center">{_btn("Mulai Sekarang", "#app:/register")}{_btn("Jelajahi Campaign", "campaigns.html", False)}</div>
    <div class="hm" style="display: none; width: 100%; max-width: 420px; flex-direction: column; align-items: center; gap: 12px; margin-top: 8px; text-align: left">{_payout_card()}{_campaign_card()}</div>
  </div>
</div>'''

# ── Level arc ─────────────────────────────────────────────────────────────────────────
# Real tiers and thresholds (app_settings.tier_thresholds, migration 022).
TIERS = [
    ('New', '0', '#8A8A93'), ('Rising', '100K', '#34D07A'), ('Verified', '500K', '#7DA2FF'),
    ('Proven', '2 juta', '#A78BFA'), ('Elite', '10 juta', '#F0B429'),
]
TIER_BODY = [
    'Titik awal. Selesaikan campaign pertama dan kumpulkan clip yang lolos verifikasi.',
    'Clip-mu mulai konsisten lolos. Pola kerjamu sudah terbentuk dan terbaca.',
    'Rekam jejak yang teruji di banyak clip dan campaign. Performamu bisa dipercaya.',
    'Dua juta qualified views. Kamu terbukti menggerakkan audiens nyata.',
    'Puncak level TAPP: sepuluh juta qualified views yang lolos verifikasi.',
]

# Rate bonus per level (app_settings.tier_bonus_pct, migration 0037), paid by TAPP on top of the clip's pay.
TIER_BONUS = [0, 2, 5, 10, 15]

# Picking a level is plain HTML/CSS (radio + label), so it also works where scripts are blocked.
# Layout: a staircase of five steps (taller = higher level) next to a detail card for the picked level.
STEP_H = [64, 104, 144, 188, 236]

def _rgba(hex_, a):
    h = hex_.lstrip('#')
    return f'rgba({int(h[0:2], 16)},{int(h[2:4], 16)},{int(h[4:6], 16)},{a})'

def _tier_card(i):
    name, thr, color = TIERS[i]
    req = 'Mulai dari 0 qualified views' if i == 0 else f'Mulai dari {thr} qualified views'
    bonus = (f'<span class="tabular" style="font-size: 15px; font-weight: 600; color: #34D07A">Bonus tarif +{TIER_BONUS[i]}%</span>'
             if TIER_BONUS[i] else '<span style="font-size: 15px; font-weight: 600; color: #9A9AA5">Tarif standar</span>')
    return f'''<div class="tcard tc{i}" style="flex-direction: column; gap: 14px; padding: 28px; border-radius: 22px; background: linear-gradient(160deg, {_rgba(color, 0.16)}, rgba(15,15,20,0.9) 55%); border: 1px solid {_rgba(color, 0.35)}">
        <div style="display: flex; align-items: center; gap: 14px">
          {_badge(color, 56)}
          <div style="display: flex; flex-direction: column; gap: 2px">
            <span style="font-size: 12px; font-weight: 600; color: {color}; letter-spacing: 0.04em">LEVEL {i + 1} DARI 5</span>
            <b style="font-size: 32px; line-height: 36px; letter-spacing: -0.8px">{name}</b>
          </div>
        </div>
        <span class="tabular" style="font-size: 15px; font-weight: 500; color: #C6D6FF">{req}</span>
        <div>{bonus}</div>
        <p style="font-size: 15px; line-height: 23px; color: #9A9AA5; font-weight: 400">{TIER_BODY[i]}</p>
        <div style="display: flex; gap: 8px; flex-wrap: wrap">
          <span class="tchip">Naik otomatis</span><span class="tchip">Notifikasi saat naik</span><span class="tchip">Tampil di profil</span>
        </div>
      </div>'''

def _stairs():
    steps = []
    for i, (name, thr, color) in enumerate(TIERS):
        steps.append(f'''<label for="tr{i}" class="tstep ts{i}" aria-label="Level {name}">
          <span class="tbadge">{_badge(color, 34)}</span>
          <span class="tname">{name}</span>
          <span class="tbar" style="height: {STEP_H[i]}px"><span class="tabular">{thr}</span></span>
        </label>''')
    return '<div class="tstairs" role="group" aria-label="Level creator TAPP">' + ''.join(steps) + '</div>'

# Selected step: lit in its color; steps below it: softly tinted (the climb so far).
TIER_CSS = (
    '.lp .tradio{position:absolute;opacity:0;pointer-events:none}'
    '.lp .tlad{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);gap:40px;align-items:end}'
    '.lp .tstairs{display:flex;align-items:flex-end;gap:10px;min-height:330px}'
    '.lp .tstep{flex:1;display:flex;flex-direction:column;align-items:center;gap:8px;cursor:pointer;-webkit-tap-highlight-color:transparent}'
    '.lp .tbadge{opacity:.45;transition:opacity .25s ease,transform .25s ease}'
    '.lp .tname{font-size:15px;font-weight:600;color:#8A8A93;transition:color .25s ease}'
    '.lp .tbar{width:100%;display:flex;justify-content:center;padding-top:12px;border-radius:14px 14px 6px 6px;background:#101016;border:1px solid rgba(255,255,255,0.07);font-size:13px;font-weight:600;color:#5E5E68;transition:background .25s ease,border-color .25s ease,color .25s ease}'
    '.lp .tstep:hover .tbadge{opacity:.8}'
    '.lp .tcard{display:none}'
    '.lp .tradio:focus-visible ~ .tlad .tstairs{outline:2px solid #7DA2FF;outline-offset:8px;border-radius:14px}'
    + ''.join(
        f'.lp #tr{k}:checked ~ .tlad .tc{k}{{display:flex}}'
        f'.lp #tr{k}:checked ~ .tlad .ts{k} .tbar{{background:linear-gradient(180deg,{_rgba(TIERS[k][2], 0.55)},{_rgba(TIERS[k][2], 0.12)});border-color:{TIERS[k][2]};color:#FFFFFF}}'
        f'.lp #tr{k}:checked ~ .tlad .ts{k} .tbadge{{opacity:1;transform:translateY(-4px)}}'
        f'.lp #tr{k}:checked ~ .tlad .ts{k} .tname{{color:#FFFFFF}}'
        + ''.join(f'.lp #tr{k}:checked ~ .tlad .ts{j} .tbar{{background:{_rgba(TIERS[j][2], 0.1)};color:#9A9AA5}}' for j in range(k))
        for k in range(len(TIERS)))
    + '@media (max-width: 900px){'
      '.lp .tlad{grid-template-columns:minmax(0,1fr);gap:24px}'
      '.lp .tstairs{min-height:250px;gap:6px}'
      '.lp .tname{font-size:12px}'
      '.lp .tbar{font-size:11px;padding-top:8px}'
      + ''.join(f'.lp .ts{i} .tbar{{height:{round(STEP_H[i] * 0.72)}px !important}}' for i in range(len(TIERS)))
      + '.lp .tcard{padding:22px}'
      '}'
)

LEVELS = f'''<section id="level" class="sec pad" style="max-width: 1180px; margin: 0 auto; padding: 72px 64px">
    <div style="display: flex; flex-direction: column; gap: 18px; align-items: center; text-align: center; max-width: 760px; margin: 0 auto 48px">
      <span style="display: inline-flex; font-size: 13px; font-weight: 500; color: #7DA2FF; letter-spacing: 0.02em">Level Creator</span>
      <h2 class="h2" style="font-size: 46px; line-height: 52px; font-weight: 600; letter-spacing: -1.5px">Reputasi Yang Dihitung, <br><span style="color: #7DA2FF">Bukan Diklaim</span></h2>
      <p style="font-size: 17px; line-height: 27px; color: #9A9AA5; font-weight: 400; max-width: 600px">Level naik otomatis dari total qualified views. Jumlah follower tidak ikut dihitung. Makin tinggi level, makin besar bonus tarifmu. Pilih level untuk melihat syaratnya.</p>
    </div>
    {''.join(f'<input type="radio" name="tier" id="tr{i}" class="tradio"{" checked" if i == 2 else ""}>' for i in range(len(TIERS)))}
    <div class="tlad">
      {_stairs()}
      <div class="tdetail">{''.join(_tier_card(i) for i in range(len(TIERS)))}</div>
    </div>
  </section>'''

# ── Portfolio ─────────────────────────────────────────────────────────────────────────
POINTS = [
    ('Clip Portfolio', 'Semua clip yang lolos tersusun rapi, lengkap dengan views dan penghasilannya.'),
    ('Performance &amp; Reliability', 'Qualified views, approval rate, dan reliability score yang dihitung otomatis dari setiap review.'),
    ('Payout History', 'Setiap bayaran tercatat, lengkap dengan clip dan tanggal transfernya.'),
]

def _dash():
    tiles = ''.join(f'<div style="flex: 1; min-width: 0">{clip(110, 170, k, "", v, "tt", colors=c, small=True)}</div>'
                    for k, v, c in [('quote', '128K', ('#4F7BFF', '#0F1B4D')), ('reaction', '86K', ('#F97316', '#431407')), ('compare', '98K', ('#06B6D4', '#083344'))])
    stat = lambda l, v, extra='': f'<span style="display: flex; flex-direction: column; gap: 4px; padding: 12px 14px; border-radius: 14px; background: #15151B; border: 1px solid rgba(255,255,255,0.06)"><span style="font-size: 11px; font-weight: 500; color: #8A8A93">{l}</span><b class="tabular" style="font-size: 18px{extra}">{v}</b></span>'
    return f'''<div class="pdash" style="width: 100%; max-width: 440px; padding: 18px; border-radius: 18px; {CARD}; display: flex; flex-direction: column; gap: 14px; box-shadow: 0 40px 90px -40px rgba(69,72,245,0.8), inset 0 1px 0 rgba(255,255,255,0.05)">
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px">
        <span style="display: flex; align-items: center; gap: 10px"><i style="font-style: normal; width: 36px; height: 36px; border-radius: 18px; background: #34D07A; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600">RP</i><span style="display: flex; flex-direction: column"><b style="font-size: 15px">Rani Putri</b><span style="font-size: 12px; color: #8A8A93; font-weight: 500">@rani.clips</span></span></span>
        <span style="display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px 4px 4px; border-radius: 999px; background: rgba(125,162,255,0.12); border: 1px solid rgba(125,162,255,0.35); font-size: 12px; font-weight: 600; color: #C6D6FF">{_badge('#7DA2FF', 22)}Verified</span>
      </div>
      <div style="position: relative; overflow: hidden; padding: 16px 18px; border-radius: 18px; background: linear-gradient(135deg, #4F6BFF, #1E2FA8); box-shadow: inset 0 1px 0 rgba(255,255,255,0.25)">
        <span style="font-size: 12px; font-weight: 500; color: rgba(255,255,255,0.8)">Total penghasilan</span>
        <b class="tabular" style="display: block; font-size: 30px; letter-spacing: -0.6px; margin-top: 2px">Rp4.250.000</b>
        <img src="{BLOB_WHITE}" alt="" style="position: absolute; right: -10px; top: -14px; width: 104px; height: 104px; opacity: 0.14">
      </div>
      <div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px">{stat('Qualified views', '1,4 jt')}{stat('Approval', '94%')}{stat('Reliability', '92', '; color: #34D07A')}</div>
      <span style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 600"><span>Clip kamu</span><span style="color: #7DA2FF">Lihat semua</span></span>
      <div class="ctiles" style="display: flex; gap: 8px; overflow: hidden">{tiles}</div>
    </div>'''

PORTFOLIO = f'''<section id="portofolio" class="sec pad" style="max-width: 1180px; margin: 0 auto; padding: 72px 64px">
    <div class="g2" style="display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 48px; align-items: center">
      <div style="display: flex; flex-direction: column; gap: 18px; align-items: flex-start">
        <span style="display: inline-flex; font-size: 13px; font-weight: 500; color: #7DA2FF; letter-spacing: 0.02em">Creator Profile</span>
        <h2 class="h2" style="font-size: 44px; line-height: 50px; font-weight: 600; letter-spacing: -1.4px">Portofolio Yang <br><span style="color: #7DA2FF">Bicara Lewat Data</span></h2>
        <p style="font-size: 17px; line-height: 27px; color: #9A9AA5; font-weight: 400; max-width: 480px">Setiap clip yang lolos, setiap view yang terverifikasi, dan setiap bayaran tercatat di profilmu. Bukti kerja yang bisa dipertanggungjawabkan.</p>
        <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 8px; width: 100%">
          {''.join(f'<div style="display: flex; gap: 14px; align-items: flex-start; padding: 16px 18px; border-radius: 18px; background: #0F0F13; border: 1px solid rgba(255,255,255,0.07)"><span class="tabular" style="width: 32px; height: 32px; flex-shrink: 0; border-radius: 10px; background: rgba(69,72,245,0.18); border: 1px solid rgba(125,162,255,0.35); display: inline-flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 600; color: #C6D6FF">0{i+1}</span><span style="display: flex; flex-direction: column; gap: 4px"><b style="font-size: 16px">{t}</b><span style="font-size: 14px; line-height: 21px; color: #9A9AA5; font-weight: 400">{b}</span></span></div>' for i, (t, b) in enumerate(POINTS))}
        </div>
      </div>
      <div style="display: flex; flex-direction: column; align-items: center; gap: 12px">{_dash()}</div>
    </div>
  </section>'''
