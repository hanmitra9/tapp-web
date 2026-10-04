# Premium TAPP campaign content, drawn as 200x356 "video frames" (scaled for small tiles).
from parts import ICON, BLOB_WHITE, BLOB_MARK

W, H = 200, 356
CAPTION = 'font-weight: 600; color: #FFFFFF; letter-spacing: -0.3px; text-shadow: 0 2px 0 rgba(0,0,0,0.35), 0 6px 18px rgba(0,0,0,0.55)'
def hl(t, bg='#0C65C4', fg='#FFFFFF'):
    return f'<span style="display: inline-block; padding: 0 7px; border-radius: 7px; background: {bg}; color: {fg}; text-shadow: none; box-shadow: 0 6px 18px -4px {bg}">{t}</span>'
def grain():
    return '<div style="position: absolute; inset: 0; opacity: 0.18; mix-blend-mode: overlay; background-image: repeating-radial-gradient(circle at 20% 30%, rgba(255,255,255,0.5) 0 1px, transparent 1px 3px)"></div>'
def tile_mark(size, glow='#0C65C4'):
    return f'<span style="width: {size}px; height: {size}px; border-radius: {size*0.28:.0f}px; display: inline-flex; align-items: center; justify-content: center; background: linear-gradient(180deg, #4296F0, #104F92); border: 1px solid rgba(194,221,250,0.6); box-shadow: 0 0 0 {size*0.12:.0f}px rgba(12,101,196,0.16), 0 0 {size*0.8:.0f}px {glow}; flex-shrink: 0"><img src="{BLOB_WHITE}" alt="" style="width: {size*0.56:.0f}px; height: {size*0.56:.0f}px"></span>'

def quote(a='#4497F0', b='#07203C'):
    person = f'''<svg viewBox="0 0 200 180" width="200" height="180" aria-hidden="true" style="position: absolute; left: 0; bottom: 0">
      <defs><linearGradient id="rim{a[1:]}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="{a}" stop-opacity="0.9"></stop><stop offset="0.35" stop-color="#0B0B14"></stop></linearGradient></defs>
      <circle cx="96" cy="70" r="30" fill="#0B0B14" stroke="url(#rim{a[1:]})" stroke-width="3"></circle>
      <path d="M66 62 C 66 30, 126 30, 126 62" fill="none" stroke="#1A1A26" stroke-width="7"></path>
      <path d="M22 180 C 30 128, 60 108, 96 108 S 162 128, 170 180 Z" fill="#0B0B14" stroke="url(#rim{a[1:]})" stroke-width="3"></path>
      <rect x="138" y="84" width="16" height="30" rx="8" fill="#20202E" stroke="{a}" stroke-opacity="0.8"></rect><path d="M146 114 V150" stroke="#20202E" stroke-width="4"></path>
    </svg>'''
    return f'''<div style="position: absolute; inset: 0; background: radial-gradient(70% 55% at 20% 18%, {a}, transparent 70%), radial-gradient(60% 50% at 90% 80%, rgba(12,101,196,0.55), transparent 70%), linear-gradient(170deg, {b}, #07070D 80%)"></div>
    <div style="position: absolute; left: -30px; top: -40px; width: 180px; height: 300px; background: linear-gradient(160deg, rgba(255,255,255,0.22), transparent 60%); transform: rotate(18deg); filter: blur(6px)"></div>
    {person}
    <div style="position: absolute; left: 14px; right: 14px; top: 88px; display: flex; flex-direction: column; align-items: center; gap: 6px; text-align: center; {CAPTION}; font-size: 21px; line-height: 25px">
      <span>clip pertama gue</span><span>{hl('dibayar')} beneran</span>
    </div>
    <span style="position: absolute; left: 14px; top: 44px; padding: 3px 8px; border-radius: 6px; background: rgba(255,255,255,0.14); font-size: 10px; font-weight: 600; color: #FFFFFF; letter-spacing: 0.6px">PODCAST EP. 14</span>
    {grain()}'''

def reaction(a='#F97316', b='#431407'):
    return f'''<div style="position: absolute; inset: 0; background: radial-gradient(60% 45% at 50% 42%, {a}, transparent 72%), linear-gradient(180deg, #0A0A10, {b} 55%, #07070D)"></div>
    <div style="position: absolute; left: 50%; top: 40%; width: 260px; height: 260px; margin: -130px 0 0 -130px; border-radius: 50%; background: conic-gradient(from 200deg, transparent, rgba(255,255,255,0.18), transparent 30%, transparent 60%, rgba(255,255,255,0.12), transparent 80%)"></div>
    <div style="position: absolute; left: 50%; top: 40%; transform: translate(-50%, -50%)">{tile_mark(74, a)}</div>
    <div style="position: absolute; left: 10px; right: 36px; top: 214px; text-align: left; {CAPTION}; font-size: 24px; line-height: 27px">views<br>{hl('jadi cuan.', '#FFFFFF', '#0A0A0C')}</div>
    <span class="tabular" style="position: absolute; right: 12px; top: 44px; padding: 6px 9px; border-radius: 10px; background: rgba(0,0,0,0.45); border: 1px solid rgba(255,255,255,0.18); font-size: 12px; font-weight: 600; color: #7CF0B0; backdrop-filter: blur(6px)">+248%</span>
    {grain()}'''

def app_pov(a='#0C65C4', b='#0E447E'):
    return f'''<div style="position: absolute; inset: 0; background: radial-gradient(80% 50% at 50% 0%, {a}, transparent 70%), linear-gradient(180deg, {b}, #07070D 75%)"></div>
    <div style="position: absolute; left: 30%; top: -40px; width: 36px; height: 320px; background: linear-gradient(180deg, rgba(255,255,255,0.35), transparent); transform: rotate(22deg); filter: blur(8px)"></div>
    <div style="position: absolute; left: 60%; top: -40px; width: 18px; height: 280px; background: linear-gradient(180deg, rgba(255,255,255,0.25), transparent); transform: rotate(22deg); filter: blur(6px)"></div>
    <div style="position: absolute; left: 22px; right: 22px; top: 92px; padding: 10px; border-radius: 18px; background: #0B0B12; border: 1px solid rgba(255,255,255,0.14); box-shadow: 0 24px 50px -12px rgba(0,0,0,0.8), 0 0 40px rgba(12,101,196,0.45); transform: rotate(-4deg)">
      <div style="padding: 11px; border-radius: 12px; background: linear-gradient(45deg, #104F92, #0C65C4 55%, #75B2F4); display: flex; flex-direction: column; gap: 6px">
        <span style="display: flex; justify-content: space-between; align-items: center; font-size: 8px; font-weight: 500; color: rgba(255,255,255,0.85)">Total dibayar<img src="{BLOB_WHITE}" alt="" style="width: 12px; height: 12px"></span>
        <span class="tabular" style="font-size: 20px; font-weight: 600; color: #FFFFFF; letter-spacing: -0.5px">Rp555.000</span>
      </div>
      <svg viewBox="0 0 120 34" width="100%" height="34" aria-hidden="true" style="display: block; margin-top: 8px"><path d="M0 28 C 20 26, 30 18, 48 20 S 80 8, 96 9 S 114 3, 120 2" stroke="#75B2F4" stroke-width="2" fill="none"></path></svg>
      <span style="display: flex; align-items: center; justify-content: center; height: 22px; margin-top: 6px; border-radius: 7px; background: #0C65C4; font-size: 9px; font-weight: 600; color: #FFFFFF">Masuk rekening</span>
    </div>
    <div style="position: absolute; left: 10px; right: 36px; top: 244px; text-align: left; {CAPTION}; font-size: 18px; line-height: 23px">POV: bayaran clip<br>{hl('TAPP')} tiap pagi</div>
    {grain()}'''

def orbit(a='#0A6AD2', b='#08294D'):
    icons = ''.join(f'<span style="position: absolute; left: {x}px; top: {y}px; width: 34px; height: 34px; border-radius: 11px; background: rgba(12,12,20,0.85); border: 1px solid rgba(255,255,255,0.2); display: inline-flex; align-items: center; justify-content: center; color: #FFFFFF; box-shadow: 0 0 18px {a}">{ICON[k]}</span>' for k, x, y in [('tt', 22, 96), ('ig', 144, 70), ('yt', 128, 190)])
    return f'''<div style="position: absolute; inset: 0; background: radial-gradient(60% 45% at 50% 40%, {a}, transparent 72%), linear-gradient(180deg, {b}, #07070D 80%)"></div>
    <svg viewBox="0 0 200 356" width="200" height="356" aria-hidden="true" style="position: absolute; inset: 0"><g fill="none" stroke="#FFFFFF"><ellipse cx="100" cy="142" rx="86" ry="86" stroke-opacity="0.12"></ellipse><ellipse cx="100" cy="142" rx="58" ry="58" stroke-opacity="0.2"></ellipse><ellipse cx="100" cy="142" rx="86" ry="30" stroke-opacity="0.25" transform="rotate(-20 100 142)"></ellipse></g></svg>
    <div style="position: absolute; left: 50%; top: 142px; transform: translate(-50%, -50%)">{tile_mark(56, a)}</div>
    {icons}
    <div style="position: absolute; left: 10px; right: 36px; top: 250px; text-align: left; {CAPTION}; font-size: 20px; line-height: 24px">1 brief,<br>{hl('3 platform')}</div>
    {grain()}'''

def compare(a='#06B6D4', b='#083344'):
    return f'''<div style="position: absolute; inset: 0; background: radial-gradient(70% 50% at 80% 20%, {a}, transparent 70%), linear-gradient(180deg, {b}, #07070D 80%)"></div>
    <div class="tabular" style="position: absolute; left: 16px; right: 16px; top: 70px; display: flex; flex-direction: column; gap: 10px">
      <span style="font-size: 10px; font-weight: 600; letter-spacing: 0.6px; color: rgba(255,255,255,0.7)">VIEWS CLIP INI</span>
      <span style="font-size: 32px; line-height: 34px; font-weight: 600; color: #FFFFFF; letter-spacing: -1px">98.400</span>
      <span style="height: 10px; border-radius: 5px; background: rgba(255,255,255,0.15); overflow: hidden; display: flex"><i style="width: 79%; background: linear-gradient(90deg, #0C65C4, #75B2F4); box-shadow: 0 0 12px #75B2F4"></i></span>
      <span style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 600"><span style="color: #C2DDFA">78.000 lolos</span><span style="color: rgba(255,255,255,0.55)">20.400 bot</span></span>
    </div>
    <div style="position: absolute; left: 10px; right: 36px; top: 232px; text-align: left; {CAPTION}; font-size: 20px; line-height: 25px">yang dibayar cuma<br>{hl('views asli')}</div>
    {grain()}'''

def checklist(a='#F43F5E', b='#4C0519'):
    rows = ''.join(f'<span style="display: flex; align-items: center; gap: 8px; padding: 9px 10px; border-radius: 10px; background: rgba(10,10,16,0.7); border: 1px solid rgba(255,255,255,0.12); font-size: 11px; font-weight: 600; color: #FFFFFF"><i style="width: 16px; height: 16px; border-radius: 8px; background: #34D07A; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7"></path></svg></i>{t}</span>' for t in ['Format 9:16', 'Sesuai brief', 'Posting di akunmu', 'Submit max 48 jam'])
    return f'''<div style="position: absolute; inset: 0; background: radial-gradient(70% 50% at 15% 15%, {a}, transparent 70%), linear-gradient(180deg, {b}, #07070D 80%)"></div>
    <div style="position: absolute; left: 12px; right: 12px; top: 50px; {CAPTION}; font-size: 19px; line-height: 23px">4 cara clip<br>{hl('lolos review')}</div>
    <div style="position: absolute; left: 14px; right: 14px; top: 116px; display: flex; flex-direction: column; gap: 7px; transform: rotate(-2deg)">{rows}</div>
    {grain()}'''

SCENES = {'quote': quote, 'reaction': reaction, 'app': app_pov, 'orbit': orbit, 'compare': compare, 'check': checklist}

def scene(kind, a=None, b=None, scale=1.0):
    fn = SCENES[kind]
    inner = fn(a, b) if a else fn()
    return f'<div style="position: absolute; left: 0; top: 0; width: {W}px; height: {H}px; transform: scale({scale}); transform-origin: 0 0; overflow: hidden; font-family: inherit">{inner}</div>'
