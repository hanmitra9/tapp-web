"""Shared site footer (landing + sub-pages). prefix = '' on the landing, page links stay relative."""

_I = {
  'ig': '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="1" fill="currentColor"/></svg>',
  'dc': '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M19.3 5.3A17 17 0 0 0 15 4l-.5 1a15.7 15.7 0 0 0-5 0L9 4a17 17 0 0 0-4.3 1.3C2 9.4 1.3 13.4 1.6 17.3A17 17 0 0 0 6.9 20l1-1.6a11 11 0 0 1-1.7-.8l.4-.3a12 12 0 0 0 10.8 0l.4.3a11 11 0 0 1-1.7.8l1 1.6a17 17 0 0 0 5.3-2.7c.4-4.6-.7-8.6-2.8-12zM8.7 15c-1 0-1.9-1-1.9-2.2s.8-2.2 1.9-2.2 1.9 1 1.9 2.2-.8 2.2-1.9 2.2zm6.6 0c-1 0-1.9-1-1.9-2.2s.8-2.2 1.9-2.2 1.9 1 1.9 2.2-.8 2.2-1.9 2.2z"/></svg>',
  'mail': '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M4 7l8 6 8-6"/></svg>',
  'wa': '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.3.8 3.2.7.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.2-.2-.5-.3z"/></svg>',
}

def footer(mark_src, home='#top', prefix=''):
    nav = [('Home', home), ('Campaigns', f'{prefix}campaigns.html'), ('Contact', f'{prefix}contact.html'), ('Kebijakan Privasi', f'{prefix}privacy.html'), ('Syarat Layanan', f'{prefix}terms.html')]
    li = lambda href, label, icon='', attr='': f'<a class="nl fl" href="{href}">{_I[icon] if icon else ""}<span{attr}>{label}</span></a>'
    return f'''<footer class="tf">
  <div class="tf-in">
    <div class="tf-brand">
      <div class="tf-logo"><img src="{mark_src}" alt=""><span class="tf-name">TAPP</span><i></i><span class="tf-tag">Clip Jadi Penghasilan</span></div>
      <p>Platform clipping di Indonesia yang menghubungkan brand dengan creator.</p>
    </div>
    <div class="tf-cols">
      <div class="tf-col"><b>Navigation</b>{''.join(li(h, l) for l, h in nav)}</div>
      <div class="tf-col" data-hide-empty><b>Social</b>{li('#instagram', 'Instagram', 'ig')}{li('#discord', 'Discord', 'dc')}</div>
      <div class="tf-col" data-hide-empty><b>Contact</b>{li('#mail', 'Email', 'mail', ' data-config-text="SUPPORT_EMAIL"')}{li('#whatsapp', 'WhatsApp Creator', 'wa', ' data-config-text="WHATSAPP_LABEL"')}{li('#whatsapp-brand', 'WhatsApp Brand', 'wa', ' data-config-text="WHATSAPP_BRAND_LABEL"')}</div>
    </div>
  </div>
  <div class="tf-copy">© 2026 TAPP. Hak cipta dilindungi.</div>
</footer>'''

CSS = '''
.tf{position:relative;overflow:hidden;margin-top:24px;padding:64px 64px 32px;background:#030304;border-top:1px solid rgba(255,255,255,0.05)}
.tf::after{content:'';position:absolute;right:-180px;bottom:-260px;width:720px;height:520px;border-radius:50%;background:radial-gradient(closest-side,rgba(12,101,196,0.32),rgba(16,79,146,0.12) 55%,transparent);pointer-events:none}
.tf-in{position:relative;z-index:1;max-width:1200px;margin:0 auto;display:flex;justify-content:space-between;gap:48px;flex-wrap:wrap}
.tf-brand{display:flex;flex-direction:column;gap:20px;max-width:380px}
.tf-logo{display:flex;align-items:center;gap:10px}
.tf-logo img{width:28px;height:28px}
.tf-name{font-family:'InterTight','Geist',sans-serif;font-size:22px;font-weight:600;letter-spacing:-0.01em;color:#FFFFFF}
.tf-logo i{width:1px;height:26px;background:rgba(255,255,255,0.16);margin:0 6px}
.tf-tag{font-size:16px;color:#B4B4BE}
.tf-brand p{font-size:14px;line-height:22px;color:#A1A1AA;margin:0}
.tf-cols{display:flex;gap:64px;flex-wrap:wrap}
.tf-col{display:flex;flex-direction:column;gap:16px;font-size:14px;font-weight:400}
.tf-col b{font-size:12px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#FFFFFF;margin-bottom:2px}
.tf .fl{display:inline-flex;align-items:center;gap:9px;color:#C9CAD3;transition:color .15s}
.tf .fl svg{color:#75B2F4;flex-shrink:0}
.tf .fl:hover{color:#FFFFFF}
.tf-copy{position:relative;z-index:1;max-width:1200px;margin:72px auto 0;font-size:13px;color:#8A8A93}
@media (max-width: 900px){.tf{padding:48px 20px 28px}.tf-cols{gap:32px 40px}.tf-copy{margin-top:48px}.tf-tag{font-size:14px}}
'''
