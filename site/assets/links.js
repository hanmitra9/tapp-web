// Rewrites placeholder links (#app:/path, #mail, #discord, #instagram, #whatsapp) from config.js.
// Links whose target isn't configured are hidden instead of pointing nowhere.
(function () {
  function apply(root) {
    var c = window.TAPP_CONFIG || {};
    var map = { '#mail': c.SUPPORT_EMAIL ? 'mailto:' + c.SUPPORT_EMAIL : '', '#discord': c.DISCORD_URL, '#instagram': c.INSTAGRAM_URL, '#whatsapp': c.WHATSAPP_URL };
    (root || document).querySelectorAll('a[href]').forEach(function (a) {
      var h = a.getAttribute('href');
      if (h.indexOf('#app:') === 0) {
        if (c.APP_URL) a.setAttribute('href', c.APP_URL.replace(/\/$/, '') + h.slice(5));
        else a.setAttribute('href', '#');
        return;
      }
      if (Object.prototype.hasOwnProperty.call(map, h)) {
        if (map[h]) { a.setAttribute('href', map[h]); if (h !== '#mail') { a.target = '_blank'; a.rel = 'noopener'; } }
        else a.style.display = 'none';
      }
    });
    // Hide a group (e.g. the footer "Social" column) when none of its links are configured.
    (root || document).querySelectorAll('[data-hide-empty]').forEach(function (g) {
      var visible = Array.prototype.some.call(g.querySelectorAll('a'), function (a) { return a.style.display !== 'none'; });
      if (!visible) { if (!g.hasAttribute('data-hid')) { g.setAttribute('data-hid', g.style.display || ''); g.style.display = 'none'; } }
      else if (g.hasAttribute('data-hid')) { g.style.display = g.getAttribute('data-hid'); g.removeAttribute('data-hid'); }
    });
  }
  window.TAPP_applyLinks = apply;
  document.addEventListener('DOMContentLoaded', function () { apply(document); });
})();
