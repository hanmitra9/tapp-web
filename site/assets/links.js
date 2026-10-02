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
