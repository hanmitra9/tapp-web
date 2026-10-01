# Building blocks for the TAPP landing (dark premium, follows the reference artifact's structure)
P1, P2 = open('/tmp/ref/mark_paths.txt').read().split('\n')
BLOB_MARK = '/_blob/58aec98a357608dc6fa8a4a440fc9214'
BLOB_WHITE = '/_blob/2d5aebeddb5d0a63b818258d6ea37530'

CARD = 'background: linear-gradient(180deg, #131318, #0C0C10); border: 1px solid rgba(255,255,255,0.08); box-shadow: inset 0 1px 0 rgba(255,255,255,0.05), 0 24px 60px -30px rgba(0,0,0,0.9)'
FLOAT = 'background: linear-gradient(180deg, rgba(24,24,32,0.92), rgba(12,12,18,0.92)); border: 1px solid rgba(125,162,255,0.28); box-shadow: 0 0 0 1px rgba(69,72,245,0.08), 0 20px 50px -18px rgba(69,72,245,0.55), inset 0 1px 0 rgba(255,255,255,0.08); backdrop-filter: blur(10px)'

def big_mark(size, gid):
    """Glowing vector TAPP mark (paths from the reference artifact)."""
    return f'''<svg width="{size}" height="{size*476//516}" viewBox="11.9 9.6 492.7 456.6" aria-hidden="true" style="overflow: visible">
  <defs>
    <linearGradient id="{gid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#C6D6FF"></stop><stop offset="0.45" stop-color="#5B7CFA"></stop><stop offset="1" stop-color="#2238C2"></stop></linearGradient>
    <filter id="{gid}b" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="22"></feGaussianBlur></filter>
  </defs>
  <g filter="url(#{gid}b)" opacity="0.9"><path d="{P1}" fill="#4548F5"></path><path d="{P2}" fill="#4548F5"></path></g>
  <path d="{P1}" fill="url(#{gid})"></path><path d="{P2}" fill="url(#{gid})"></path>
</svg>'''

def head(pill, l1, l2, sub, center=True, maxw=760):
    al = 'align-items: center; text-align: center; margin: 0 auto' if center else 'align-items: flex-start'
    return f'''<div style="display: flex; flex-direction: column; gap: 18px; {al}; max-width: {maxw}px; margin-bottom: 48px">
      <span style="display: inline-flex; padding: 7px 14px; border-radius: 999px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); font-size: 13px; font-weight: 600; color: #D4D4D8">{pill}</span>
      <h2 class="h2" style="font-size: 50px; line-height: 56px; font-weight: 700; letter-spacing: -1.5px">{l1}<br><span style="color: #7DA2FF">{l2}</span></h2>
      <p style="font-size: 17px; line-height: 27px; color: #9A9AA5; font-weight: 500; max-width: 600px">{sub}</p>
    </div>'''

ICON = {
 'tt': '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-label="TikTok"><path d="M16.6 5.8A4.3 4.3 0 0 1 15 3.2h-2.7v11.6a2.3 2.3 0 1 1-2.4-2.3c.2 0 .5 0 .7.1V9.8a5.1 5.1 0 1 0 4.4 5V9.2c1 .7 2.2 1.1 3.5 1.1V7.6c-.8 0-1.6-.3-2.3-.8z"></path></svg>',
 'ig': '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-label="Instagram"><rect x="3.5" y="3.5" width="17" height="17" rx="5"></rect><circle cx="12" cy="12" r="4"></circle><circle cx="17.2" cy="6.8" r="1" fill="currentColor"></circle></svg>',
 'yt': '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-label="YouTube"><path d="M21.6 7.2a2.6 2.6 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.6 2.6 0 0 0 2.4 7.2 27 27 0 0 0 2 12a27 27 0 0 0 .4 4.8 2.6 2.6 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.6 2.6 0 0 0 1.8-1.8A27 27 0 0 0 22 12a27 27 0 0 0-.4-4.8zM10 15V9l5.2 3z"></path></svg>',
 'user': '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="8" r="4"></circle><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"></path></svg>',
}

def art(kind, c1, c2):
    """Header art per campaign category (SVG, no stock images)."""
    g = f'<defs><linearGradient id="ag{kind}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{c1}"></stop><stop offset="1" stop-color="{c2}"></stop></linearGradient></defs><rect width="400" height="190" fill="url(#ag{kind})"></rect>'
    if kind == 'pod':
        hs = [40, 70, 110, 80, 130, 95, 60, 120, 85, 50, 100, 70]
        body = ''.join(f'<rect x="{210+i*15}" y="{150-h}" width="8" height="{h}" rx="4" fill="#FFFFFF" fill-opacity="{0.25+0.04*i:.2f}"></rect>' for i, h in enumerate(hs))
    elif kind == 'cof':
        body = ''.join(f'<circle cx="300" cy="95" r="{r}" fill="none" stroke="#FFFFFF" stroke-opacity="{0.5-i*0.07:.2f}" stroke-width="3"></circle>' for i, r in enumerate([18, 36, 54, 72, 90, 108]))
    elif kind == 'edu':
        body = '<g transform="rotate(-35 300 95)"><rect x="220" y="80" width="150" height="26" rx="4" fill="#FFFFFF" fill-opacity="0.35"></rect><path d="M370 80 L398 93 L370 106 Z" fill="#FFFFFF" fill-opacity="0.55"></path><rect x="206" y="80" width="18" height="26" rx="3" fill="#FFFFFF" fill-opacity="0.2"></rect></g>' + ''.join(f'<line x1="240" y1="{40+i*22}" x2="390" y2="{40+i*22}" stroke="#FFFFFF" stroke-opacity="0.08"></line>' for i in range(7))
    elif kind == 'fin':
        body = ''.join(f'<rect x="{230+i*28}" y="{160-h}" width="18" height="{h}" rx="3" fill="#FFFFFF" fill-opacity="{0.22+0.06*i:.2f}"></rect>' for i, h in enumerate([30, 48, 42, 70, 96, 124]))
    elif kind == 'gam':
        import math
        def hexp(cx, cy, r):
            return ' '.join(f'{cx+r*math.cos(math.radians(60*k+30)):.1f},{cy+r*math.sin(math.radians(60*k+30)):.1f}' for k in range(6))
        body = ''.join(f'<polygon points="{hexp(300, 95, r)}" fill="none" stroke="#FFFFFF" stroke-opacity="{0.5-i*0.1:.2f}" stroke-width="2.5"></polygon>' for i, r in enumerate([22, 44, 66, 88]))
    elif kind == 'tapp':
        body = ''.join(f'<circle cx="318" cy="92" r="{r}" fill="none" stroke="#FFFFFF" stroke-opacity="{0.3-i*0.06:.2f}" stroke-width="2"></circle>' for i, r in enumerate([46, 70, 94, 118])) + f'<circle cx="318" cy="92" r="60" fill="#7DA2FF" fill-opacity="0.35" filter="url(#tglow)"></circle><image href="{BLOB_WHITE}" x="283" y="57" width="70" height="70"></image><defs><filter id="tglow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="18"></feGaussianBlur></filter></defs>'
    else:
        body = '<path d="M180 150 C 240 60, 290 60, 330 120 S 390 150, 420 90 L420 190 L180 190 Z" fill="#FFFFFF" fill-opacity="0.18"></path><path d="M200 170 C 250 110, 300 110, 340 150 S 400 170, 420 130" stroke="#FFFFFF" stroke-opacity="0.45" stroke-width="3" fill="none"></path>'
    return f'<svg width="100%" height="100%" viewBox="0 0 400 190" preserveAspectRatio="xMidYMid slice" aria-hidden="true" style="position: absolute; inset: 0">{g}{body}</svg>'

CAMPAIGNS = [
  # the real first campaign: Rp3.000 / 1K views, claim from 5.000 views, paid up to 100K views per clip
  ('tapp', '#0E1A6B', '#4548F5', 'TAPP<br>Campaign', 'Campaign resmi', 'TAPP', '#4548F5', 'Clipping', 'Kenalkan TAPP lewat clip pendekmu', 'Rp3.000', ['tt', 'ig', 'yt'], 'SEMUA NICHE', None, None),
]

def campaign_card(c):
    kind, c1, c2, htitle, tag, brand, bcol, typ, title, rate, plats, cat, n, pct = c
    ini = ''.join(w[0] for w in brand.split()[:2]).upper()
    icons = ''.join(f'<span style="color: #D4D4D8; display: inline-flex">{ICON[p]}</span>' for p in plats)
    return f'''<article class="ccard" style="border-radius: 22px; overflow: hidden; {CARD}; display: flex; flex-direction: column">
      <div style="position: relative; height: 190px; overflow: hidden">
        {art(kind, c1, c2)}
        <div style="position: absolute; inset: 0; background: linear-gradient(180deg, rgba(0,0,0,0) 30%, rgba(0,0,0,0.55))"></div>
        <span style="position: absolute; right: 14px; top: 14px; padding: 5px 11px; border-radius: 999px; background: rgba(0,0,0,0.45); border: 1px solid rgba(255,255,255,0.18); font-size: 12px; font-weight: 700; backdrop-filter: blur(6px)">{tag}</span>
        <span style="position: absolute; left: 20px; bottom: 16px; font-size: 34px; line-height: 34px; font-weight: 700; letter-spacing: -0.8px; text-shadow: 0 4px 20px rgba(0,0,0,0.4)">{htitle}</span>
      </div>
      <div style="padding: 18px 20px 20px; display: flex; flex-direction: column; gap: 12px">
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px">
          <span style="display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 14px"><i style="font-style: normal; width: 24px; height: 24px; border-radius: 8px; background: linear-gradient(180deg, #4F6BFF, #2238C2); display: inline-flex; align-items: center; justify-content: center; box-shadow: 0 0 12px rgba(69,72,245,0.7)"><img src="{BLOB_WHITE}" alt="" style="width: 14px; height: 14px"></i>{brand}<svg width="14" height="14" viewBox="0 0 24 24" aria-label="Terverifikasi"><circle cx="12" cy="12" r="10" fill="#4548F5"></circle><path d="M7.5 12.5l3 3 6-6.5" fill="none" stroke="#FFFFFF" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"></path></svg></span>
          <span style="padding: 4px 10px; border-radius: 8px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.08); font-size: 12px; font-weight: 700; color: #D4D4D8">{typ}</span>
        </div>
        <h3 style="font-size: 18px; line-height: 24px; font-weight: 700">{title}</h3>
        <span class="tabular"><span style="font-size: 20px; font-weight: 700">{rate}</span><span style="font-size: 13px; color: #8A8A93; font-weight: 600"> /1K Views</span></span>
        <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap">
          <span style="display: inline-flex; gap: 8px">{icons}</span>
          <span style="padding: 3px 8px; border-radius: 6px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); font-size: 10px; font-weight: 700; letter-spacing: 0.4px; color: #B4B4BD">{cat}</span>
          {'' if n is None else f"<span style='display: inline-flex; align-items: center; gap: 4px; color: #B4B4BD; font-size: 12px; font-weight: 700'>{ICON['user']}{n}</span>"}
        </div>
        <div class="tabular" style="display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 8px; margin-top: 4px">
          <span style="padding: 10px 12px; border-radius: 12px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); display: flex; flex-direction: column; gap: 2px"><span style="font-size: 11px; font-weight: 600; color: #8A8A93">Minimal klaim</span><b style="font-size: 15px">5.000 views</b></span>
          <span style="padding: 10px 12px; border-radius: 12px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); display: flex; flex-direction: column; gap: 2px"><span style="font-size: 11px; font-weight: 600; color: #8A8A93">Maks. per clip</span><b style="font-size: 15px">100K views</b></span>
        </div>
        <a class="btn-p" href="#app:/register" style="display: flex; align-items: center; justify-content: center; height: 44px; border-radius: 12px; font-weight: 700; font-size: 15px; background: linear-gradient(180deg, #4D63FF, #2F45D6)">Ambil campaign</a>
      </div>
    </article>'''


def soon_card(title, body):
    return f'''<article style="border-radius: 22px; overflow: hidden; border: 1px dashed rgba(125,162,255,0.3); background: radial-gradient(80% 60% at 50% 0%, rgba(69,72,245,0.12), transparent 70%), #0B0B0F; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 32px; text-align: center; min-height: 420px">
      <span style="width: 56px; height: 56px; border-radius: 18px; background: rgba(69,72,245,0.14); border: 1px solid rgba(125,162,255,0.3); display: inline-flex; align-items: center; justify-content: center"><img src="{BLOB_MARK}" alt="" style="width: 28px; height: 28px; opacity: 0.8"></span>
      <span style="padding: 4px 10px; border-radius: 999px; background: rgba(255,255,255,0.05); font-size: 12px; font-weight: 700; color: #C6D6FF">Segera hadir</span>
      <h3 style="font-size: 18px; font-weight: 700">{title}</h3>
      <p style="font-size: 14px; line-height: 22px; color: #8A8A93; font-weight: 500; max-width: 240px">{body}</p>
    </article>'''
