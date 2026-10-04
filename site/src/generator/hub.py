# Creator-side sections in the "hub" layout: centered TAPP mark wired to floating cards, level arc, portfolio.
import math
from parts import ICON, BLOB_WHITE, FLOAT, CARD
from hero2 import clip, EYE

def _btn(label, href, primary=True):
    st = ('background: linear-gradient(180deg, #4C9CF1, #1565BA); border: 1px solid rgba(255,255,255,0.14); box-shadow: 0 8px 24px -14px rgba(12,101,196,0.9), inset 0 1px 0 rgba(255,255,255,0.2)'
          if primary else 'background: #111115; border: 1px solid rgba(255,255,255,0.1)')
    return f'<a class="{"btn-p" if primary else "btn-s"}" href="{href}" style="display: inline-flex; align-items: center; white-space: nowrap; height: 50px; padding: 0 24px; border-radius: 12px; font-weight: 500; font-size: 15px; {st}">{label}</a>'

def _mini_mark(sz=22, r=7):
    return f'<i style="font-style: normal; width: {sz}px; height: {sz}px; border-radius: {r}px; background: linear-gradient(180deg, #4296F0, #104F92); display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0"><img src="{BLOB_WHITE}" alt="" style="width: {sz*0.6:.0f}px; height: {sz*0.6:.0f}px"></i>'

# Level emblems: a faceted metal hexagon with the TAPP mark, ornament grows with the level.
# New = plain steel · Rising = chevron · Verified = crystal fins · Proven = laurel · Elite = crown and rays.
_BADGE_TIER = {'#8A8A93': 0, '#34D07A': 1, '#75B2F4': 2, '#A78BFA': 3, '#F0B429': 4}
_METAL = [  # light, mid, dark per level
    ('#F4F4F7', '#9A9AA6', '#3A3A44'), ('#D9FBE8', '#34D07A', '#0E4A2C'), ('#E4F0FD', '#66AAF3', '#0A325D'),
    ('#EFE8FF', '#A78BFA', '#3B2577'), ('#FFF4C7', '#F0B429', '#6B4207'),
]

def _hexpts(r, cx=32, cy=32, rot=-90):
    return [(cx + r * math.cos(math.radians(60 * k + rot)), cy + r * math.sin(math.radians(60 * k + rot))) for k in range(6)]

def _badge(color, size=46):
    t = _BADGE_TIER.get(color, 0)
    hi, mid, lo = _METAL[t]
    g = f'bm{t}'
    pts = lambda ps: ' '.join(f'{x:.1f},{y:.1f}' for x, y in ps)
    outer, inner = _hexpts(20), _hexpts(14.5)
    # facets: each outer edge to the inner hexagon, alternating light/dark like a cut stone
    facets = ''.join(f'<polygon points="{pts([outer[k], outer[(k + 1) % 6], inner[(k + 1) % 6], inner[k]])}" fill="{hi if k in (5, 0) else mid if k in (1, 4) else lo}" fill-opacity="{0.55 if k in (5, 0) else 0.35 if k in (1, 4) else 0.6}"></polygon>' for k in range(6))
    orn = ''
    if t == 1:   # Rising: chevron under the stone
        orn = f'<path d="M22 54 L32 60 L42 54" fill="none" stroke="url(#{g})" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></path>'
    elif t == 2:  # Verified: crystal fins either side
        orn = (f'<polygon points="10,26 3,32 10,38 13,32" fill="url(#{g})" opacity="0.9"></polygon>'
               f'<polygon points="54,26 61,32 54,38 51,32" fill="url(#{g})" opacity="0.9"></polygon>')
    elif t == 3:  # Proven: laurel branches
        leaves = []
        for side in (-1, 1):
            for j in range(5):
                ang = math.radians(100 + j * 21) if side < 0 else math.radians(80 - j * 21)
                x, y = 32 + 26 * math.cos(ang), 32 + 26 * math.sin(ang)
                rot = math.degrees(ang) + (90 if side < 0 else -90)
                leaves.append(f'<ellipse cx="{x:.1f}" cy="{y:.1f}" rx="2.6" ry="5.6" transform="rotate({rot:.0f} {x:.1f} {y:.1f})" fill="url(#{g})" opacity="{0.95 - j * 0.12:.2f}"></ellipse>')
        orn = ''.join(leaves)
    elif t == 4:  # Elite: rays behind, crown on top
        rays = ''.join(f'<polygon points="{pts([(32 + 30 * math.cos(math.radians(a)), 32 + 30 * math.sin(math.radians(a))), (32 + 19 * math.cos(math.radians(a - 7)), 32 + 19 * math.sin(math.radians(a - 7))), (32 + 19 * math.cos(math.radians(a + 7)), 32 + 19 * math.sin(math.radians(a + 7)))])}" fill="{mid}" opacity="0.55"></polygon>'
                       for a in range(0, 360, 30) if a not in (270,))
        crown = f'<path d="M23 9 L26 2 L29.5 7 L32 0.5 L34.5 7 L38 2 L41 9 Z" fill="url(#{g})" stroke="{lo}" stroke-width="0.6" stroke-linejoin="round"></path>'
        orn = rays + crown
    return (f'<svg width="{size}" height="{size}" viewBox="0 0 64 64" aria-hidden="true" style="overflow: visible">'
            f'<defs><linearGradient id="{g}" x1="0.15" y1="0" x2="0.85" y2="1"><stop offset="0" stop-color="{hi}"></stop><stop offset="0.45" stop-color="{mid}"></stop><stop offset="1" stop-color="{lo}"></stop></linearGradient>'
            f'<radialGradient id="{g}c" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stop-color="{mid}"></stop><stop offset="1" stop-color="#07070A"></stop></radialGradient></defs>'
            + orn
            + f'<polygon points="{pts(_hexpts(21.5))}" fill="url(#{g})"></polygon>'
            + facets
            + f'<polygon points="{pts(inner)}" fill="url(#{g}c)" stroke="{hi}" stroke-opacity="0.5" stroke-width="0.8"></polygon>'
            + f'<polygon points="{pts(_hexpts(21.5))}" fill="none" stroke="{hi}" stroke-opacity="0.65" stroke-width="0.9"></polygon>'
            + f'<image href="{BLOB_WHITE}" x="23" y="23" width="18" height="18"></image></svg>')

# ── Hero ──────────────────────────────────────────────────────────────────────────────
# Stage is a fixed 1200×400 canvas (scaled down by CSS on smaller screens) so the wires meet the cards exactly.
# Each wire: (card port x, y) → (hub port x, y). Drawn as a smooth S-curve.
WIRES = [
    (272, 188, 540, 182),    # campaign → hub
    (890, 92, 660, 157),     # payout   → hub
    (1000, 292, 660, 205),   # level    → hub
]
HUB_C = (600, 180)

def _curve(x0, y0, x1, y1):
    k = (x1 - x0) * 0.5
    return f'M{x0} {y0} C{x0 + k:.0f} {y0}, {x1 - k:.0f} {y1}, {x1} {y1}'

def _wires():
    cx, cy = HUB_C
    defs, base, comets, ports = [], [], [], []
    for i, (x0, y0, x1, y1) in enumerate(WIRES):
        d = _curve(x0, y0, x1, y1)
        # Line brightens toward the hub: faint at the card, near-white where it enters TAPP.
        defs.append(f'<linearGradient id="hwg{i}" gradientUnits="userSpaceOnUse" x1="{x0}" y1="{y0}" x2="{x1}" y2="{y1}">'
                    '<stop offset="0" stop-color="#75B2F4" stop-opacity="0.18"></stop><stop offset="0.55" stop-color="#75B2F4" stop-opacity="0.65"></stop>'
                    '<stop offset="1" stop-color="#DAEAFC" stop-opacity="1"></stop></linearGradient>')
        base.append(f'<path d="{d}" stroke="#0C65C4" stroke-width="8" opacity="0.3" filter="url(#hwb)"></path>'
                    f'<path d="{d}" stroke="url(#hwg{i})" stroke-width="1.6"></path>')
        delay = f'animation-delay: -{i * 1.1:.1f}s'
        comets.append(f'<path class="comet" pathLength="100" style="{delay}" d="{d}"></path>'
                      f'<path class="comet-h" pathLength="100" style="{delay}" d="{d}"></path>')
        ports.append(f'<circle class="hport" cx="{x0}" cy="{y0}" r="4" fill="#0B0B12" stroke="#75B2F4" stroke-opacity="0.7" stroke-width="1.2"></circle>'
                     f'<circle cx="{x1}" cy="{y1}" r="2.4" fill="#DAEAFC"></circle>')
    rings = (f'<g mask="url(#hwfade)" fill="none">'
             f'<circle cx="{cx}" cy="{cy}" r="104" stroke="rgba(154,199,247,0.16)"></circle>'
             f'<circle cx="{cx}" cy="{cy}" r="150" stroke="rgba(154,199,247,0.10)" stroke-dasharray="1 7" stroke-linecap="round"></circle>'
             f'<circle cx="{cx}" cy="{cy}" r="200" stroke="rgba(154,199,247,0.07)"></circle>'
             f'<g class="orb"><circle cx="{cx}" cy="{cy - 150}" r="2.6" fill="#C2DDFA"></circle></g>'
             f'<g class="orb orb2"><circle cx="{cx}" cy="{cy + 104}" r="2" fill="#75B2F4"></circle></g></g>')
    return ('<svg class="hwire" viewBox="0 0 1200 400" aria-hidden="true" style="position: absolute; inset: 0; width: 1200px; height: 400px; overflow: visible"><defs>'
            '<filter id="hwb" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="3.5"></feGaussianBlur></filter>'
            f'<radialGradient id="hwr" cx="{cx}" cy="{cy}" r="220" gradientUnits="userSpaceOnUse"><stop offset="0.35" stop-color="#FFFFFF"></stop><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"></stop></radialGradient>'
            '<mask id="hwfade"><rect x="0" y="-100" width="1200" height="600" fill="url(#hwr)"></rect></mask>'
            + ''.join(defs) + '</defs>' + rings
            + '<g fill="none" stroke-linecap="round">' + ''.join(base) + ''.join(comets) + '</g>' + ''.join(ports) + '</svg>')

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
      <div style="position: relative; height: 62px; border-radius: 10px; overflow: hidden; background: linear-gradient(135deg, #092A4E, #0C65C4)">
        <img src="{BLOB_WHITE}" alt="" style="position: absolute; right: 12px; top: 9px; width: 44px; height: 44px; opacity: 0.9"><span style="position: absolute; left: 12px; bottom: 9px; font-size: 16px; font-weight: 600; letter-spacing: -0.3px">TAPP Campaign</span>
      </div>
      <span style="display: flex; align-items: center; justify-content: space-between"><span style="display: flex; align-items: center; gap: 7px; font-size: 12px; font-weight: 600">{_mini_mark(18, 6)}TAPP</span><span style="font-size: 10px; font-weight: 600; padding: 3px 7px; border-radius: 6px; background: rgba(255,255,255,0.06)">CLIPPING</span></span>
      <span class="tabular"><b style="font-size: 16px">Rp3.000</b><span style="font-size: 11px; color: #8A8A93; font-weight: 500"> /1K Views</span></span>
      <span style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 500; color: #9A9AA5"><span>Budget Tersisa</span><span class="tabular" style="color: #FFFFFF">100%</span></span>
      <span style="height: 5px; border-radius: 3px; background: #1F1F26; display: block"><span style="display: block; width: 100%; height: 5px; border-radius: 3px; background: linear-gradient(90deg, #0C65C4, #75B2F4)"></span></span>
    </div>'''

def _level_card():
    return f'''<div style="width: 160px; padding: 14px; border-radius: 16px; {FLOAT}; display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center">
      <span style="font-size: 12px; font-weight: 600; color: #D4D4D8">Your Level</span>
      {_badge('#8A8A93', 54)}
      <b style="font-size: 18px">New</b>
      <span style="width: 100%; height: 1px; background: rgba(255,255,255,0.08)"></span>
      <span style="font-size: 11px; font-weight: 500; color: #9A9AA5; line-height: 15px">Rising di <b class="tabular" style="color: #FFFFFF">100K</b> qualified views</span>
    </div>'''

HUB = f'''<div class="hub" style="position: absolute; left: 540px; top: 120px; width: 120px; height: 120px; border-radius: 30px; display: flex; align-items: center; justify-content: center; background: linear-gradient(180deg, #519EF1, #104F92); border: 1px solid rgba(194,221,250,0.6); box-shadow: 0 0 0 10px rgba(12,101,196,0.14), 0 0 0 22px rgba(12,101,196,0.06), 0 0 90px rgba(12,101,196,0.85), inset 0 1px 0 rgba(255,255,255,0.35)"><img src="{BLOB_WHITE}" alt="" style="width: 62px; height: 62px"></div>'''

AV = ''.join(f'<i style="font-style: normal; width: 26px; height: 26px; border-radius: 13px; margin-left: {0 if k==0 else -8}px; background: radial-gradient(circle at 30% 25%, {c}26, #0C0C10 72%); box-shadow: inset 0 0 0 1px {c}55; color: {c}; border: 2px solid #07070A; display: inline-flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 600">{n}</i>'
             for k, (n, c) in enumerate([('RP', '#34D07A'), ('DP', '#F2692B'), ('NK', '#1461B3')]))

# Phone hero: the same idea turned vertical, cards above and below the TAPP mark, wires running down into it.
# Stage is 360×600 (CSS-scaled to the screen width); card boxes measured from the rendered cards.
M_W, M_H = 360, 600
M_HUB = (180, 300, 88)   # centre x, centre y, size
M_CARDS = [  # (html, left, top, scale, port side, port x, port y) — port = where the wire leaves the card
    ('campaign', 102, 40, 0.62),
    ('level', 22, 418, 0.8),
    ('payout', 170, 470, 0.66),
]
M_WIRES = [(180, 156, 180, 256), (86, 418, 166, 344), (256, 470, 194, 344)]   # card port → hub port (boxes measured)

def _mcurve(x0, y0, x1, y1):
    k = (y1 - y0) * 0.55
    return f'M{x0:.0f} {y0:.0f} C{x0:.0f} {y0 + k:.0f}, {x1:.0f} {y1 - k:.0f}, {x1:.0f} {y1:.0f}'

def _mwires():
    cx, cy, sz = M_HUB
    defs, base, comets, ports = [], [], [], []
    for i, (x0, y0, x1, y1) in enumerate(M_WIRES):
        d = _mcurve(x0, y0, x1, y1)
        defs.append(f'<linearGradient id="mwg{i}" gradientUnits="userSpaceOnUse" x1="{x0}" y1="{y0}" x2="{x1}" y2="{y1}">'
                    '<stop offset="0" stop-color="#75B2F4" stop-opacity="0.2"></stop><stop offset="0.55" stop-color="#66AAF3" stop-opacity="0.7"></stop>'
                    '<stop offset="1" stop-color="#DAEAFC"></stop></linearGradient>')
        base.append(f'<path d="{d}" stroke="#0C65C4" stroke-width="7" opacity="0.3" filter="url(#mwb)"></path><path d="{d}" stroke="url(#mwg{i})" stroke-width="1.5"></path>')
        delay = f'animation-delay: -{i * 1.1:.1f}s'
        comets.append(f'<path class="comet" pathLength="100" style="{delay}" d="{d}"></path><path class="comet-h" pathLength="100" style="{delay}" d="{d}"></path>')
        ports.append(f'<circle cx="{x0}" cy="{y0}" r="3.5" fill="#0B0B12" stroke="#75B2F4" stroke-opacity="0.75" stroke-width="1.2"></circle><circle cx="{x1}" cy="{y1}" r="2.2" fill="#DAEAFC"></circle>')
    rings = (f'<g fill="none"><circle cx="{cx}" cy="{cy}" r="78" stroke="rgba(154,199,247,0.16)"></circle>'
             f'<circle cx="{cx}" cy="{cy}" r="112" stroke="rgba(154,199,247,0.09)" stroke-dasharray="1 6" stroke-linecap="round"></circle>'
             f'<g class="orbm"><circle cx="{cx}" cy="{cy - 112}" r="2.2" fill="#C2DDFA"></circle></g></g>')
    return (f'<svg viewBox="0 0 {M_W} {M_H}" aria-hidden="true" style="position: absolute; inset: 0; width: {M_W}px; height: {M_H}px; overflow: visible"><defs>'
            '<filter id="mwb" x="-50%" y="-20%" width="200%" height="140%"><feGaussianBlur stdDeviation="3"></feGaussianBlur></filter>'
            + ''.join(defs) + '</defs>' + rings + '<g fill="none" stroke-linecap="round">' + ''.join(base) + ''.join(comets) + '</g>' + ''.join(ports) + '</svg>')

def _mcard(kind):
    return {'campaign': _campaign_card, 'clip': lambda: clip(120, 196, 'quote', '', '128K', 'tt', small=True),
            'level': _level_card, 'payout': _payout_card}[kind]()

def hero_hub_mobile():
    cx, cy, sz = M_HUB
    cards = ''.join(f'<div class="hmc hmc-{k}" style="position: absolute; left: {x}px; top: {y}px; transform: scale({sc}); transform-origin: top left">{_mcard(k)}</div>'
                    for k, x, y, sc in M_CARDS)
    hub = (f'<div class="hub" style="position: absolute; left: {cx - sz // 2}px; top: {cy - sz // 2}px; width: {sz}px; height: {sz}px; border-radius: 24px; display: flex; align-items: center; justify-content: center; '
           'background: linear-gradient(180deg, #519EF1, #12569F); border: 1px solid rgba(194,221,250,0.6); box-shadow: 0 0 0 9px rgba(12,101,196,0.14), 0 0 0 20px rgba(12,101,196,0.06), 0 0 80px rgba(12,101,196,0.8), inset 0 1px 0 rgba(255,255,255,0.35)">'
           f'<img src="{BLOB_WHITE}" alt="" style="width: 46px; height: 46px"></div>')
    return (f'<div class="hstage-m" aria-hidden="true"><div class="hstage-m-in" style="position: relative; width: {M_W}px; height: {M_H}px; margin: 0 auto">'
            f'<div style="position: absolute; left: {cx - 190}px; top: {cy - 190}px; width: 380px; height: 380px; border-radius: 50%; background: radial-gradient(closest-side, rgba(12,101,196,0.3), rgba(12,101,196,0.08) 55%, transparent)"></div>'
            + _mwires() + cards + hub + '</div></div>')

def hero_hub():
    return f'''<div class="hero2" style="position: relative; max-width: 1280px; margin: 0 auto; padding: 8px 0 24px">
  <div class="hstage-wrap" style="position: relative; height: 400px; overflow: visible">
    <div class="hstage" style="position: absolute; left: 50%; top: 0; width: 1200px; height: 400px; margin-left: -600px">
      <div aria-hidden="true" style="position: absolute; left: 400px; top: -20px; width: 400px; height: 400px; border-radius: 50%; background: radial-gradient(closest-side, rgba(12,101,196,0.28), rgba(12,101,196,0.08) 55%, transparent)"></div>
      {_wires()}
      <div class="hc" style="position: absolute; left: 20px; top: 96px">{_campaign_card()}</div>
      <div class="hc" style="position: absolute; left: 890px; top: 40px">{_payout_card()}</div>
      <div class="hc" style="position: absolute; left: 1000px; top: 206px">{_level_card()}</div>
      {HUB}
    </div>
  </div>
  {hero_hub_mobile()}
  <div class="pad hcopy" style="position: relative; display: flex; flex-direction: column; align-items: center; gap: 20px; text-align: center; padding: 0 24px">
    <h1 class="hero-h" style="font-size: 62px; line-height: 66px; font-weight: 500">Ubah Clip Jadi <br><span style="color: #75B2F4">Penghasilan Nyata</span></h1>
    <p style="font-size: 19px; line-height: 29px; color: #A1A1AA; font-weight: 400; max-width: 560px">Ambil campaign dari brand, posting dari akunmu sendiri, dan dibayar dari setiap views yang lolos verifikasi. Tanpa minimal follower.</p>
    <div style="display: flex; gap: 12px; flex-wrap: wrap; justify-content: center">{_btn("Mulai Sekarang", "#app:/register")}{_btn("Jelajahi Campaign", "campaigns.html", False)}</div>
    <div class="hm" style="display: none; width: 100%; max-width: 420px; flex-direction: column; align-items: center; gap: 12px; margin-top: 8px; text-align: left">{_payout_card()}{_campaign_card()}</div>
  </div>
</div>'''

# ── Level arc ─────────────────────────────────────────────────────────────────────────
# Real tiers and thresholds (app_settings.tier_thresholds, migration 022).
TIERS = [
    ('New', '0', '#8A8A93'), ('Rising', '100K', '#34D07A'), ('Verified', '500K', '#75B2F4'),
    ('Proven', '2 juta', '#A78BFA'), ('Elite', '10 juta', '#F0B429'),
]
TIER_BODY = [
    'Semua mulai dari sini. Selesaikan campaign pertama dan kumpulkan clip yang lolos.',
    'Clip-mu mulai konsisten lolos, dan bonus tarif pertamamu aktif.',
    'Rekam jejakmu terbukti di banyak campaign. Brand mulai melirik clip-mu.',
    'Dua juta views nyata. Kamu terbukti bisa menggerakkan audiens.',
    'Level tertinggi di TAPP: sepuluh juta views nyata dan bonus tarif terbesar.',
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
        <span class="tabular" style="font-size: 15px; font-weight: 500; color: #C2DDFA">{req}</span>
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
          <span class="tbadge">{_badge(color, 44)}</span>
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
    '.lp .tradio:focus-visible ~ .tlad .tstairs{outline:2px solid #75B2F4;outline-offset:8px;border-radius:14px}'
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
      <span class="eyebrow">Level Creator</span>
      <h2 class="h2" style="font-size: 46px; line-height: 52px; font-weight: 600; letter-spacing: -1.5px">Makin Konsisten, <br><span style="color: #75B2F4">Makin Besar Bayaranmu</span></h2>
      <p style="font-size: 17px; line-height: 27px; color: #9A9AA5; font-weight: 400; max-width: 600px">Level naik otomatis dari total qualified views, bukan dari jumlah follower. Setiap naik level, bonus tarifmu ikut naik. Pilih level untuk lihat syaratnya.</p>
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
                    for k, v, c in [('quote', '128K', ('#4497F0', '#07203C')), ('reaction', '86K', ('#F97316', '#431407')), ('compare', '98K', ('#06B6D4', '#083344'))])
    stat = lambda l, v, extra='': f'<span style="display: flex; flex-direction: column; gap: 4px; padding: 12px 14px; border-radius: 14px; background: #15151B; border: 1px solid rgba(255,255,255,0.06)"><span style="font-size: 11px; font-weight: 500; color: #8A8A93">{l}</span><b class="tabular" style="font-size: 18px{extra}">{v}</b></span>'
    return f'''<div class="pdash" style="width: 100%; max-width: 440px; padding: 18px; border-radius: 18px; {CARD}; display: flex; flex-direction: column; gap: 14px; box-shadow: 0 40px 90px -40px rgba(12,101,196,0.8), inset 0 1px 0 rgba(255,255,255,0.05)">
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px">
        <span style="display: flex; align-items: center; gap: 10px"><i style="font-style: normal; width: 36px; height: 36px; border-radius: 18px; background: radial-gradient(circle at 30% 25%, #34D07A26, #0C0C10 72%); box-shadow: inset 0 0 0 1px #34D07A55, 0 6px 14px -8px #34D07A; color: #34D07A; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600; letter-spacing: 0.02em">RP</i><span style="display: flex; flex-direction: column"><b style="font-size: 15px">Rani Putri</b><span style="font-size: 12px; color: #8A8A93; font-weight: 500">@rani.clips</span></span></span>
        <span style="display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px 4px 4px; border-radius: 999px; background: rgba(117,178,244,0.12); border: 1px solid rgba(117,178,244,0.35); font-size: 12px; font-weight: 600; color: #C2DDFA">{_badge('#75B2F4', 22)}Verified</span>
      </div>
      <div style="position: relative; overflow: hidden; padding: 16px 18px; border-radius: 18px; background: linear-gradient(135deg, #4296F0, #0E4580); box-shadow: inset 0 1px 0 rgba(255,255,255,0.25)">
        <span style="font-size: 12px; font-weight: 500; color: rgba(255,255,255,0.8)">Total payout</span>
        <b class="tabular" style="display: block; font-size: 30px; letter-spacing: -0.6px; margin-top: 2px">Rp4.250.000</b>
        <img src="{BLOB_WHITE}" alt="" style="position: absolute; right: -10px; top: -14px; width: 104px; height: 104px; opacity: 0.14">
      </div>
      <div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px">{stat('Qualified views', '1,4 jt')}{stat('Approval', '94%')}{stat('Reliability', '92', '; color: #34D07A')}</div>
      <span style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 600"><span>Clip kamu</span><span style="color: #75B2F4">Lihat semua</span></span>
      <div class="ctiles" style="display: flex; gap: 8px; overflow: hidden">{tiles}</div>
    </div>'''

PORTFOLIO = f'''<section id="portofolio" class="sec pad" style="max-width: 1180px; margin: 0 auto; padding: 72px 64px">
    <div class="g2" style="display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 48px; align-items: center">
      <div style="display: flex; flex-direction: column; gap: 18px; align-items: flex-start">
        <span class="eyebrow">Creator Profile</span>
        <h2 class="h2" style="font-size: 44px; line-height: 50px; font-weight: 600; letter-spacing: -1.4px">Portofolio Yang <br><span style="color: #75B2F4">Bicara Lewat Data</span></h2>
        <p style="font-size: 17px; line-height: 27px; color: #9A9AA5; font-weight: 400; max-width: 480px">Setiap clip yang lolos, setiap view yang terverifikasi, dan setiap bayaran tersimpan di profilmu. Bukti kerja yang bisa kamu tunjukkan ke siapa pun.</p>
        <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 8px; width: 100%">
          {''.join(f'<div style="display: flex; gap: 14px; align-items: flex-start; padding: 16px 18px; border-radius: 18px; background: #0F0F13; border: 1px solid rgba(255,255,255,0.07)"><span class="tabular" style="width: 32px; height: 32px; flex-shrink: 0; border-radius: 10px; background: rgba(12,101,196,0.18); border: 1px solid rgba(117,178,244,0.35); display: inline-flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 600; color: #C2DDFA">0{i+1}</span><span style="display: flex; flex-direction: column; gap: 4px"><b style="font-size: 16px">{t}</b><span style="font-size: 14px; line-height: 21px; color: #9A9AA5; font-weight: 400">{b}</span></span></div>' for i, (t, b) in enumerate(POINTS))}
        </div>
      </div>
      <div style="display: flex; flex-direction: column; align-items: center; gap: 12px">{_dash()}</div>
    </div>
  </section>'''
