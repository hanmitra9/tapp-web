import sys, pathlib
HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from parts import *
from hero2 import hero_creator_visual, hero_brand_visual
from hub import hero_hub, LEVELS, PORTFOLIO, TIER_CSS
from brandhub import hero_brand, steps_tabs
from footer import footer, CSS as FOOT_CSS
MENU_CSS = (HERE / 'menu.css').read_text()
GLOBE = open(HERE / 'globe.svg.frag').read()
BRAND_CONTACT = (pathlib.Path(__file__).parent / 'contact_cards.html').read_text()  # brand WhatsApp + email cards (shared with meeting.html)

def pill_btn(label, href, primary=True, big=False):
    h = '52px' if big else '46px'
    if primary:
        st = 'background: linear-gradient(180deg, #4C9CF1, #1565BA); border: 1px solid rgba(255,255,255,0.14); box-shadow: 0 8px 24px -14px rgba(12,101,196,0.9), inset 0 1px 0 rgba(255,255,255,0.2)'
    else:
        st = 'background: #111115; border: 1px solid rgba(255,255,255,0.1)'
    return f'<a class="{"btn-p" if primary else "btn-s"}" href="{href}" style="display: inline-flex; align-items: center; white-space: nowrap; flex-shrink: 0; height: {h}; padding: 0 22px; border-radius: 12px; font-weight: 500; font-size: 15px; {st}">{label}</a>'

def circuits(paths):
    base = ''.join(f'<path d="{d}" stroke="#0C65C4" stroke-width="6" opacity="0.5" filter="url(#cblur)"></path><path d="{d}" stroke="#75B2F4" stroke-width="1.6" opacity="0.9"></path>' for d in paths)
    pulses = ''.join(f'<path class="pulse" pathLength="100" style="animation-delay: -{i*1.3:.1f}s" d="{d}"></path>' for i, d in enumerate(paths))
    return f'<svg class="circ" viewBox="0 0 640 520" preserveAspectRatio="none" aria-hidden="true" style="position: absolute; inset: 0; width: 100%; height: 100%"><defs><filter id="cblur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3"></feGaussianBlur></filter></defs><g fill="none" stroke-linecap="round" stroke-linejoin="round">{base}{pulses}</g></svg>'

def fcard(style, inner):
    return f'<div class="fcard" style="position: absolute; {style}; padding: 16px 18px; border-radius: 18px; {FLOAT}; display: flex; align-items: center; gap: 14px">{inner}</div>'

spark = '<svg width="96" height="40" viewBox="0 0 96 40" aria-hidden="true"><defs><linearGradient id="spf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#75B2F4" stop-opacity="0.5"></stop><stop offset="1" stop-color="#75B2F4" stop-opacity="0"></stop></linearGradient></defs><path d="M2 34 C 18 30, 26 24, 38 26 S 60 14, 72 12 S 88 6, 94 4 L94 40 L2 40 Z" fill="url(#spf)"></path><path d="M2 34 C 18 30, 26 24, 38 26 S 60 14, 72 12 S 88 6, 94 4" stroke="#C2DDFA" stroke-width="2" fill="none"></path></svg>'
avatar = '<span style="width: 52px; height: 52px; border-radius: 14px; overflow: hidden; background: linear-gradient(160deg, #F2B28C, #C2703F); display: inline-flex; align-items: flex-end; justify-content: center; flex-shrink: 0"><svg width="44" height="46" viewBox="0 0 44 46" aria-hidden="true"><circle cx="22" cy="16" r="9" fill="#FBE3D1"></circle><path d="M8 17c0-10 6-15 14-15s14 5 14 15c-2-5-6-7-14-7S10 12 8 17z" fill="#2B1B14"></path><path d="M3 46c2-10 9-15 19-15s17 5 19 15z" fill="#1F2937"></path></svg></span>'
icon_tile = lambda path: f'<span style="width: 40px; height: 40px; border-radius: 12px; background: rgba(12,101,196,0.2); border: 1px solid rgba(117,178,244,0.35); display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C2DDFA" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{path}</svg></span>'
lbl = lambda t: f'<span style="font-size: 13px; font-weight: 500; color: #A1A1AA">{t}</span>'
val = lambda t, extra='': f'<span class="tabular" style="font-size: 24px; line-height: 28px; font-weight: 600{extra}">{t}</span>'
cap = lambda t: f'<span style="font-size: 12px; font-weight: 500; color: #8A8A93">{t}</span>'
col = lambda *xs: '<span style="display: flex; flex-direction: column; gap: 2px">' + ''.join(xs) + '</span>'

HERO_C = f'''<div class="hero pad" style="position: relative; display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr); gap: 32px; align-items: center; max-width: 1280px; margin: 0 auto; padding: 56px 64px 40px">
  {hero_creator_visual()}
  <div style="display: flex; flex-direction: column; gap: 22px; align-items: flex-end; text-align: right">
    <h1 class="hero-h" style="font-size: 76px; line-height: 78px; font-weight: 600; letter-spacing: -2.6px; white-space: nowrap">Clip Kamu, <br><span style="color: #75B2F4">Bayaran Nyata</span></h1>
    <p style="font-size: 20px; line-height: 30px; color: #A1A1AA; font-weight: 400; max-width: 420px">Dibayar dari views yang lolos verifikasi.</p>
    <div style="display: flex; gap: 12px; flex-wrap: wrap; justify-content: flex-end">{pill_btn("Daftar Gratis", "#app:/register", True, True)}{pill_btn("Lihat Campaign", "campaigns.html", False, True)}</div>
  </div>
</div>'''

HERO_B = f'''<div class="hero pad" style="position: relative; display: grid; grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.15fr); gap: 32px; align-items: center; max-width: 1280px; margin: 0 auto; padding: 56px 64px 40px">
  <div style="display: flex; flex-direction: column; gap: 22px; align-items: flex-start">
    <h1 class="hero-h" style="font-size: 76px; line-height: 78px; font-weight: 600; letter-spacing: -2.6px; white-space: nowrap">Satu Brief, <br><span style="color: #75B2F4">Ribuan Creator</span></h1>
    <p style="font-size: 20px; line-height: 30px; color: #A1A1AA; font-weight: 400; max-width: 420px">Bayar hanya untuk views yang lolos verifikasi.</p>
    <div style="display: flex; gap: 12px; flex-wrap: wrap">{pill_btn("Hubungi Tim TAPP", "#mail", True, True)}{pill_btn("Cara Kerja", "#alur", False, True)}</div>
  </div>
  {hero_brand_visual()}
</div>'''

STEPS_C = [
  ('Buat Akun', 'Daftar gratis dalam satu menit. Akun baru dan akun besar dinilai dengan cara yang sama: dari hasil.',
   '<span style="font-size: 13px; font-weight: 600">Daftar Akun</span><span style="font-size: 12px; color: #8A8A93; font-weight: 500">Nama lengkap</span><span class="inp">Rani Putri</span><span style="font-size: 12px; color: #8A8A93; font-weight: 500">Email</span><span class="inp">rani@email.com</span><span class="btnm">Daftar Sekarang</span>'),
  ('Hubungkan Akun Sosial', 'Sambungkan TikTok, Instagram, atau YouTube. Kami pastikan akunnya memang milikmu.',
   '<span style="font-size: 13px; font-weight: 600">Hubungkan Akun</span>'
   + ''.join(f'<span class="row"><span style="display: flex; align-items: center; gap: 10px"><span style="color: #D4D4D8; display: inline-flex">{ICON[k]}</span><span style="display: flex; flex-direction: column"><b style="font-size: 13px">{n}</b><span style="font-size: 11px; color: #8A8A93; font-weight: 500">{h}</span></span></span><span style="{st}">{t}</span></span>'
             for k, n, h, t, st in [('tt', 'TikTok', '@rani.clips', 'Terhubung', 'font-size: 11px; font-weight: 600; color: #34D07A; background: rgba(52,208,122,0.14); padding: 4px 9px; border-radius: 999px'),
                                     ('ig', 'Instagram', 'Belum terhubung', 'Hubungkan', 'font-size: 11px; font-weight: 600; color: #C2DDFA; background: rgba(12,101,196,0.2); padding: 4px 9px; border-radius: 999px'),
                                     ('yt', 'YouTube', 'Belum terhubung', 'Hubungkan', 'font-size: 11px; font-weight: 600; color: #C2DDFA; background: rgba(12,101,196,0.2); padding: 4px 9px; border-radius: 999px')])),
  ('Ambil Campaign', 'Pilih brief yang paling cocok dengan gaya kontenmu. Materi sumber langsung terbuka setelah kamu bergabung.',
   f'<span style="display: flex; align-items: center; justify-content: space-between"><span style="display: flex; align-items: center; gap: 8px; font-weight: 600; font-size: 13px"><i style="font-style: normal; width: 22px; height: 22px; border-radius: 7px; background: linear-gradient(180deg, #4296F0, #104F92); display: inline-flex; align-items: center; justify-content: center"><img src="{BLOB_WHITE}" alt="" style="width: 13px; height: 13px"></i>TAPP</span><span style="font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 6px; background: rgba(255,255,255,0.06)">Clipping</span></span><b style="font-size: 16px">TAPP Mega Campaign</b><span class="tabular"><b style="font-size: 18px">Rp3.000</b><span style="font-size: 12px; color: #8A8A93; font-weight: 500"> /1K Views</span></span><span class="tabular" style="display: flex; justify-content: space-between; font-size: 12px; font-weight: 500; color: #9A9AA5"><span>Minimal klaim</span><span style="color: #FFF">5.000 views</span></span><span class="tabular" style="display: flex; justify-content: space-between; font-size: 12px; font-weight: 500; color: #9A9AA5"><span>Maks. per clip</span><span style="color: #FFF">100K views</span></span><span style="height: 6px; border-radius: 3px; background: #1F1F26; display: block"><span style="display: block; width: 62%; height: 6px; border-radius: 3px; background: linear-gradient(90deg, #0C65C4, #75B2F4)"></span></span>'),
  ('Posting &amp; Dibayar', 'Kirim link postingan. Begitu clip-mu diterima, bayarannya langsung ditransfer ke rekeningmu.',
   '<span style="font-size: 13px; font-weight: 600">Submit Clip</span><span style="font-size: 12px; color: #8A8A93; font-weight: 500">Link postingan</span><span class="inp" style="border-color: #0C65C4; box-shadow: 0 0 16px rgba(12,101,196,0.35)">tiktok.com/@rani.clips/video/7412</span><span class="btnm">Kirim untuk direview</span><span style="display: flex; align-items: center; gap: 8px"><span style="font-size: 11px; font-weight: 600; padding: 4px 9px; border-radius: 999px; background: rgba(255,176,32,0.14); color: #FFB020">Direview</span><span style="font-size: 11px; font-weight: 600; padding: 4px 9px; border-radius: 999px; background: rgba(52,208,122,0.14); color: #34D07A">Lolos</span><span class="tabular" style="margin-left: auto; font-weight: 600; color: #34D07A">Rp234.000</span></span>'),
]
def step_card(i, t):
    title, body, mock = t
    return f'''<div style="border-radius: 18px; padding: 22px; {CARD}; display: flex; flex-direction: column; gap: 20px">
      <div class="mock" style="position: relative; padding: 18px; border-radius: 18px; background: radial-gradient(90% 90% at 50% 0%, rgba(12,101,196,0.22), transparent 70%), #0A0A0E; border: 1px solid rgba(117,178,244,0.18); display: flex; flex-direction: column; gap: 9px; min-height: 250px">{mock}</div>
      <div style="display: flex; justify-content: space-between; gap: 16px; align-items: flex-start">
        <div style="display: flex; flex-direction: column; gap: 8px"><h3 style="font-size: 20px; font-weight: 600">{title}</h3><p style="font-size: 15px; line-height: 23px; color: #9A9AA5; font-weight: 400">{body}</p></div>
        <span class="tabular" style="width: 30px; height: 30px; flex-shrink: 0; border-radius: 15px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 600">{i+1}</span>
      </div>
    </div>'''

AV_STACK = ''.join(f'<i style="font-style: normal; width: 28px; height: 28px; border-radius: 14px; margin-left: {0 if k==0 else -8}px; font-size: 10px; background: {c}; border: 2px solid #07070A; display: inline-flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 600; ">{n}</i>'
                   for k, (n, c) in enumerate([('RP', '#34D07A'), ('DP', '#F2692B'), ('NK', '#1461B3'), ('BS', '#0A6AD2'), ('SW', '#E2445C'), ('AL', '#F0B429')]))

def tile(inner, blue=False):
    st = 'background: linear-gradient(180deg, #4296F0, #104F92); border: 1px solid rgba(194,221,250,0.55); box-shadow: 0 0 0 8px rgba(12,101,196,0.12), 0 0 44px rgba(12,101,196,0.75)' if blue else 'background: linear-gradient(180deg, #17171D, #0D0D12); border: 1px solid rgba(117,178,244,0.35); box-shadow: 0 0 30px rgba(12,101,196,0.25)'
    return f'<span style="width: 76px; height: 76px; border-radius: 18px; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; {st}">{inner}</span>'
store = '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#C2DDFA" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9l1.5-4h13L20 9"></path><path d="M4 9v10h16V9"></path><path d="M4 9a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0A2.7 2.7 0 0 0 20 9"></path></svg>'
white_mark = lambda sz: f'<img src="{BLOB_WHITE}" alt="" style="width: {sz}px; height: {sz}px">'
VIS_B = [
  f'<div style="display: flex; align-items: center; justify-content: center; gap: 0">{tile(store)}<i style="width: 120px; height: 2px; background: linear-gradient(90deg, rgba(117,178,244,0.2), #75B2F4, rgba(117,178,244,0.2)); box-shadow: 0 0 12px rgba(117,178,244,0.8)"></i>{tile(white_mark(38), True)}</div>',
  f'<div style="position: relative; overflow: hidden; width: 300px; padding: 22px 24px; border-radius: 20px; background: linear-gradient(135deg, #072240, #0D0D16); border: 1px solid rgba(117,178,244,0.35); box-shadow: 0 20px 60px -20px rgba(12,101,196,0.7); display: flex; flex-direction: column; gap: 10px"><span style="font-size: 13px; font-weight: 500; color: #A1A1AA">Budget campaign</span><span class="tabular" style="font-size: 30px; font-weight: 600; letter-spacing: -0.6px">Rp24.500.000</span><span style="font-size: 12px; font-weight: 500; color: #8A8A93">Terkunci saat campaign disetujui</span><img src="{BLOB_WHITE}" alt="" style="position: absolute; right: -14px; top: -10px; width: 110px; height: 110px; opacity: 0.08"></div>',
  '''<svg viewBox="0 0 400 180" width="100%" style="max-width: 420px" role="img" aria-label="Brief masuk ke TAPP, dikerjakan creator, lalu diposting di TikTok, Instagram, dan YouTube">
      <g fill="none" stroke="#75B2F4" stroke-width="1.6" stroke-opacity="0.7"><path d="M62 90 H130"></path><path d="M190 90 C 220 90, 220 40, 250 40"></path><path d="M190 90 H250"></path><path d="M190 90 C 220 90, 220 140, 250 140"></path><path d="M290 40 H336"></path><path d="M290 90 H336"></path><path d="M290 140 H336"></path></g>
      <rect x="18" y="68" width="44" height="44" rx="12" fill="#15151C" stroke="#75B2F4" stroke-opacity="0.5"></rect><path d="M32 80h10l6 6v16H32z M42 80v6h6" fill="none" stroke="#C2DDFA" stroke-width="1.8" stroke-linejoin="round"></path>
      <rect x="130" y="60" width="60" height="60" rx="16" fill="#0C65C4" stroke="#C2DDFA" stroke-opacity="0.6"></rect><image href="@@WHITE@@" x="145" y="75" width="30" height="30"></image>
      <circle cx="270" cy="40" r="17" fill="#34D07A"></circle><text x="270" y="44" text-anchor="middle" font-size="11" font-weight="600" fill="#FFFFFF">RP</text>
      <circle cx="270" cy="90" r="17" fill="#F2692B"></circle><text x="270" y="94" text-anchor="middle" font-size="11" font-weight="600" fill="#FFFFFF">DP</text>
      <circle cx="270" cy="140" r="17" fill="#1461B3"></circle><text x="270" y="144" text-anchor="middle" font-size="11" font-weight="600" fill="#FFFFFF">NK</text>
      <rect x="336" y="26" width="28" height="28" rx="8" fill="#15151C" stroke="#75B2F4" stroke-opacity="0.4"></rect><rect x="336" y="76" width="28" height="28" rx="8" fill="#15151C" stroke="#75B2F4" stroke-opacity="0.4"></rect><rect x="336" y="126" width="28" height="28" rx="8" fill="#15151C" stroke="#75B2F4" stroke-opacity="0.4"></rect>
      <g transform="translate(343 33) scale(0.58)" fill="#FFFFFF"><path d="M16.6 5.8A4.3 4.3 0 0 1 15 3.2h-2.7v11.6a2.3 2.3 0 1 1-2.4-2.3c.2 0 .5 0 .7.1V9.8a5.1 5.1 0 1 0 4.4 5V9.2c1 .7 2.2 1.1 3.5 1.1V7.6c-.8 0-1.6-.3-2.3-.8z"></path></g>
      <g transform="translate(343 83) scale(0.58)" fill="none" stroke="#FFFFFF" stroke-width="2.4"><rect x="3.5" y="3.5" width="17" height="17" rx="5"></rect><circle cx="12" cy="12" r="4"></circle></g>
      <g transform="translate(343 133) scale(0.58)" fill="#FFFFFF"><path d="M21.6 7.2a2.6 2.6 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.6 2.6 0 0 0 2.4 7.2 27 27 0 0 0 2 12a27 27 0 0 0 .4 4.8 2.6 2.6 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.6 2.6 0 0 0 1.8-1.8A27 27 0 0 0 22 12a27 27 0 0 0-.4-4.8zM10 15V9l5.2 3z"></path></g>
    </svg>'''.replace('@@WHITE@@', BLOB_WHITE),
  '''<div style="width: 330px; padding: 18px; border-radius: 18px; background: #0A0A0E; border: 1px solid rgba(117,178,244,0.25); display: flex; flex-direction: column; gap: 12px">
      <div class="tabular" style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px">
        <span style="display: flex; flex-direction: column; gap: 2px; padding: 10px; border-radius: 10px; background: #15151B"><span style="font-size: 11px; color: #8A8A93; font-weight: 500">Views</span><b style="font-size: 16px">1,3 jt</b></span>
        <span style="display: flex; flex-direction: column; gap: 2px; padding: 10px; border-radius: 10px; background: #15151B"><span style="font-size: 11px; color: #8A8A93; font-weight: 500">Qualified</span><b style="font-size: 16px">1,1 jt</b></span>
        <span style="display: flex; flex-direction: column; gap: 2px; padding: 10px; border-radius: 10px; background: #15151B"><span style="font-size: 11px; color: #8A8A93; font-weight: 500">CPV</span><b style="font-size: 16px; color: #34D07A">Rp3,00</b></span>
      </div>
      <svg viewBox="0 0 300 90" width="100%" height="90" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="rpf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0C65C4" stop-opacity="0.55"></stop><stop offset="1" stop-color="#0C65C4" stop-opacity="0"></stop></linearGradient></defs><path d="M0 76 C 30 70, 50 60, 80 62 S 130 48, 160 44 S 220 24, 250 22 S 290 10, 300 6 L300 90 L0 90 Z" fill="url(#rpf)"></path><path d="M0 76 C 30 70, 50 60, 80 62 S 130 48, 160 44 S 220 24, 250 22 S 290 10, 300 6" stroke="#75B2F4" stroke-width="2.4" fill="none"></path></svg>
      <div style="display: flex; justify-content: space-between; font-size: 10px; font-weight: 500; color: #6E6E78"><span>Sen</span><span>Sel</span><span>Rab</span><span>Kam</span><span>Jum</span><span>Sab</span><span>Min</span></div>
    </div>''',
]
STEPS_B = [
  ('Hubungi &amp; Verifikasi', 'Ceritakan brand dan tujuanmu. Tim TAPP memverifikasi brand lebih dulu supaya creator tahu campaign-mu terpercaya.'),
  ('Susun Brief &amp; Budget', 'Bersama account manager: brief, platform, tarif per 1.000 views, dan budget. Budget dikunci saat campaign disetujui.'),
  ('Creator Bekerja &amp; Posting', 'Creator yang cocok dari platform dan rekam jejak bergabung, membuat clip, lalu posting di akun mereka.'),
  ('Pantau &amp; Terima Laporan', 'Lihat views mentah dibanding qualified, biaya per view, dan performa tiap creator. Sisa budget kembali saat campaign selesai.'),
]
def brand_row(i):
    t, b = STEPS_B[i]
    return f'''<div class="brow" style="display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 32px; align-items: center; padding: 30px 36px; border-radius: 18px; background: radial-gradient(60% 120% at 85% 50%, rgba(12,101,196,0.22), transparent 70%), linear-gradient(180deg, #131318, #0C0C10); border: 1px solid rgba(255,255,255,0.08)">
      <div style="display: flex; flex-direction: column; gap: 10px; max-width: 440px">
        <span class="tabular" style="width: 30px; height: 30px; border-radius: 15px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 600">{i+1}</span>
        <h3 style="font-size: 22px; font-weight: 600">{t}</h3>
        <p style="font-size: 15px; line-height: 24px; color: #9A9AA5; font-weight: 400">{b}</p>
      </div>
      <div style="display: flex; align-items: center; justify-content: center; min-height: 190px">{VIS_B[i]}</div>
    </div>'''

def faq_block(pill, l1, l2, btn, href, listname):
    return f'''<section id="faq" class="sec pad" style="max-width: 1280px; margin: 0 auto; padding: 72px 64px 96px">
  <div class="faq2" style="display: grid; grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr); gap: 48px; align-items: start">
    <div style="display: flex; flex-direction: column; gap: 18px; align-items: flex-start">
      <span class="eyebrow">{pill}</span>
      <h2 class="h2" style="font-size: 46px; line-height: 52px; font-weight: 600; letter-spacing: -1.5px">{l1} <br><span style="color: #75B2F4">{l2}</span></h2>
      {pill_btn(btn, href)}
    </div>
    <div style="display: flex; flex-direction: column; gap: 10px">
      <sc-for list="{{{{{listname}}}}}" as="f" hint-placeholder-count="6">
        <div style="{{{{f.box}}}}">
          <button onClick="{{{{f.toggle}}}}" aria-expanded="{{{{f.open}}}}" style="width: 100%; display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 20px 22px; background: transparent; border: 0; color: #FFFFFF; font-weight: 600; font-size: 17px; text-align: left">
            <span>{{{{f.q}}}}</span><span style="{{{{f.sign}}}}">{{{{f.signText}}}}</span>
          </button>
          <sc-if value="{{{{f.open}}}}" hint-placeholder-val="{{{{ false }}}}"><p style="padding: 0 22px 22px; font-size: 15px; line-height: 25px; color: #A1A1AA; font-weight: 400">{{{{f.a}}}}</p></sc-if>
        </div>
      </sc-for>
    </div>
  </div>
</section>'''

FOOTER = footer(BLOB_MARK).replace('class="tf"', 'class="tf pad"')
WALL = open(HERE / 'wall.html').read()
FX3 = open(HERE / 'fx3.html').read()
JS = open(HERE / 'logic.js').read()

page = f'''<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<title>TAPP — Landing page</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link rel="preload" href="assets/fonts/Geist-Variable.woff2" as="font" type="font/woff2" crossorigin>
<style>
@font-face{{font-family:'Geist';src:url('assets/fonts/Geist-Variable.woff2') format('woff2');font-weight:100 900;font-style:normal;font-display:swap}}
@font-face{{font-family:'InterTight';src:url('assets/fonts/InterTight-Variable.woff2') format('woff2');font-weight:100 900;font-style:normal;font-display:swap}}
.lp h1,.lp h2,.lp .hero-h,.lp .h2{{font-family:'InterTight','Geist',system-ui,sans-serif;font-weight:500 !important;letter-spacing:-0.01em !important}}
body{{margin:0;background:#060608;color:#F4F4F5;font-family:'Geist',system-ui,-apple-system,'Segoe UI',sans-serif;font-weight:400;-webkit-font-smoothing:antialiased}}
a{{color:inherit;text-decoration:none}}
.lp *{{box-sizing:border-box}}
.lp h1,.lp h2,.lp h3,.lp p{{margin:0}}
.lp .tabular{{font-variant-numeric:tabular-nums}}
.lp b,.lp strong{{font-weight:500}}
.lp h1,.lp h2{{font-weight:500 !important;letter-spacing:-0.035em !important}}
.lp h3{{font-weight:500 !important;letter-spacing:-0.015em}}
.lp ::selection{{background:rgba(12,101,196,0.45)}}
.lp button{{font:inherit;cursor:pointer}}
.lp :focus-visible{{outline:2px solid #75B2F4;outline-offset:3px;border-radius:12px}}
.lp .btn-p{{transition:filter .15s}} .lp .btn-p:hover{{filter:brightness(1.12)}}
.lp .btn-s{{transition:background .15s}} .lp .btn-s:hover{{background:rgba(255,255,255,0.1)}}
.lp .nl{{color:#A1A1AA;transition:color .15s}} .lp .nl:hover{{color:#FFFFFF}}
.lp .ccard{{transition:transform .25s ease,box-shadow .25s ease}}
.lp .ccard:hover{{transform:translateY(-6px);box-shadow:0 30px 70px -30px rgba(12,101,196,0.7),0 0 0 1px rgba(117,178,244,0.3)}}
.lp .mock .inp{{display:flex;align-items:center;height:38px;padding:0 12px;border-radius:10px;background:#15151B;border:1px solid rgba(255,255,255,0.08);font-size:13px;font-weight: 500;color:#D4D4D8}}
.lp .mock .btnm{{display:flex;align-items:center;justify-content:center;height:40px;border-radius:10px;background:linear-gradient(180deg,#4296F0,#12569F);font-size:13px;font-weight: 600;margin-top:4px}}
.lp .mock .row{{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-radius:12px;background:#15151B;border:1px solid rgba(255,255,255,0.06)}}
.lp .comet{{stroke:#75B2F4;stroke-width:2;stroke-dasharray:16 84;opacity:.55;animation:comet 4.4s cubic-bezier(.45,0,.25,1) infinite}}.lp .comet-h{{stroke:#FFFFFF;stroke-width:2.6;stroke-dasharray:2.5 97.5;filter:drop-shadow(0 0 5px #94C3F6);animation:cometh 4.4s cubic-bezier(.45,0,.25,1) infinite}}@keyframes comet{{from{{stroke-dashoffset:116}}to{{stroke-dashoffset:0}}}}@keyframes cometh{{from{{stroke-dashoffset:102.5}}to{{stroke-dashoffset:-13.5}}}}.lp .orb{{transform-origin:600px 180px;animation:spin 22s linear infinite}} .lp .orb2{{animation-duration:15s;animation-direction:reverse}}
.lp .fan .t{{position:absolute;left:50%;top:50%;transition:transform .45s cubic-bezier(.2,.8,.2,1)}}
.lp .fan .t1{{transform:translate(-50%,-50%) translateX(-175px) translateY(20px) rotate(-12deg)}}
.lp .fan .t3{{transform:translate(-50%,-50%) translateX(175px) translateY(20px) rotate(12deg)}}
.lp .fan .t2{{transform:translate(-50%,-52%);z-index:2}}
.lp .fan:hover .t1{{transform:translate(-50%,-50%) translateX(-225px) translateY(30px) rotate(-16deg)}}
.lp .fan:hover .t3{{transform:translate(-50%,-50%) translateX(225px) translateY(30px) rotate(16deg)}}
.lp .fan:hover .t2{{transform:translate(-50%,-55%) scale(1.03)}}
.lp .bt{{transition:transform .3s ease,filter .3s ease;filter:saturate(.85) brightness(.8)}}
.lp .bt:hover{{transform:translateY(-6px) scale(1.05);filter:none}}
.lp .mqr{{overflow:hidden;-webkit-mask-image:linear-gradient(90deg,transparent 0,#000 10%,#000 90%,transparent 100%);mask-image:linear-gradient(90deg,transparent 0,#000 10%,#000 90%,transparent 100%)}}
.lp .mqr.mid{{-webkit-mask-image:linear-gradient(90deg,transparent 0,#000 8%,#000 calc(50% - 170px),transparent calc(50% - 90px),transparent calc(50% + 90px),#000 calc(50% + 170px),#000 92%,transparent 100%);mask-image:linear-gradient(90deg,transparent 0,#000 8%,#000 calc(50% - 170px),transparent calc(50% - 90px),transparent calc(50% + 90px),#000 calc(50% + 170px),#000 92%,transparent 100%)}}
.lp .mqt{{display:flex;gap:14px;width:max-content;animation:mqx 90s linear infinite}}
.lp .mqr.rev .mqt{{animation-direction:reverse}} .lp .mqr:hover .mqt{{animation-play-state:paused}}
@keyframes mqx{{from{{transform:translateX(0)}}to{{transform:translateX(-50%)}}}}
.lp .sweep{{position:absolute;inset:0;border-radius:50%;background:conic-gradient(from 0deg,rgba(151,197,247,0.55),rgba(151,197,247,0) 28%,transparent);animation:spin 5s linear infinite}}
.lp .blip{{animation:blip 5s ease-in-out infinite}}
@keyframes spin{{to{{transform:rotate(360deg)}}}}
@keyframes blip{{0%,55%{{opacity:0.25}}62%,90%{{opacity:1}}100%{{opacity:0.25}}}}

.lp .tchip{{padding:6px 11px;border-radius:999px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);font-size:12px;font-weight: 600;color:#D4D4D8}}
{TIER_CSS}

.lp .hub{{animation:hubglow 3.2s ease-in-out infinite}}
@keyframes hubglow{{0%,100%{{box-shadow:0 0 0 8px rgba(12,101,196,0.1),0 0 60px rgba(12,101,196,0.45),inset 0 1px 0 rgba(255,255,255,0.3)}}50%{{box-shadow:0 0 0 10px rgba(12,101,196,0.13),0 0 80px rgba(12,101,196,0.6),inset 0 1px 0 rgba(255,255,255,0.3)}}}}
.lp .hc{{animation:bob 6s ease-in-out infinite}} .lp .hc:nth-of-type(2){{animation-delay:-1.5s}} .lp .hc:nth-of-type(3){{animation-delay:-3s}} .lp .hc:nth-of-type(4){{animation-delay:-4.5s}}
@keyframes bob{{0%,100%{{transform:translateY(0)}}50%{{transform:translateY(-6px)}}}}
@media (max-width: 1240px){{ .lp .hstage{{transform:scale(0.82);transform-origin:center top}} .lp .hstage-wrap{{height:330px !important}} }}
@media (min-width: 600px) and (max-width: 900px){{ .lp .hstage-wrap .hstage{{transform:scale(0.66) !important}} .lp .hero2 .hstage-wrap{{height:270px !important}} }}
@media (max-width: 1240px){{ .lp .bpanel{{gap:20px !important}} }}

/* premium layer: layered black, gradient accents, grain */
.lp{{background:radial-gradient(1100px 620px at 50% -6%,rgba(9,110,218,0.20),rgba(12,101,196,0.05) 45%,transparent 70%),radial-gradient(800px 700px at 100% 38%,rgba(12,101,196,0.07),transparent 65%),radial-gradient(800px 700px at 0% 72%,rgba(13,98,188,0.06),transparent 65%),linear-gradient(180deg,#0B0B12 0%,#07070A 22%,#050507 60%,#08080D 100%) !important}}
.lp::after{{content:'';position:fixed;inset:0;pointer-events:none;z-index:60;opacity:.045;mix-blend-mode:overlay;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .55 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")}}
.lp h1 span[style*="#75B2F4"],.lp h2 span[style*="#75B2F4"]{{background:linear-gradient(96deg,#E2EFFD 0%,#A4CCF8 32%,#54A0F1 68%,#0E64C0 100%);-webkit-background-clip:text;background-clip:text;color:transparent !important;padding-bottom:.06em}}
.lp .sec{{position:relative}}
.lp .btn-p{{background:linear-gradient(180deg,#55A0F1 0%,#0C65C4 50%,#104F92 100%) !important;border:1px solid rgba(194,221,250,0.28) !important;box-shadow:0 10px 30px -14px rgba(12,101,196,0.9),inset 0 1px 0 rgba(255,255,255,0.28),inset 0 -1px 0 rgba(0,0,0,0.25) !important}}
.lp .btn-s{{background:linear-gradient(180deg,#16161D,#0D0D12) !important;border:1px solid rgba(255,255,255,0.1) !important}}
.lp .ccard,.lp .pdash,.lp .bsim > div{{position:relative}}
.lp .gb{{position:relative}}
.lp .hc > div,.lp .hm > div{{position:relative}}
.lp .gb::before,.lp .ccard::before,.lp .pdash::before,.lp .hc > div::before,.lp .hm > div::before,.lp .bsim > div::before{{content:'';position:absolute;inset:0;border-radius:inherit;padding:1px;background:linear-gradient(160deg,rgba(194,221,250,0.35),rgba(101,169,242,0.08) 35%,rgba(255,255,255,0.02) 60%,rgba(101,169,242,0.2));-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;pointer-events:none}}
.lp .hstage-m{{display:none}}
.lp .orbm{{transform-origin:180px 300px;animation:spin 18s linear infinite}}
@media (max-width: 600px){{ .lp .hero2{{display:flex;flex-direction:column}} .lp .hero2 > .hcopy{{order:-1;margin:64px 0 36px !important}} .lp .hero2 .bwbg{{top:0 !important}} .lp .hero2 .hcopy p{{font-size:16px !important;line-height:26px !important;max-width:340px !important}} }}
@media (max-width: 600px){{ .lp .hero2 .hstage-wrap{{display:none !important}} .lp .hero2 .hstage-m{{display:block;overflow:hidden;padding:4px 0 8px}} .lp .hero2 .hm{{display:none !important}} }}
@media (max-width: 370px){{ .lp .hstage-m-in{{transform:scale(0.88);transform-origin:top center;margin-bottom:-72px !important}} }}
.lp .cglow,.lp .ccard.cglow{{box-shadow:0 0 0 1px rgba(85,160,241,0.22),0 0 36px -4px rgba(12,101,196,0.45),0 30px 80px -28px rgba(12,101,196,0.65) !important}}
/* ---- polish v2 ---- */
.lp .eyebrow{{display:inline-flex;font-size:13px;font-weight:500;color:#75B2F4;letter-spacing:0.02em}}
.lp .navwrap{{pointer-events:none}}
.lp .navbar{{pointer-events:auto;border-radius:18px;background:rgba(12,12,17,0.62);-webkit-backdrop-filter:blur(18px) saturate(1.4);backdrop-filter:blur(18px) saturate(1.4);border:1px solid rgba(255,255,255,0.07);box-shadow:0 18px 50px -24px rgba(0,0,0,0.9),inset 0 1px 0 rgba(255,255,255,0.06)}}
.lp .navbar .btn-p{{height:42px !important;padding:0 18px !important;font-size:14px !important;border-radius:11px !important}}
.lp .nlinks .nl{{position:relative;padding:6px 0}}
.lp .nlinks .nl::after{{content:'';position:absolute;left:0;right:0;bottom:0;height:1px;background:linear-gradient(90deg,transparent,#54A0F1,transparent);opacity:0;transition:opacity .2s}}
.lp .nlinks .nl:hover::after{{opacity:1}}
.lp .sec p{{text-wrap:pretty}}
.lp .btn-p,.lp .btn-s{{transition:transform .2s ease,filter .2s ease,box-shadow .2s ease !important}}
.lp .btn-p:hover{{transform:translateY(-1px);filter:brightness(1.1)}}
.lp .btn-s:hover{{transform:translateY(-1px);border-color:rgba(255,255,255,0.18) !important}}
.lp .ccard{{border-radius:22px !important}}
.lp .dbtn{{color:#E2EFFD;background:rgba(14,15,22,0.7);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);border:1px solid rgba(101,169,242,0.25);box-shadow:0 14px 34px -16px rgba(0,0,0,0.9),0 0 24px -10px rgba(12,101,196,0.6),inset 0 1px 0 rgba(255,255,255,0.06);transition:transform .2s,border-color .2s}}
.lp .dbtn svg{{color:#75B2F4}}
.lp .dbtn:hover{{transform:translateY(-2px);border-color:rgba(117,178,244,0.5)}}
.lp .sitefoot::before{{content:'';position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,rgba(101,169,242,0.35) 30%,rgba(101,169,242,0.35) 70%,transparent)}}
.lp .sitefoot .fh{{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#6E7690;margin-bottom:6px}}
.lp .sitefoot .nl{{color:#B4B4BE}}
.lp #faq button{{transition:color .2s}}
.lp #faq button:hover{{color:#C2DDFA}}
@media (max-width: 900px){{
  .lp .navwrap{{padding:10px 12px 0 !important}}
  .lp .navbar{{height:56px !important;padding:0 8px 0 14px !important;gap:12px !important}}
  .lp .dbtn{{right:16px;bottom:16px;height:44px;padding:0 13px}}
}}
.lp .jn{{display:flex;align-items:center;gap:10px;font-size:13px;color:#A1A1AA;font-weight:500}}
.lp .jn-av{{display:inline-flex}}
.lp .jn-av i{{font-style:normal;width:26px;height:26px;margin-left:-8px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:600;color:#E2EFFD;background:radial-gradient(circle at 30% 25%,#08284B,#030D18 70%);border:1.5px solid #0B0B10;box-shadow:0 0 0 1px rgba(117,178,244,0.25)}}
.lp .jn-av i:first-child{{margin-left:0}} .lp .jn-av i.more{{background:#15161D;color:#A4CCF8;font-size:9.5px}}
.lp .jn-t b{{color:#FFFFFF;font-weight:600}}
.lp .bsl{{position:relative;height:78px;margin-top:4px;border-radius:12px}}
.lp .bsl-bars{{position:absolute;left:0;right:0;bottom:4px;height:60px;display:flex;align-items:flex-end;gap:3px}}
.lp .bsl-bars i{{flex:1;min-width:0;border-radius:3px 3px 1px 1px;background:rgba(255,255,255,0.08);transition:background .18s ease,box-shadow .18s ease}}
.lp .bsl-bars i.on{{background:linear-gradient(180deg,#A4CCF8 0%,#54A0F1 45%,#0C65C4 100%);box-shadow:0 0 14px -3px rgba(12,101,196,0.9)}}
.lp .bsl-mark{{position:absolute;top:0;bottom:0;left:var(--p);width:2px;margin-left:-1px;background:linear-gradient(180deg,#FFFFFF 0%,rgba(194,221,250,0.7) 30%,rgba(117,178,244,0) 100%);box-shadow:0 0 14px rgba(117,178,244,0.9);pointer-events:none}}
.lp .bsl-mark b{{position:absolute;top:-2px;left:50%;width:16px;height:16px;margin-left:-8px;border-radius:50%;background:#FFFFFF;border:4px solid #0C65C4;box-shadow:0 0 0 5px rgba(12,101,196,0.22),0 0 18px rgba(117,178,244,0.9)}}
.lp .bsl{{touch-action:pan-y;cursor:ew-resize;user-select:none;-webkit-user-select:none}}
.lp .bslider{{position:absolute;inset:0;width:100%;height:100%;margin:0;opacity:0;pointer-events:none}}
.lp .bsl:has(.bslider:focus-visible){{box-shadow:0 0 0 2px rgba(117,178,244,0.45)}}
{FOOT_CSS}
{MENU_CSS}
@media (prefers-reduced-motion: reduce){{.lp *{{transition:none !important;animation:none !important}}}}
@media (max-width: 900px){{
  .lp .bcontact{{grid-template-columns:minmax(0,1fr) !important}}
  .lp .nlinks{{display:none !important}}
  .lp header{{gap:10px !important}}
  .lp header .btn-p{{padding:0 16px !important;height:40px !important;font-size:14px !important}}
  .lp .hero{{grid-template-columns:minmax(0,1fr) !important;padding-top:24px !important}}
  .lp .hero > div:not(.hv){{align-items:flex-start !important;text-align:left !important;order:-1}}
  .lp .hero > div:not(.hv) > div{{justify-content:flex-start !important}}
  .lp .hero-h{{font-size:39px !important;line-height:44px !important;white-space:normal !important}}
  .lp .hero-h br{{display:none}}
  .lp .fan{{height:460px !important;transform:scale(0.78);transform-origin:center top;margin-bottom:-60px}}
  .lp .fan .t1,.lp .fan:hover .t1{{transform:translate(-50%,-50%) translateX(-105px) translateY(20px) rotate(-10deg) !important}}
  .lp .fan .t3,.lp .fan:hover .t3{{transform:translate(-50%,-50%) translateX(105px) translateY(20px) rotate(10deg) !important}}
  .lp .bwall{{height:440px !important}}
  .lp .bgrid{{transform:translate(-50%,-50%) perspective(1400px) rotateX(24deg) rotateZ(-10deg) scale(0.8) !important}}
  .lp .g3,.lp .g2,.lp .fx3,.lp .faq2,.lp .brow{{grid-template-columns:minmax(0,1fr) !important}}
  .lp .pad{{padding-left:20px !important;padding-right:20px !important}}
  .lp .sec{{padding-top:56px !important;padding-bottom:56px !important}}
  .lp .h2{{font-size:34px !important;line-height:40px !important}}
  .lp .foot{{grid-template-columns:minmax(0,1fr) minmax(0,1fr) !important}}
  .lp .mqc{{width:84px !important;height:84px !important;border-radius: 18px !important}}
  .lp .mqc img{{width:46px !important;height:46px !important}}
  .lp .brow{{padding:24px !important}}
  .lp .hstage-wrap{{height:205px !important;overflow:hidden;-webkit-mask-image:linear-gradient(90deg,transparent,#000 16%,#000 84%,transparent);mask-image:linear-gradient(90deg,transparent,#000 16%,#000 84%,transparent)}}
  .lp .hstage{{transform:scale(0.5) !important;transform-origin:center top}}
  .lp .hstage .hc,.lp .hstage .hport{{display:none !important}}
  .lp .hm{{display:flex !important}}
  .lp .dlabel{{display:none}}
  .lp .hero-hb{{font-size:36px !important;line-height:41px !important;letter-spacing:-1px !important}}
  .lp .btabs{{grid-template-columns:repeat(4,minmax(150px,1fr)) !important;overflow-x:auto}}
  .lp .bpanel{{grid-template-columns:minmax(0,1fr) !important}}
  .lp .bstats{{grid-template-columns:minmax(0,1fr) !important;gap:12px;text-align:left !important}}
  .lp .bstats > span{{border:0 !important}}
  .lp .bvis-meet{{grid-template-columns:minmax(0,1fr) !important}}
  .lp .ctiles > div:nth-child(3){{display:none}}
  .lp .pdash{{padding:14px !important}}
}}
</style>
</helmet>
<div class="lp" style="position: relative; width: 100%; min-height: 100vh; background: #07070A; color: #FFFFFF; font-family: 'Geist', system-ui, sans-serif; overflow-x: clip">
<div aria-hidden="true" style="position: absolute; left: 50%; top: -300px; width: 1400px; height: 900px; margin-left: -700px; border-radius: 50%; background: radial-gradient(closest-side, rgba(12,101,196,0.08), transparent 70%); pointer-events: none"></div>

<!-- NAV (reference: mark, Creator/Brand, links, Sign Up) -->
<div class="navwrap" style="position: sticky; top: 0; z-index: 40; padding: 14px 40px 0"><header class="navbar" style="position: relative; display: flex; align-items: center; gap: 22px; height: 62px; max-width: 1200px; margin: 0 auto; padding: 0 10px 0 18px">
  <a href="#top" aria-label="TAPP beranda" style="display: flex"><img src="{BLOB_MARK}" alt="" style="width: 28px; height: 28px; filter: drop-shadow(0 0 10px rgba(12,101,196,0.6))"></a>
  <div role="tablist" aria-label="Pilih peran" style="display: flex; gap: 2px; padding: 3px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.08); background: rgba(0,0,0,0.35)">
    <button role="tab" aria-selected="{{{{isCreator}}}}" onClick="{{{{setCreator}}}}" style="{{{{creatorTab}}}}">Creator</button>
    <button role="tab" aria-selected="{{{{isBrand}}}}" onClick="{{{{setBrand}}}}" style="{{{{brandTab}}}}">Brand</button>
  </div>
  <div style="flex-grow: 1"></div>
  <nav class="nlinks" style="display: flex; gap: 26px; font-weight: 500; font-size: 15px"><a class="nl" href="campaigns.html">Campaigns</a><a class="nl" href="blog.html">Blog</a><a class="nl" href="contact.html">Contact</a><a class="nl" href="#app:/login">Log In</a></nav>
  {pill_btn("Sign Up", "#app:/register")}
  <button type="button" class="hb" aria-label="Buka menu" aria-expanded="false" aria-controls="mmenu"><span></span><span></span></button>
  <div class="mmenu" id="mmenu"><nav class="mm-links"><a href="campaigns.html">Campaigns</a><a href="#alur">Cara Kerja</a><a href="blog.html">Blog</a><a href="contact.html">Contact</a></nav><div class="mm-act"><a class="mm-btn ghost" href="#app:/login">Log In</a><a class="mm-btn pri" href="#app:/register">Sign Up</a></div></div>
</header></div>

<main id="top">
<sc-if value="{{{{isCreator}}}}" hint-placeholder-val="{{{{ true }}}}">
  {hero_hub()}

  <section id="campaign" class="sec pad" style="max-width: 1280px; margin: 0 auto; padding: 96px 64px">
    {head("Campaign Terbuka", "Campaign Siap Diambil,", "Tinggal Kamu Eksekusi", "Tarif, target views, dan aturan setiap brief terbuka sejak awal. Kamu tahu nilai karyamu sebelum mulai berkarya.")}
    <div class="g3" style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18px">
      {campaign_card(CAMPAIGNS[0])}
      {soon_card("Brand Berikutnya Segera Hadir", "Campaign dari brand partner baru akan muncul di sini.")}
      {soon_card("Kamu Yang Pertama Tahu", "Begitu campaign baru dibuka, notifikasinya langsung masuk ke akunmu.")}
    </div>
    <div style="display: flex; flex-direction: column; align-items: center; gap: 14px; margin-top: 40px">
      {pill_btn("Jelajahi Semua Campaign", "campaigns.html")}
      <span style="display: inline-flex; align-items: center; gap: 10px; font-size: 14px; color: #8A8A93; font-weight: 500">Gratis untuk creator. Tanpa syarat follower.</span>
    </div>
  </section>

  <section id="alur" class="sec pad" style="max-width: 1180px; margin: 0 auto; padding: 72px 64px">
    {head("Cara Kerja", "Dari Daftar", "Sampai Dibayar", "Empat langkah, tanpa ribet. Status clip-mu selalu kelihatan: direview, diterima, atau sudah ditransfer.")}
    <div class="g2" style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px">{''.join(step_card(i, t) for i, t in enumerate(STEPS_C))}</div>
  </section>

  {LEVELS}

  {PORTFOLIO}

  <section id="daftar" class="sec" style="padding: 88px 0 40px">
{WALL}
  </section>

  {faq_block("FAQ", "Pertanyaan Yang", "Sering Muncul", "Hubungi Tim TAPP", "#whatsapp", "faqC")}
</sc-if>

<sc-if value="{{{{isBrand}}}}" hint-placeholder-val="{{{{ false }}}}">
  {hero_brand()}

  <section id="campaign" class="sec pad" style="max-width: 1280px; margin: 0 auto; padding: 96px 64px">
    {head("Kenapa TAPP", "Semua Terkendali,", "Dari Brief Sampai Laporan", "Satu account manager, satu sistem penyaring views, dan satu dashboard untuk membaca hasilnya.", True, 860)}
{FX3}
  </section>

  {steps_tabs(VIS_B[3])}

  <section id="kontak" class="sec pad" style="max-width: 1180px; margin: 0 auto; padding: 56px 64px 24px">
    {BRAND_CONTACT}
  </section>

  {faq_block("FAQ Brand", "Sebelum Kamu", "Menaruh Budget", "Hubungi Tim TAPP", "#mail", "faqB")}
</sc-if>
</main>

{FOOTER}

<a href="#discord" aria-label="Gabung Discord TAPP" class="dbtn" style="position: fixed; right: 24px; bottom: 24px; z-index: 30; display: inline-flex; align-items: center; gap: 9px; height: 46px; padding: 0 18px 0 14px; border-radius: 14px; font-weight: 500; font-size: 14px"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M19.3 5.3A17 17 0 0 0 15 4l-.5 1a15.7 15.7 0 0 0-5 0L9 4a17 17 0 0 0-4.3 1.3C2 9.4 1.3 13.4 1.6 17.3A17 17 0 0 0 6.9 20l1-1.6a11 11 0 0 1-1.7-.8l.4-.3a12 12 0 0 0 10.8 0l.4.3a11 11 0 0 1-1.7.8l1 1.6a17 17 0 0 0 5.3-2.7c.4-4.6-.7-8.6-2.8-12zM8.7 15c-1 0-1.9-1-1.9-2.2s.8-2.2 1.9-2.2 1.9 1 1.9 2.2-.8 2.2-1.9 2.2zm6.6 0c-1 0-1.9-1-1.9-2.2s.8-2.2 1.9-2.2 1.9 1 1.9 2.2-.8 2.2-1.9 2.2z"></path></svg><span class="dlabel">Gabung Discord</span></a>
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{{"startMode":{{"editor":"enum","options":["creator","brand"],"default":"creator"}},"$preview":{{"width":1440,"height":5600}}}}'>
{JS}
</script>
</body>
</html>
'''
open(HERE.parent / 'landing.dc.html', 'w').write(page)
print(len(page))
