# Brand-side hero (budget simulator) and tabbed "cara kerja", in the same hub style as the creator page.
from parts import ICON, BLOB_WHITE, FLOAT, CARD
from hub import _btn, _mini_mark
from hero2 import hero_brand_visual
import re as _re

BOARD = '''<svg aria-hidden="true" viewBox="0 0 1200 560" preserveAspectRatio="xMidYMid slice" style="position: absolute; inset: 0; width: 100%; height: 100%"><g fill="none" stroke="#75B2F4" stroke-opacity="0.16" stroke-width="1.2">
  <path d="M0 120 H180 L220 160 H330"></path><path d="M0 300 H120 L160 260 H300"></path><path d="M60 560 V430 L100 390 H260"></path>
  <path d="M1200 140 H1010 L970 180 H880"></path><path d="M1200 330 H1080 L1040 290 H900"></path><path d="M1140 560 V440 L1100 400 H940"></path>
  <rect x="40" y="170" width="46" height="46" rx="6"></rect><rect x="1110" y="200" width="46" height="46" rx="6"></rect><rect x="1060" y="40" width="70" height="40" rx="6"></rect><rect x="70" y="30" width="70" height="40" rx="6"></rect>
  </g><g fill="#75B2F4" fill-opacity="0.35"><circle cx="330" cy="160" r="3"></circle><circle cx="300" cy="260" r="3"></circle><circle cx="260" cy="390" r="3"></circle><circle cx="880" cy="180" r="3"></circle><circle cx="900" cy="290" r="3"></circle><circle cx="940" cy="400" r="3"></circle></g></svg>'''

def _corner(pos):
    v, h = pos
    return f'<i style="position: absolute; {v}: -7px; {h}: -7px; width: 12px; height: 12px; border-{v}: 2px solid #75B2F4; border-{h}: 2px solid #75B2F4"></i>'

def _sim():
    stat = lambda l, hole, color: f'<span style="display: flex; flex-direction: column; gap: 4px; padding: 0 14px"><span style="font-size: 12px; font-weight: 500; color: #8A8A93">{l}</span><b class="tabular" data-sim="{hole}" style="font-size: 26px; letter-spacing: -0.5px; color: {color}">{{{{{hole}}}}}</b></span>'
    chip = lambda lst: f'''<sc-for list="{{{{{lst}}}}}" as="o" hint-placeholder-count="4"><button onClick="{{{{o.pick}}}}" aria-pressed="{{{{o.on}}}}" style="{{{{o.style}}}}">{{{{o.label}}}}</button></sc-for>'''
    return f'''<div class="bsim" style="position: relative; width: 640px; max-width: 100%; margin: 0 auto; display: flex; flex-direction: column; gap: 14px">
  <div style="position: relative; padding: 18px 20px; border-radius: 20px; {FLOAT}">
    {_corner(('top','left'))}{_corner(('top','right'))}{_corner(('bottom','left'))}{_corner(('bottom','right'))}
    <div style="display: flex; align-items: center; justify-content: space-between; padding-bottom: 14px; margin-bottom: 14px; border-bottom: 1px solid rgba(255,255,255,0.08)">
      <span style="display: flex; align-items: center; gap: 10px; font-weight: 600; font-size: 15px">{_mini_mark(28, 9)}Your Brand</span>
      <span style="padding: 4px 11px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.18); font-size: 12px; font-weight: 600; color: #D4D4D8">Clipping</span>
    </div>
    <div class="bstats" style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); text-align: center">
      {stat('Qualified Views', 'simViews', '#34D07A')}
      <span style="border-left: 1px solid rgba(255,255,255,0.08); border-right: 1px solid rgba(255,255,255,0.08)">{stat('Tarif per 1K Views', 'simRate', '#FFFFFF')}</span>
      {stat('Min. Video Submitted', 'simClips', '#75B2F4')}
    </div>
  </div>
  <div style="width: 2px; height: 22px; margin: -6px auto; background: linear-gradient(180deg, #75B2F4, rgba(117,178,244,0.2)); box-shadow: 0 0 10px #75B2F4"></div>
  <div style="padding: 16px 18px; border-radius: 18px; {FLOAT}; display: flex; flex-direction: column; gap: 12px">
    <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px"><span style="font-size: 14px; font-weight: 500; color: #D4D4D8">Budget Kamu</span><b class="tabular" data-sim="simBudget" style="font-size: 22px; color: #C2DDFA">{{{{simBudget}}}}</b></div>
    <div class="bsl" style="--p: {{{{simPct}}}}%">
      <div class="bsl-bars" aria-hidden="true"><sc-for list="{{{{simBars}}}}" as="b" hint-placeholder-count="36"><i class="{{{{b.cls}}}}" style="height: {{{{b.h}}}}%"></i></sc-for></div>
      <div class="bsl-mark" aria-hidden="true"><b></b></div>
      <input type="range" class="bslider" min="5" max="200" step="1" value="{{{{simBudgetJt}}}}" onInput="{{{{onBudget}}}}" aria-label="Geser untuk mengatur budget campaign">
    </div>
    <div class="tabular" style="display: flex; justify-content: space-between; font-size: 12px; font-weight: 500; color: #6E7690; margin-top: -2px"><span>Rp5 jt</span><span>Rp100 jt</span><span>Rp200 jt</span></div>
  </div>
</div>'''

def hero_brand():
    return f'''<div class="hero2" style="position: relative; max-width: 1280px; margin: 0 auto; padding: 12px 24px 24px">
  {BOARD}
  <div style="position: relative">
    <div class="bwbg" aria-hidden="true" style="position: absolute; left: 50%; top: -52px; width: 900px; margin-left: -450px; opacity: 0.32; pointer-events: none">{_wall()}</div>
    <div style="position: relative">{_sim()}</div>
  </div>
  <div class="hcopy" style="position: relative; display: flex; flex-direction: column; align-items: center; gap: 20px; text-align: center; margin-top: 48px">
    <h1 class="hero-h hero-hb" style="font-size: 56px; line-height: 62px; font-weight: 500">Clip Organik, <br><span style="color: #75B2F4">Bayar Yang Terbukti</span></h1>
    <p style="font-size: 19px; line-height: 29px; color: #A1A1AA; font-weight: 400; max-width: 600px">Materi brand-mu diolah ratusan creator menjadi clip pendek yang tayang di TikTok, Instagram, dan YouTube. Kamu hanya membayar views yang terverifikasi, tanpa bot dan tanpa angka semu.</p>
    <div style="display: flex; gap: 12px; flex-wrap: wrap; justify-content: center">{_btn("Mulai Campaign", "meeting.html")}</div>
  </div>
</div>'''

# ── Tabbed steps ──────────────────────────────────────────────────────────────────────
def _meeting():
    days = ''.join(f'<span class="tabular" style="height: 34px; display: flex; align-items: center; justify-content: center; border-radius: 17px; font-size: 13px; font-weight: 500; {"color: #FFFFFF; border: 1.5px solid #75B2F4; box-shadow: 0 0 14px rgba(117,178,244,0.6)" if d == 15 else ("color: #4A4A52" if d > 24 else "color: #D4D4D8")}">{d}</span>'
                   for d in [1, 2, 3, 8, 9, 10, 15, 16, 17, 22, 23, 24, 29, 30, 31])
    return f'''<div class="bvis-meet" style="display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); width: 100%; max-width: 480px; border-radius: 20px; overflow: hidden; {CARD}">
  <div style="padding: 20px; display: flex; flex-direction: column; gap: 12px; border-right: 1px solid rgba(255,255,255,0.07)">
    {_mini_mark(28, 9)}
    <b style="font-size: 17px">Tim TAPP</b><span style="font-size: 13px; color: #9A9AA5; font-weight: 500; margin-top: -8px">Kickoff campaign</span>
    <span style="font-size: 13px; color: #D4D4D8; font-weight: 500">30–60 menit</span><span style="font-size: 13px; color: #D4D4D8; font-weight: 500; margin-top: -6px">Online meeting</span>
    <a class="btn-p" href="meeting.html" style="margin-top: auto; display: flex; align-items: center; justify-content: center; height: 40px; border-radius: 10px; font-size: 13px; font-weight: 600; background: linear-gradient(180deg, #4296F0, #12569F)">Minta jadwal</a>
  </div>
  <div style="padding: 18px 14px; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; align-content: start">
    <span style="text-align: center; font-size: 12px; color: #8A8A93; font-weight: 500">Sen</span><span style="text-align: center; font-size: 12px; color: #8A8A93; font-weight: 500">Sel</span><span style="text-align: center; font-size: 12px; color: #8A8A93; font-weight: 500">Rab</span>
    {days}
  </div>
</div>'''

def _budget():
    ticks = ''.join(f'<i style="width: 2px; height: {26 if i % 5 == 0 else 16}px; border-radius: 1px; background: {"#75B2F4" if i < 18 else "rgba(255,255,255,0.18)"}"></i>' for i in range(40))
    row = lambda l, v: f'<span style="display: flex; justify-content: space-between; padding: 9px 0; border-top: 1px solid rgba(255,255,255,0.07); font-size: 13px; font-weight: 500"><span style="color: #9A9AA5">{l}</span><span class="tabular">{v}</span></span>'
    return f'''<div style="width: 100%; max-width: 420px; padding: 22px; border-radius: 20px; {CARD}; display: flex; flex-direction: column; gap: 14px; text-align: center">
  <span style="font-size: 13px; font-weight: 500; color: #9A9AA5">Budget campaign</span>
  <b class="tabular" style="font-size: 38px; letter-spacing: -1px"><span style="color: #6E6E78">Rp</span>24.500.000</b>
  <span style="font-size: 12px; color: #8A8A93; margin-top: -8px">budget reward creator</span>
  <div style="position: relative; display: flex; align-items: flex-end; justify-content: space-between; height: 30px">{ticks}<i style="position: absolute; left: 44%; bottom: -6px; width: 14px; height: 14px; border-radius: 7px; background: #75B2F4; box-shadow: 0 0 14px #75B2F4"></i></div>
  <div style="text-align: left; margin-top: 6px">{row('Fee platform (15%, maks.)', 'Rp3.675.000')}{row('Total maksimal', 'Rp28.175.000')}{row('Status', '<span style="color: #34D07A">Terkunci saat disetujui</span>')}</div>
</div>'''

def _posting():
    rows = [('tt', 'TikTok', '@rani.clips', '86K', 'Rp258.000'), ('ig', 'Instagram', '@dewi.klip', '54K', 'Rp162.000'), ('yt', 'YouTube', '@finclips.id', '73K', 'Rp219.000')]
    lst = ''.join(f'<span style="display: flex; align-items: center; gap: 10px; padding: 11px 14px; border-radius: 12px; background: #111116; border: 1px solid rgba(255,255,255,0.07); font-size: 13px; font-weight: 500"><span style="display: inline-flex; color: #D4D4D8">{ICON[k]}</span><span style="width: 74px">{n}</span><span style="flex: 1; color: #9A9AA5; overflow: hidden; text-overflow: ellipsis; white-space: nowrap">{h}</span><b class="tabular" style="color: #34D07A">{v}</b><b class="tabular" style="width: 82px; text-align: right">{p}</b></span>' for k, n, h, v, p in rows)
    return f'''<div style="width: 100%; max-width: 440px; display: flex; flex-direction: column; align-items: center; gap: 0">
  <div style="display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 10px; width: 100%">
    <span style="padding: 12px 14px; border-radius: 14px; {CARD}; display: flex; flex-direction: column; gap: 2px"><span style="font-size: 11px; color: #8A8A93; font-weight: 500">Budget tersisa</span><b class="tabular" style="font-size: 15px">Rp20.900.000 (85%)</b></span>
    <span style="padding: 12px 14px; border-radius: 14px; {CARD}; display: flex; flex-direction: column; gap: 2px"><span style="font-size: 11px; color: #8A8A93; font-weight: 500">Total Submissions</span><b class="tabular" style="font-size: 15px">18 clip</b></span>
  </div>
  <svg width="220" height="56" viewBox="0 0 220 56" aria-hidden="true"><path d="M55 0 C 55 30, 110 20, 110 50 M165 0 C 165 30, 110 20, 110 50" fill="none" stroke="#75B2F4" stroke-opacity="0.6" stroke-width="2"></path></svg>
  <span style="width: 64px; height: 64px; margin-top: -14px; border-radius: 20px; display: inline-flex; align-items: center; justify-content: center; background: linear-gradient(180deg, #519EF1, #104F92); box-shadow: 0 0 0 8px rgba(12,101,196,0.14), 0 0 50px rgba(12,101,196,0.8)"><img src="{BLOB_WHITE}" alt="" style="width: 34px; height: 34px"></span>
  <i style="width: 2px; height: 22px; background: #75B2F4; box-shadow: 0 0 10px #75B2F4"></i>
  <div style="display: flex; flex-direction: column; gap: 8px; width: 100%">{lst}</div>
</div>'''

STEPS = [
    ('Meeting', 'Strategi Dulu, Angka Kemudian', 'Kita petakan tujuan, audiens, platform, dan tarif per 1.000 views. Tim TAPP juga memverifikasi brand-mu agar creator tahu campaign ini kredibel.', _meeting()),
    ('Brief &amp; Budget', 'Brief yang Tajam, Budget yang Terkunci', 'Aturan konten, materi sumber, dan budget reward disepakati bersama account manager. Budget dikunci saat campaign disetujui; reward tidak akan pernah melewatinya. Fee platform 15% dihitung dari reward yang benar-benar terpakai.', _budget()),
    ('Creator Posting', 'Creator yang Tepat Mulai Bergerak', 'Creator dipilih dari platform dan rekam jejak. Mereka mengolah materimu menjadi clip, lalu memublikasikannya dari akun masing-masing.', _posting()),
    ('Report', 'Baca Hasilnya, Bayar yang Terbukti', 'Bandingkan views mentah dengan qualified views, biaya per view, dan performa tiap creator di dashboard brand. Sisa budget kembali saat campaign selesai.', None),
]

def steps_tabs(report_visual):
    tabs = ''.join(f'<button role="tab" aria-selected="{{{{bsteps.{i}.on}}}}" onClick="{{{{bsteps.{i}.pick}}}}" style="{{{{bsteps.{i}.tab}}}}"><span class="tabular" style="opacity: 0.6; margin-right: 6px">0{i+1}</span>{t[0]}</button>' for i, t in enumerate(STEPS))
    panels = ''.join(f'''<div role="tabpanel" class="bpanel" style="{{{{bsteps.{i}.panel}}}}">
      <div style="display: flex; flex-direction: column; gap: 14px; justify-content: center; padding: 8px 8px 8px 4px">
        <span style="font-size: 13px; font-weight: 600; color: #75B2F4">Langkah {i+1} dari 4</span>
        <h3 style="font-size: 30px; line-height: 36px; font-weight: 600; letter-spacing: -0.6px">{t[1]}</h3>
        <p style="font-size: 16px; line-height: 25px; color: #9A9AA5; font-weight: 400; max-width: 420px">{t[2]}</p>
        <div style="display: flex; gap: 10px; margin-top: 6px">{_btn("Jadwalkan Meeting", "meeting.html")}</div>
      </div>
      <div style="display: flex; align-items: center; justify-content: center; min-height: 340px; padding: 24px; border-radius: 18px; background: radial-gradient(70% 70% at 50% 40%, rgba(12,101,196,0.22), transparent 70%), #0A0A0E; border: 1px solid rgba(117,178,244,0.16)">{t[3] if t[3] else report_visual}</div>
    </div>''' for i, t in enumerate(STEPS))
    return f'''<section id="alur" class="sec pad" style="max-width: 1180px; margin: 0 auto; padding: 72px 64px">
    <div style="display: flex; flex-direction: column; gap: 18px; align-items: flex-start; max-width: 760px; margin-bottom: 36px">
      <span class="eyebrow">How It Works</span>
      <h2 class="h2" style="font-size: 50px; line-height: 56px; font-weight: 600; letter-spacing: -1.5px">Dari Meeting Pertama <br><span style="color: #75B2F4">Sampai Laporan Pertama</span></h2>
      <p style="font-size: 17px; line-height: 27px; color: #9A9AA5; font-weight: 400; max-width: 600px">Kamu tentukan arah, tarif, dan budget. Kami urus creator, verifikasi views, dan pembayarannya.</p>
    </div>
    <div style="border-radius: 18px; padding: 10px; {CARD}">
      <div class="btabs" role="tablist" aria-label="Langkah campaign" style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; padding: 4px; margin-bottom: 10px">{tabs}</div>
      {panels}
    </div>
  </section>'''

def _wall():
    # The old brand hero's tilted clip wall, without its brief card, as a dim backdrop.
    v = hero_brand_visual()
    return v[:v.index('<div style="position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: 300px')] + '</div>'
