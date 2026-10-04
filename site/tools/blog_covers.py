# Cover art for blog posts: inline SVG in the TAPP look (navy canvas, blue light beams, glass objects).
MARK = 'assets/tapp-mark-white.svg?v=2'

def _frame(uid, inner):
    return f'''<svg viewBox="0 0 640 360" preserveAspectRatio="xMidYMid slice" role="img" aria-hidden="true" class="cover-svg">
<defs>
<radialGradient id="bg{uid}" cx="0.5" cy="0.15" r="0.95"><stop offset="0" stop-color="#0B3F7A"/><stop offset="0.45" stop-color="#061B33"/><stop offset="1" stop-color="#03070D"/></radialGradient>
<linearGradient id="beam{uid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9CCBFF" stop-opacity="0.75"/><stop offset="0.35" stop-color="#2F86E8" stop-opacity="0.25"/><stop offset="1" stop-color="#0C65C4" stop-opacity="0"/></linearGradient>
<linearGradient id="glass{uid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1A2433"/><stop offset="1" stop-color="#0A0E15"/></linearGradient>
<linearGradient id="btn{uid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#55A0F1"/><stop offset="0.5" stop-color="#0C65C4"/><stop offset="1" stop-color="#104F92"/></linearGradient>
<filter id="glow{uid}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="14"/></filter>
</defs>
<rect width="640" height="360" fill="url(#bg{uid})"/>
<path d="M0 0 L120 0 L330 360 L250 360 Z" fill="url(#beam{uid})" opacity="0.55"/>
<path d="M640 0 L520 0 L310 360 L390 360 Z" fill="url(#beam{uid})" opacity="0.4"/>
<g fill="#75B2F4" opacity="0.35">{''.join(f'<circle cx="{(i * 97) % 640}" cy="{(i * 53) % 360}" r="{1 + i % 2}"/>' for i in range(1, 26))}</g>
{inner}
</svg>'''

def _phone(uid, x, y, w, h, body):
    return (f'<g><rect x="{x - 6}" y="{y - 6}" width="{w + 12}" height="{h + 12}" rx="34" fill="#2A3442"/>'
            f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="28" fill="url(#glass{uid})"/>'
            f'<rect x="{x + w / 2 - 34}" y="{y + 10}" width="68" height="16" rx="8" fill="#02040A"/>{body}</g>')

def _mark(x, y, s):
    return f'<image href="{MARK}" x="{x}" y="{y}" width="{s}" height="{s}"/>'

def cover(kind, uid):
    if kind == 'wizard':
        steps = ''.join(f'<circle cx="{270 + i * 50}" cy="96" r="12" fill="{"#0C65C4" if i < 2 else "none"}" stroke="#75B2F4" stroke-width="2"/>'
                        f'<text x="{270 + i * 50}" y="100" text-anchor="middle" font-size="11" font-family="Geist,Arial" fill="#fff">{"✓" if i < 2 else 3}</text>' for i in range(3))
        tiles = ''.join(f'<rect x="{262 + (i % 2) * 60}" y="{124 + (i // 2) * 84}" width="54" height="76" rx="8" fill="{c}"/>'
                        for i, c in enumerate(['#1D5FA8', '#0E3A6B', '#2C7BD6', '#123E70']))
        body = (steps + '<line x1="282" y1="96" x2="308" y2="96" stroke="#75B2F4"/><line x1="332" y1="96" x2="358" y2="96" stroke="#75B2F4" stroke-dasharray="3 3"/>'
                + tiles + '<circle cx="290" cy="162" r="9" fill="#0C65C4" stroke="#fff" stroke-width="2"/><text x="290" y="166" text-anchor="middle" font-size="10" fill="#fff" font-family="Arial">1</text>'
                + f'<rect x="262" y="300" width="114" height="26" rx="9" fill="url(#btn{uid})"/><text x="319" y="317" text-anchor="middle" font-size="11" font-weight="600" fill="#fff" font-family="Geist,Arial">Submit 2 Video</text>')
        return _frame(uid, f'<ellipse cx="320" cy="200" rx="140" ry="120" fill="#0C65C4" opacity="0.35" filter="url(#glow{uid})"/>' + _phone(uid, 250, 50, 140, 300, body))
    if kind == 'verify':
        return _frame(uid, f'''<ellipse cx="320" cy="190" rx="160" ry="100" fill="#0C65C4" opacity="0.3" filter="url(#glow{uid})"/>
<rect x="170" y="96" width="300" height="170" rx="22" fill="url(#glass{uid})" stroke="#2A3A52"/>
<circle cx="216" cy="140" r="24" fill="#0E3A6B"/><text x="216" y="146" text-anchor="middle" font-size="16" font-family="Geist,Arial" fill="#C2DDFA">RP</text>
<text x="252" y="136" font-size="15" font-weight="600" font-family="Geist,Arial" fill="#fff">@rani.clips</text><text x="252" y="156" font-size="11" font-family="Geist,Arial" fill="#8A9BB3">Bio</text>
<rect x="196" y="182" width="248" height="48" rx="12" fill="#0A2A4D" stroke="#2F86E8"/>
<text x="216" y="213" font-size="20" letter-spacing="3" font-family="Menlo,monospace" fill="#fff">TAPP-482913</text>
<circle cx="452" cy="104" r="26" fill="url(#btn{uid})"/><path d="M440 104 l8 8 l16 -16" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>''')
    if kind == 'views':
        bars = ''.join(f'<rect x="{180 + i * 30}" y="{280 - h}" width="20" height="{h}" rx="5" fill="{"url(#btn" + uid + ")" if i > 5 else "#1B3352"}"/>'
                       for i, h in enumerate([40, 56, 50, 78, 92, 110, 136, 160, 190]))
        return _frame(uid, f'''<ellipse cx="320" cy="210" rx="170" ry="90" fill="#0C65C4" opacity="0.3" filter="url(#glow{uid})"/>{bars}
<line x1="170" y1="282" x2="470" y2="282" stroke="#2A3A52"/>
<g transform="translate(410 70)"><path d="M40 0 L78 14 V44 C78 68 60 84 40 92 C20 84 2 68 2 44 V14 Z" fill="url(#btn{uid})" stroke="#9CCBFF" stroke-opacity="0.5"/>
<path d="M24 46 l11 11 l20 -22" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>
<text x="180" y="100" font-size="13" font-family="Geist,Arial" fill="#8FB9E8">Qualified views</text><text x="180" y="132" font-size="30" font-weight="600" font-family="Geist,Arial" fill="#fff">1,4 jt</text>''')
    if kind == 'level':
        def hexa(cx, cy, r, fill, stroke):
            pts = ' '.join(f'{cx + r * __import__("math").cos(__import__("math").radians(60 * k - 90)):.1f},{cy + r * __import__("math").sin(__import__("math").radians(60 * k - 90)):.1f}' for k in range(6))
            return f'<polygon points="{pts}" fill="{fill}" stroke="{stroke}" stroke-width="2"/>'
        small = ''.join(hexa(150 + i * 85, 300, 20, '#0E1C2E', c) for i, c in enumerate(['#8A8A93', '#34D07A', '#75B2F4', '#A78BFA', '#F0B429']))
        return _frame(uid, f'''<ellipse cx="320" cy="160" rx="130" ry="110" fill="#0C65C4" opacity="0.45" filter="url(#glow{uid})"/>
{hexa(320, 160, 96, '#123A66', '#9CCBFF')}{hexa(320, 160, 74, f'url(#btn{uid})', '#C2DDFA')}{_mark(286, 126, 68)}{small}''')
    if kind == 'payout':
        notes = ''.join(f'<g transform="translate({190 + i * 26} {110 - i * 14}) rotate({-8 + i * 6})"><rect width="200" height="96" rx="12" fill="{c}" stroke="#9CCBFF" stroke-opacity="0.35"/>'
                        f'<text x="18" y="38" font-size="22" font-weight="600" font-family="Geist,Arial" fill="#fff">Rp</text><circle cx="160" cy="60" r="18" fill="none" stroke="#C2DDFA" stroke-opacity="0.5"/></g>'
                        for i, c in enumerate(['#0E3A6B', '#14508F', '#1D64B3']))
        return _frame(uid, f'''<ellipse cx="320" cy="190" rx="170" ry="100" fill="#0C65C4" opacity="0.35" filter="url(#glow{uid})"/>{notes}
<rect x="230" y="248" width="180" height="44" rx="14" fill="url(#btn{uid})"/><text x="320" y="276" text-anchor="middle" font-size="15" font-weight="600" font-family="Geist,Arial" fill="#fff">Rp300.000 ✓</text>''')
    if kind == 'brand':
        cols = ['#1D5FA8', '#0E3A6B', '#2C7BD6', '#123E70', '#174E8C', '#0B2F57', '#2468B5', '#0F3560']
        tiles = ''.join(f'<rect x="{140 + (i % 4) * 92}" y="{70 + (i // 4) * 120}" width="82" height="110" rx="10" fill="{c}" stroke="#2A3A52"/>'
                        f'<circle cx="{181 + (i % 4) * 92}" cy="{125 + (i // 4) * 120}" r="12" fill="#fff" opacity="0.85"/>'
                        f'<path d="M{177 + (i % 4) * 92} {119 + (i // 4) * 120} l10 6 l-10 6 z" fill="#0C2442"/>' for i, c in enumerate(cols))
        return _frame(uid, f'<ellipse cx="320" cy="180" rx="210" ry="120" fill="#0C65C4" opacity="0.28" filter="url(#glow{uid})"/>{tiles}')
    if kind == 'assets':
        strip = ''.join(f'<rect x="{150 + i * 70}" y="140" width="60" height="80" rx="6" fill="{c}"/>' for i, c in enumerate(['#1D5FA8', '#2C7BD6', '#14508F', '#0E3A6B', '#2468B5']))
        holes = ''.join(f'<rect x="{146 + i * 20}" y="{y}" width="10" height="8" rx="2" fill="#03070D"/>' for i in range(18) for y in (122, 230))
        return _frame(uid, f'''<ellipse cx="320" cy="180" rx="200" ry="90" fill="#0C65C4" opacity="0.3" filter="url(#glow{uid})"/>
<rect x="136" y="114" width="368" height="132" rx="10" fill="#0A1626" stroke="#2A3A52"/>{holes}{strip}
<g transform="translate(400 54)"><rect width="110" height="70" rx="12" fill="url(#btn{uid})"/><path d="M40 22 v24 m-12 -12 l12 12 l12 -12" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/><rect x="62" y="40" width="30" height="6" rx="3" fill="#C2DDFA"/></g>''')
    # mega
    return _frame(uid, f'''<ellipse cx="320" cy="170" rx="180" ry="120" fill="#0C65C4" opacity="0.5" filter="url(#glow{uid})"/>
<rect x="260" y="70" width="120" height="120" rx="30" fill="url(#btn{uid})" stroke="#C2DDFA" stroke-opacity="0.5"/>{_mark(282, 92, 76)}
<text x="320" y="252" text-anchor="middle" font-size="40" font-weight="700" letter-spacing="2" font-family="InterTight,Geist,Arial" fill="#fff">MEGA CAMPAIGN</text>
<text x="320" y="284" text-anchor="middle" font-size="15" font-family="Geist,Arial" fill="#8FB9E8">Rp3.000 / 1.000 views · TikTok · Instagram · YouTube</text>''')
