# New hero visuals: vertical clips instead of boxes + circuit lines.
from parts import ICON, BLOB_WHITE, BLOB_MARK, big_mark
from scenes import scene

EYE = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"></path><circle cx="12" cy="12" r="3"></circle></svg>'
SIDE = '''<span style="position: absolute; right: 10px; bottom: 48px; display: flex; flex-direction: column; gap: 12px; align-items: center">
  <svg width="20" height="20" viewBox="0 0 24 24" fill="#FFFFFF" fill-opacity="0.9" aria-hidden="true"><path d="M12 21s-7.5-4.6-10-9.3C.4 8.3 2.4 4.5 6 4.5c2 0 3.4 1 4.2 2.4h3.6C14.6 5.5 16 4.5 18 4.5c3.6 0 5.6 3.8 4 7.2C19.5 16.4 12 21 12 21z"></path></svg>
  <svg width="20" height="20" viewBox="0 0 24 24" fill="#FFFFFF" fill-opacity="0.9" aria-hidden="true"><path d="M4 4h16v12H8l-4 4z"></path></svg>
  <svg width="20" height="20" viewBox="0 0 24 24" fill="#FFFFFF" fill-opacity="0.9" aria-hidden="true"><path d="M14 4l7 7-7 7v-4c-5 0-8 1.5-10 5 1-5 4-9 10-10z"></path></svg>
</span>'''

def clip(w, h, kind, handle, views, plat, extra='', colors=None, small=False):
    """A 9:16 short-video tile with a premium TAPP campaign scene inside."""
    a, b = colors if colors else (None, None)
    top = '' if small else f'<span style="position: absolute; left: 12px; top: 12px; display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: #FFFFFF; text-shadow: 0 1px 6px rgba(0,0,0,0.6)"><span style="display: inline-flex">{ICON[plat]}</span>{handle}</span>'
    side = '' if small else SIDE
    return f'''<div style="position: relative; width: {w}px; height: {h}px; border-radius: {12 if small else 22}px; overflow: hidden; background: #07070D; border: 1px solid rgba(255,255,255,0.14); box-shadow: 0 30px 70px -24px rgba(0,0,0,0.9), 0 0 0 1px rgba(117,178,244,0.08)">
  {scene(kind, a, b, w / 200)}
  <div style="position: absolute; inset: 0; background: linear-gradient(180deg, rgba(0,0,0,0.35), transparent 18%, transparent 78%, rgba(0,0,0,0.6))"></div>
  {top}{side}
  <span class="tabular" style="position: absolute; left: {8 if small else 12}px; bottom: {7 if small else 12}px; display: flex; align-items: center; gap: 5px; font-size: {10 if small else 12}px; font-weight: 600; color: #FFFFFF">{EYE}{views}</span>
  {extra}
</div>'''

def motif(kind, color):
    if kind == 'mic':
        return f'<svg viewBox="0 0 200 360" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" aria-hidden="true" style="position: absolute; inset: 0"><g fill="{color}" fill-opacity="0.55">' + ''.join(f'<rect x="{30+i*16}" y="{190-h}" width="9" height="{h}" rx="4.5"></rect>' for i, h in enumerate([30, 60, 95, 70, 120, 85, 50, 100, 65])) + '</g></svg>'
    if kind == 'ring':
        return f'<svg viewBox="0 0 200 360" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" aria-hidden="true" style="position: absolute; inset: 0">' + ''.join(f'<circle cx="100" cy="160" r="{r}" fill="none" stroke="{color}" stroke-opacity="{0.6-i*0.1:.2f}" stroke-width="3"></circle>' for i, r in enumerate([16, 34, 52, 70, 88])) + '</svg>'
    if kind == 'hex':
        import math
        pts = lambda r: ' '.join(f'{100+r*math.cos(math.radians(60*k+30)):.1f},{160+r*math.sin(math.radians(60*k+30)):.1f}' for k in range(6))
        return f'<svg viewBox="0 0 200 360" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" aria-hidden="true" style="position: absolute; inset: 0">' + ''.join(f'<polygon points="{pts(r)}" fill="none" stroke="{color}" stroke-opacity="{0.6-i*0.12:.2f}" stroke-width="2.5"></polygon>' for i, r in enumerate([20, 42, 64, 86])) + '</svg>'
    return f'<svg viewBox="0 0 200 360" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" aria-hidden="true" style="position: absolute; inset: 0"><g fill="{color}" fill-opacity="0.5">' + ''.join(f'<rect x="{34+i*24}" y="{220-h}" width="14" height="{h}" rx="3"></rect>' for i, h in enumerate([30, 52, 44, 78, 104, 130])) + '</g></svg>'

tapp_tag = f'<span style="position: absolute; left: 12px; bottom: 60px; display: inline-flex; align-items: center; gap: 6px; padding: 5px 9px 5px 5px; border-radius: 999px; background: rgba(0,0,0,0.45); border: 1px solid rgba(255,255,255,0.2); font-size: 11px; font-weight: 600; color: #FFFFFF; backdrop-filter: blur(6px)"><i style="font-style: normal; width: 18px; height: 18px; border-radius: 6px; background: #0C65C4; display: inline-flex; align-items: center; justify-content: center"><img src="{BLOB_WHITE}" alt="" style="width: 11px; height: 11px"></i>Campaign TAPP</span>'
badge_ok = '<span style="position: absolute; left: 50%; top: 44px; transform: translateX(-50%); display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; padding: 6px 12px; border-radius: 999px; background: rgba(52,208,122,0.18); border: 1px solid rgba(52,208,122,0.55); color: #7CF0B0; font-size: 12px; font-weight: 600; backdrop-filter: blur(6px); box-shadow: 0 0 20px rgba(52,208,122,0.35)"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7"></path></svg>Lolos verifikasi</span>'
pay_pill = '<span class="tabular" style="position: absolute; left: 50%; top: 16px; transform: translateX(-50%); white-space: nowrap; padding: 12px 18px; border-radius: 14px; background: #FFFFFF; color: #0A0A0C; font-size: 15px; font-weight: 600; box-shadow: 0 18px 40px -10px rgba(117,178,244,0.8)">+Rp234.000 <span style="color: #6E6E78; font-weight: 500">masuk saldo</span></span>'

def hero_creator_visual():
    return f'''<div class="hv fan" style="position: relative; height: 540px; display: flex; align-items: center; justify-content: center">
  <div aria-hidden="true" style="position: absolute; left: 50%; top: 50%; transform: translate(-50%, -54%); opacity: 0.35">{big_mark(420, "hmBg")}</div>
  <div class="t t1">{clip(196, 348, 'quote', '@rani.clips', '128K', 'tt')}</div>
  <div class="t t3">{clip(196, 348, 'reaction', '@dewi.klip', '86K', 'ig')}</div>
  <div class="t t2" style="position: relative">{clip(222, 394, 'app', '@finclips.id', '98K', 'tt', extra=badge_ok)}<div style="position: relative; height: 0">{pay_pill}</div></div>
</div>'''

def hero_brand_visual():
    kinds = ['orbit', 'compare', 'check', 'quote', 'reaction', 'app']
    pals = [('#0A6AD2', '#08294D'), ('#06B6D4', '#083344'), ('#F43F5E', '#4C0519'), ('#4497F0', '#07203C'), ('#F97316', '#431407'), ('#0C65C4', '#0E447E'), ('#10B981', '#052E2B')]
    views = ['128K', '86K', '54K', '212K', '73K', '145K', '61K', '98K', '37K', '176K', '88K', '49K', '120K', '66K', '91K', '140K', '58K', '77K', '104K', '69K']
    cells = ''.join(f'<div class="bt">{clip(96, 170, kinds[i % 6], "", views[i], "tt", colors=pals[(i * 3) % 7], small=True)}</div>' for i in range(20))
    brief = f'''<div style="position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: 300px; padding: 22px; border-radius: 18px; background: linear-gradient(180deg, rgba(22,22,30,0.96), rgba(12,12,18,0.96)); border: 1px solid rgba(117,178,244,0.45); box-shadow: 0 0 0 10px rgba(12,101,196,0.08), 0 40px 90px -20px rgba(12,101,196,0.85); display: flex; flex-direction: column; gap: 12px; backdrop-filter: blur(8px)">
  <div style="display: flex; align-items: center; justify-content: space-between"><span style="font-size: 12px; font-weight: 600; color: #75B2F4">Brief campaign TAPP</span><span style="width: 30px; height: 30px; border-radius: 9px; background: linear-gradient(180deg, #4296F0, #104F92); display: inline-flex; align-items: center; justify-content: center"><img src="{BLOB_WHITE}" alt="" style="width: 17px; height: 17px"></span></div>
  <b style="font-size: 19px; line-height: 24px">TAPP Mega Campaign</b>
  <div class="tabular" style="display: flex; flex-direction: column; font-size: 13px; font-weight: 500">
    <span style="display: flex; justify-content: space-between; padding: 7px 0; border-bottom: 1px solid rgba(255,255,255,0.07)"><span style="color: #9A9AA5">Platform</span><span>TikTok, IG, YouTube</span></span>
    <span style="display: flex; justify-content: space-between; padding: 7px 0; border-bottom: 1px solid rgba(255,255,255,0.07)"><span style="color: #9A9AA5">Tarif</span><span>Rp3.000 /1K views</span></span>
    <span style="display: flex; justify-content: space-between; padding: 7px 0; border-bottom: 1px solid rgba(255,255,255,0.07)"><span style="color: #9A9AA5">Minimal klaim</span><span>5.000 views</span></span>
    <span style="display: flex; justify-content: space-between; padding: 7px 0"><span style="color: #9A9AA5">Maks. per clip</span><span>100K views</span></span>
  </div>
  <span class="tabular" style="display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-radius: 12px; background: rgba(52,208,122,0.12); border: 1px solid rgba(52,208,122,0.35); font-size: 13px; font-weight: 600; color: #7CF0B0"><span style="width: 8px; height: 8px; border-radius: 4px; background: #34D07A; box-shadow: 0 0 10px #34D07A"></span>Terbuka untuk semua creator</span>
</div>'''
    return f'''<div class="hv bwall" style="position: relative; height: 540px; overflow: hidden; -webkit-mask-image: radial-gradient(75% 70% at 50% 50%, #000 45%, transparent 100%); mask-image: radial-gradient(75% 70% at 50% 50%, #000 45%, transparent 100%)">
  <div class="bgrid" style="position: absolute; left: 50%; top: 50%; display: grid; grid-template-columns: repeat(5, 96px); gap: 12px; transform: translate(-50%, -50%) perspective(1400px) rotateX(24deg) rotateZ(-10deg)">{cells}</div>
  <div aria-hidden="true" style="position: absolute; inset: 0; background: radial-gradient(40% 40% at 50% 50%, rgba(12,101,196,0.35), transparent 70%)"></div>
  {brief}
</div>'''
