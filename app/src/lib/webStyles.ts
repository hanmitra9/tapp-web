import Constants from 'expo-constants';

// Global page styling that React Native styles can't express: the self-hosted Geist faces, and the layered
// black background (gradient + soft blue pools + grain) shared with the website. Screens are transparent so it
// shows through. Fonts live in public/fonts and respect the build's base path (e.g. /app).
const GRAIN = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .55 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E";

if (typeof document !== 'undefined' && !document.getElementById('tapp-web-styles')) {
  const base = String((Constants.expoConfig?.experiments as { baseUrl?: string } | undefined)?.baseUrl ?? '').replace(/\/$/, '');
  const face = (name: string, file: string) =>
    `@font-face{font-family:'${name}';src:url('${base}/fonts/${file}') format('woff2');font-display:swap}`;
  const el = document.createElement('style');
  el.id = 'tapp-web-styles';
  el.textContent = [
    face('Geist-Regular', 'Geist-Regular.woff2'),
    face('Geist-Medium', 'Geist-Medium.woff2'),
    face('Geist-SemiBold', 'Geist-SemiBold.woff2'),
    `html,body{background:radial-gradient(1100px 620px at 50% -8%,rgba(60,110,255,0.16),rgba(47,102,242,0.04) 45%,transparent 70%),radial-gradient(800px 700px at 100% 60%,rgba(47,102,242,0.05),transparent 65%),linear-gradient(180deg,#0B0B12 0%,#07070A 30%,#050507 100%) fixed #060608}`,
    `body::after{content:'';position:fixed;inset:0;pointer-events:none;z-index:9999;opacity:.04;mix-blend-mode:overlay;background-image:url("${GRAIN}")}`,
    `::selection{background:rgba(47,102,242,0.45)}`,
    // Form fields: the field container draws the focus ring, so no browser outline box inside it; autofill keeps the dark field.
    `input,textarea,select{outline:none!important;box-shadow:none}`,
    `input:-webkit-autofill,input:-webkit-autofill:hover,input:-webkit-autofill:focus,textarea:-webkit-autofill{-webkit-text-fill-color:#F4F4F5;caret-color:#F4F4F5;-webkit-box-shadow:0 0 0 1000px #141419 inset;box-shadow:0 0 0 1000px #141419 inset;transition:background-color 9999s ease-out 0s}`,
  ].join('\n');
  document.head.appendChild(el);
}
