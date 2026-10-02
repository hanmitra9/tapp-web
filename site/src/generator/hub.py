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
      <span style="font-size: 11px; font-weight: 500; color: #9A9AA5; line-height: 15px">Rising di <b class="tabular" style="color: #FFFFFF">50K</b> qualified views</span>
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
    <p class="hfacts" style="margin-top: 4px; font-size: 13px; line-height: 20px; color: #71717A; font-weight: 400; letter-spacing: 0.01em"><span>Tanpa syarat follower</span> <i style="font-style: normal; color: #3F3F46">/</i> <span>Dibayar per 1.000 views</span> <i style="font-style: normal; color: #3F3F46">/</i> <span>Cair ke rekening &amp; e-wallet</span></p>
    <div class="hm" style="display: none; width: 100%; max-width: 420px; flex-direction: column; align-items: center; gap: 12px; margin-top: 8px; text-align: left">{_payout_card()}{_campaign_card()}</div>
  </div>
</div>'''

# ── Level arc ─────────────────────────────────────────────────────────────────────────
# Real tiers and thresholds (app_settings.tier_thresholds, migration 022).
TIERS = [
    ('New', '0', '#8A8A93'), ('Rising', '50K', '#34D07A'), ('Verified', '250K', '#7DA2FF'),
    ('Proven', '1 juta', '#A78BFA'), ('Elite', '5 juta', '#F0B429'),
]
TIER_BODY = [
    'Titik awal. Selesaikan campaign pertama dan kumpulkan clip yang lolos verifikasi.',
    'Clip-mu mulai konsisten lolos. Pola kerjamu sudah terbentuk dan terbaca.',
    'Rekam jejak yang teruji di banyak clip dan campaign. Performamu bisa dipercaya.',
    'Satu juta qualified views. Kamu terbukti menggerakkan audiens nyata.',
    'Puncak level TAPP: lima juta qualified views yang lolos verifikasi.',
]

# Picking a level is plain HTML/CSS (radio + label), so it also works where scripts are blocked.
def _tier_card(i):
    name, thr, color = TIERS[i]
    req = 'Mulai dari 0 qualified views' if i == 0 else f'Mulai dari {thr} qualified views'
    return f'''<div class="tcard tc{i}" style="position: absolute; left: 50%; bottom: 0; transform: translateX(-50%); width: 440px; max-width: 100%; flex-direction: column; align-items: center; gap: 12px; text-align: center">
        <span style="padding: 5px 12px; border-radius: 999px; font-size: 12px; font-weight: 600; color: {color}; background: rgba(255,255,255,0.05); border: 1px solid {color}">Level {i + 1} dari 5</span>
        <b style="font-size: 40px; line-height: 44px; letter-spacing: -1px">{name}</b>
        <span class="tabular" style="font-size: 15px; font-weight: 500; color: #C6D6FF">{req}</span>
        <p style="font-size: 15px; line-height: 23px; color: #9A9AA5; font-weight: 400; max-width: 380px">{TIER_BODY[i]}</p>
        <div style="display: flex; gap: 8px; flex-wrap: wrap; justify-content: center">
          <span class="tchip">Naik otomatis</span><span class="tchip">Notifikasi saat naik</span><span class="tchip">Tampil di profil</span>
        </div>
      </div>'''

def _arc():
    cx, cy, R, r = 500, 500, 480, 290
    pt = lambda rad, a: (cx + rad * math.cos(math.radians(a)), cy + rad * math.sin(math.radians(a)))
    out, labels = [], []
    for i, (name, thr, color) in enumerate(TIERS):
        a0, a1 = 180 + 36 * i, 180 + 36 * (i + 1)
        (x0, y0), (x1, y1) = pt(R, a0), pt(R, a1)
        (x2, y2), (x3, y3) = pt(r, a1), pt(r, a0)
        d = f'M{x0:.1f} {y0:.1f} A{R} {R} 0 0 1 {x1:.1f} {y1:.1f} L{x2:.1f} {y2:.1f} A{r} {r} 0 0 0 {x3:.1f} {y3:.1f} Z'
        mx, my = pt((R + r) / 2, (a0 + a1) / 2)
        out.append(f'''<g aria-hidden="true">
        <path class="tp tp{i}" d="{d}" fill="#0F0F14" stroke="rgba(255,255,255,0.08)" stroke-width="1.5"></path>
        <text class="tt tt{i}" x="{mx:.1f}" y="{my-46:.1f}" text-anchor="middle" font-size="19" font-weight="600" fill="#8A8A93">{name}</text>
        <g class="tb tb{i}" transform="translate({mx-26:.1f} {my-24:.1f})" opacity="0.55">{_badge(color, 52)}</g>
      </g>''')
        # Transparent tap target over the segment (badge + name), in % of the 1000×510 viewBox.
        labels.append(f'<label for="tr{i}" class="tlab" aria-label="Level {name}" style="left: {(mx-80)/10:.2f}%; top: {(my-90)/5.1:.2f}%; width: 16%; height: {150/5.1:.2f}%"></label>')
    return ('<div class="tsvg" style="position: relative"><svg viewBox="0 0 1000 510" width="100%" role="group" aria-label="Level creator TAPP" style="display: block; overflow: visible">'
            '<defs><radialGradient id="arcOn" cx="50%" cy="100%" r="100%"><stop offset="0.3" stop-color="#4548F5" stop-opacity="0.55"></stop><stop offset="1" stop-color="#4548F5" stop-opacity="0.08"></stop></radialGradient></defs>'
            + ''.join(out) + '</svg>' + ''.join(labels) + '</div>')

LEVELS = f'''<section id="level" class="sec pad" style="max-width: 1180px; margin: 0 auto; padding: 72px 64px">
    <div style="display: flex; flex-direction: column; gap: 18px; align-items: center; text-align: center; max-width: 760px; margin: 0 auto 40px">
      <span style="display: inline-flex; font-size: 13px; font-weight: 500; color: #7DA2FF; letter-spacing: 0.02em">Level Creator</span>
      <h2 class="h2" style="font-size: 46px; line-height: 52px; font-weight: 600; letter-spacing: -1.5px">Reputasi Yang Dihitung,<br><span style="color: #7DA2FF">Bukan Diklaim</span></h2>
      <p style="font-size: 17px; line-height: 27px; color: #9A9AA5; font-weight: 400; max-width: 600px">Level naik otomatis dari total qualified views. Jumlah follower tidak ikut dihitung. Makin tinggi level, makin kecil fee penarikanmu. Pilih level untuk melihat syaratnya.</p>
    </div>
    {''.join(f'<input type="radio" name="tier" id="tr{i}" class="tradio"{" checked" if i == 2 else ""}>' for i in range(len(TIERS)))}
    <div class="tarc" style="position: relative; max-width: 1000px; margin: 0 auto">
      {_arc()}
      {''.join(_tier_card(i) for i in range(len(TIERS)))}
    </div>
  </section>'''

# ── Portfolio ─────────────────────────────────────────────────────────────────────────
POINTS = [
    ('Clip Portfolio', 'Semua clip yang lolos tersusun rapi, lengkap dengan views dan penghasilannya.'),
    ('Performance &amp; Reliability', 'Qualified views, approval rate, dan reliability score yang dihitung otomatis dari setiap review.'),
    ('Payout History', 'Setiap pencairan tercatat, dari diajukan hingga diterima di rekeningmu.'),
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
        <h2 class="h2" style="font-size: 44px; line-height: 50px; font-weight: 600; letter-spacing: -1.4px">Portofolio Yang<br><span style="color: #7DA2FF">Bicara Lewat Data</span></h2>
        <p style="font-size: 17px; line-height: 27px; color: #9A9AA5; font-weight: 400; max-width: 480px">Setiap clip yang lolos, setiap view yang terverifikasi, dan setiap pencairan tercatat di profilmu. Bukti kerja yang bisa dipertanggungjawabkan.</p>
        <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 8px; width: 100%">
          {''.join(f'<div style="display: flex; gap: 14px; align-items: flex-start; padding: 16px 18px; border-radius: 18px; background: #0F0F13; border: 1px solid rgba(255,255,255,0.07)"><span class="tabular" style="width: 32px; height: 32px; flex-shrink: 0; border-radius: 10px; background: rgba(69,72,245,0.18); border: 1px solid rgba(125,162,255,0.35); display: inline-flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 600; color: #C6D6FF">0{i+1}</span><span style="display: flex; flex-direction: column; gap: 4px"><b style="font-size: 16px">{t}</b><span style="font-size: 14px; line-height: 21px; color: #9A9AA5; font-weight: 400">{b}</span></span></div>' for i, (t, b) in enumerate(POINTS))}
        </div>
      </div>
      <div style="display: flex; flex-direction: column; align-items: center; gap: 12px">{_dash()}</div>
    </div>
  </section>'''
