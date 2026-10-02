// Rewrites placeholder links (#app:/path, #mail, #discord, #instagram, #whatsapp, #whatsapp-brand, #mail-brand) from config.js.
// Links whose target isn't configured are hidden instead of pointing nowhere.
(function () {
  function apply(root) {
    var c = window.TAPP_CONFIG || {};
    var map = { '#mail': c.SUPPORT_EMAIL ? 'mailto:' + c.SUPPORT_EMAIL : '', '#discord': c.DISCORD_URL, '#instagram': c.INSTAGRAM_URL, '#whatsapp': c.WHATSAPP_URL, '#whatsapp-brand': c.WHATSAPP_BRAND_URL,
      '#mail-brand': c.BRAND_EMAIL ? 'mailto:' + c.BRAND_EMAIL : '' };
    (root || document).querySelectorAll('a[href]').forEach(function (a) {
      var h = a.getAttribute('href');
      if (h.indexOf('#app:') === 0) {
        if (c.APP_URL) a.setAttribute('href', c.APP_URL.replace(/\/$/, '') + h.slice(5));
        else a.setAttribute('href', '#');
        return;
      }
      if (Object.prototype.hasOwnProperty.call(map, h)) {
        if (map[h]) { a.setAttribute('href', map[h]); if (h !== '#mail' && h !== '#mail-brand') { a.target = '_blank'; a.rel = 'noopener'; } }
        else a.style.display = 'none';
      }
    });
    // Show configured values as link text (e.g. the brand email address).
    (root || document).querySelectorAll('[data-config-text]').forEach(function (el) {
      var v = c[el.getAttribute('data-config-text')]; if (v) el.textContent = v;
    });
    // Signed in already (the app shares this site's storage): the header offers Dashboard instead of Log In / Sign Up.
    if (signedIn() && c.APP_URL) {
      var home = c.APP_URL.replace(/\/$/, '');
      (root || document).querySelectorAll('header a').forEach(function (a) {
        var t = (a.textContent || '').trim();
        if (t === 'Log In') a.style.display = 'none';
        if (t === 'Sign Up') { a.textContent = 'Dashboard'; a.setAttribute('href', home + '/dashboard'); }
      });
    }
    // Signed in: "Ambil campaign" on a landing card opens that campaign in the app instead of the sign-up page.
    if (signedIn() && c.APP_URL && c.SUPABASE_URL && c.SUPABASE_ANON_KEY) {
      var cards = (root || document).querySelectorAll('a[data-campaign]');
      if (cards.length) {
        fetch(c.SUPABASE_URL + '/rest/v1/rpc/public_campaigns', { method: 'POST', headers: { apikey: c.SUPABASE_ANON_KEY, 'Content-Type': 'application/json' }, body: '{}' })
          .then(function (r) { return r.ok ? r.json() : []; })
          .then(function (list) {
            var byTitle = {};
            (list || []).forEach(function (k) { byTitle[String(k.title).toLowerCase()] = k.id; });
            cards.forEach(function (a) {
              var id = byTitle[a.getAttribute('data-campaign').toLowerCase()];
              a.setAttribute('href', c.APP_URL.replace(/\/$/, '') + (id ? '/campaign/' + encodeURIComponent(id) : '/dashboard/campaigns'));
            });
          })
          .catch(function () { /* keep the default link */ });
      }
    }
    // "N creator ikut" on landing campaign cards (public list; cached so re-renders refill it at once).
    var jn = (root || document).querySelectorAll('[data-joined]');
    if (jn.length && c.SUPABASE_URL && c.SUPABASE_ANON_KEY) {
      if (!window.__tappJoined) window.__tappJoined = fetch(c.SUPABASE_URL + '/rest/v1/rpc/public_campaigns', { method: 'POST', headers: { apikey: c.SUPABASE_ANON_KEY, 'Content-Type': 'application/json' }, body: '{}' })
        .then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; });
      window.__tappJoined.then(function (list) {
        var by = {}; (list || []).forEach(function (k) { by[String(k.title).toLowerCase()] = k; });
        jn.forEach(function (el) {
          var k = by[el.getAttribute('data-joined').toLowerCase()]; if (!k || !k.creators_joined) return;
          var esc = function (s) { return String(s).replace(/[&<>"']/g, function (m) { return '&#' + m.charCodeAt(0) + ';'; }); };
          var ini = (k.joined_initials || []).slice(0, 4), n = k.creators_joined;
          el.innerHTML = '<span class="jn-av">' + ini.map(function (i) { return '<i>' + esc(i) + '</i>'; }).join('') + (n > ini.length ? '<i class="more">+' + (n - ini.length) + '</i>' : '')
            + '</span><span class="jn-t"><b>' + n.toLocaleString('id-ID') + '</b> creator ikut</span>';
        });
      });
    }
    // Hide a group (e.g. the footer "Social" column) when none of its links are configured.
    (root || document).querySelectorAll('[data-hide-empty]').forEach(function (g) {
      var visible = Array.prototype.some.call(g.querySelectorAll('a'), function (a) { return a.style.display !== 'none'; });
      if (!visible) { if (!g.hasAttribute('data-hid')) { g.setAttribute('data-hid', g.style.display || ''); g.style.display = 'none'; } }
      else if (g.hasAttribute('data-hid')) { g.style.display = g.getAttribute('data-hid'); g.removeAttribute('data-hid'); }
    });
  }
  function signedIn() {
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (/^sb-.+-auth-token$/.test(k) && localStorage.getItem(k)) return true;
      }
    } catch (e) { /* storage blocked */ }
    return false;
  }
  window.TAPP_applyLinks = apply;
  document.addEventListener('DOMContentLoaded', function () { apply(document); });
})();
// Mobile header menu (hamburger). State lives on <html> so a re-render of the header keeps it.
(function () {
  var root = document.documentElement;
  function set(open) {
    root.classList.toggle('menu-open', open);
    document.querySelectorAll('.hb').forEach(function (b) { b.setAttribute('aria-expanded', open); b.setAttribute('aria-label', open ? 'Tutup menu' : 'Buka menu'); });
  }
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (t.closest && t.closest('.hb')) { set(!root.classList.contains('menu-open')); return; }
    if (!root.classList.contains('menu-open')) return;
    if (!t.closest || !t.closest('.mmenu') || t.closest('a')) set(false);
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') set(false); });
  window.addEventListener('resize', function () { if (window.innerWidth > 900) set(false); });
})();
