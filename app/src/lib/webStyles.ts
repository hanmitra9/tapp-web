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
    face('GeistMono', 'GeistMono-Regular.woff2'),          // payout share card
    face('BigShoulders', 'BigShoulders-Bold.woff2'),
    `@font-face{font-family:'InterTight';src:url('${base}/fonts/InterTight-Variable.woff2') format('woff2');font-weight:100 900;font-display:swap}`,
    // Premium surfaces, opted in with dataSet={{ tapp: '…' }} (RN styles can't express layered backgrounds / masks / blur).
    `[data-tapp~="balance"]{background:radial-gradient(70% 120% at 88% -10%,rgba(117,178,244,0.55),transparent 55%),radial-gradient(60% 90% at 0% 110%,rgba(16,79,146,0.7),transparent 60%),linear-gradient(135deg,#051629 0%,#092D52 48%,#104F92 100%)!important;box-shadow:0 30px 70px -30px rgba(12,101,196,0.75),inset 0 1px 0 rgba(255,255,255,0.18)!important;position:relative}`,
    `[data-tapp~="balance"]::before{content:'';position:absolute;inset:0;border-radius:inherit;padding:1px;background:linear-gradient(160deg,rgba(194,221,250,0.55),rgba(117,178,244,0.08) 40%,rgba(117,178,244,0.3));-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;pointer-events:none}`,
    `[data-tapp~="balance"]::after{content:'';position:absolute;right:-90px;top:-90px;width:300px;height:300px;border-radius:50%;border:1px solid rgba(194,221,250,0.14);box-shadow:0 0 0 46px rgba(194,221,250,0.015),0 0 0 47px rgba(194,221,250,0.07),0 0 0 100px rgba(194,221,250,0.01),0 0 0 101px rgba(194,221,250,0.05);pointer-events:none}`,
    `[data-tapp~="glass"]{background:rgba(12,12,17,0.66)!important;-webkit-backdrop-filter:blur(20px) saturate(1.4);backdrop-filter:blur(20px) saturate(1.4);border:1px solid rgba(255,255,255,0.07)!important;box-shadow:0 24px 60px -28px rgba(0,0,0,0.95),inset 0 1px 0 rgba(255,255,255,0.05)!important}`,
    `[data-tapp~="navon"]{background:linear-gradient(180deg,#4296F0,#135BA8)!important;box-shadow:0 10px 26px -12px rgba(12,101,196,0.95),inset 0 1px 0 rgba(255,255,255,0.25)!important}`,
    `[data-tapp~="action"]{background:radial-gradient(circle at 30% 20%,rgba(84,160,241,0.22),transparent 60%),linear-gradient(180deg,#17171F,#0C0C11)!important;border-color:rgba(117,178,244,0.22)!important;box-shadow:0 12px 26px -16px rgba(12,101,196,0.7),inset 0 1px 0 rgba(255,255,255,0.06)!important;transition:transform .2s ease,border-color .2s ease}`,
    `[data-tapp~="art"]{background:radial-gradient(60% 90% at 80% 40%,rgba(117,178,244,0.55),transparent 60%),radial-gradient(40% 60% at 15% 110%,rgba(12,101,196,0.5),transparent 70%),linear-gradient(135deg,#05192f 0%,#0C3969 55%,#0C65C4 100%)!important;overflow:hidden;position:relative}`,
    `[data-tapp~="art"]::before{content:'';position:absolute;right:calc(14% - 32px);top:50%;width:120px;height:120px;margin-top:-60px;border-radius:50%;border:1px solid rgba(194,221,250,0.25);box-shadow:0 0 0 26px rgba(194,221,250,0.02),0 0 0 27px rgba(194,221,250,0.10);pointer-events:none}`,
    `[data-tapp~="track"]{background:rgba(255,255,255,0.035)!important;box-shadow:inset 0 1px 2px rgba(0,0,0,0.6),inset 0 0 0 1px rgba(255,255,255,0.05)}`,
    `[data-tapp~="seg-q"]{background:linear-gradient(90deg,#104F92 0%,#0C65C4 35%,#54A0F1 75%,#A4CCF8 100%)!important;box-shadow:0 0 14px -2px rgba(12,101,196,0.85),inset 0 1px 0 rgba(255,255,255,0.35)}`,
    `[data-tapp~="seg-p"]{background:linear-gradient(90deg,#9C6F1E 0%,#D9A54A 55%,#F6D997 100%)!important;box-shadow:0 0 12px -3px rgba(232,182,90,0.7),inset 0 1px 0 rgba(255,255,255,0.3)}`,
    `[data-tapp~="seg-x"]{background:repeating-linear-gradient(135deg,rgba(255,255,255,0.16) 0 3px,rgba(255,255,255,0.05) 3px 7px)!important}`,
    `[data-tapp~="halo"]{background:radial-gradient(circle,rgba(12,101,196,0.38) 0%,rgba(12,101,196,0.12) 45%,transparent 70%)!important;box-shadow:0 0 0 1px rgba(117,178,244,0.16),0 0 0 22px rgba(12,101,196,0.05),0 0 0 23px rgba(117,178,244,0.10),0 0 80px 10px rgba(12,101,196,0.35);animation:tappHalo 2.6s ease-in-out infinite}`,
    `@keyframes tappHalo{0%,100%{transform:scale(1)}50%{transform:scale(1.04)}}`,
    `@media (prefers-reduced-motion:reduce){[data-tapp~="halo"]{animation:none}}`,
    `[data-tapp~="action"]:hover{transform:translateY(-2px);border-color:rgba(117,178,244,0.45)!important}`,
    `html,body{background:radial-gradient(1100px 620px at 50% -8%,rgba(9,110,218,0.16),rgba(12,101,196,0.04) 45%,transparent 70%),radial-gradient(800px 700px at 100% 60%,rgba(12,101,196,0.05),transparent 65%),linear-gradient(180deg,#0B0B12 0%,#07070A 30%,#050507 100%) fixed #060608}`,
    `body::after{content:'';position:fixed;inset:0;pointer-events:none;z-index:9999;opacity:.04;mix-blend-mode:overlay;background-image:url("${GRAIN}")}`,
    `::selection{background:rgba(12,101,196,0.45)}`,
    // Form fields: the field container draws the focus ring, so no browser outline box inside it; autofill keeps the dark field.
    `input,textarea,select{outline:none!important;box-shadow:none}`,
    `input:-webkit-autofill,input:-webkit-autofill:hover,input:-webkit-autofill:focus,textarea:-webkit-autofill{-webkit-text-fill-color:#F4F4F5;caret-color:#F4F4F5;-webkit-box-shadow:0 0 0 1000px #141419 inset;box-shadow:0 0 0 1000px #141419 inset;transition:background-color 9999s ease-out 0s}`,
  ].join('\n');
  document.head.appendChild(el);
}
