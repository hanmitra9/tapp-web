import { Image as RNImage, Platform } from 'react-native';

// Shareable stat cards in the style of Threads' views card: a black portrait card with the creator's photo cropped
// into the corner, a big condensed number and mono labels. Drawn on a canvas (web only).
//   total payout (Saldo)  ·  qualified views per campaign (Workspace)
export type PayoutCard = { total: number; from: string | null; to: string; name: string; avatarUrl: string | null };
export type RecapCard = { month: string; views: number; clips: number; topPct: number | null; tier: string; name: string; avatarUrl: string | null; streak?: number };
export type ViewsCard = { views: number; campaign: string; from: string | null; to: string; name: string; avatarUrl: string | null };
type Spec = { label: string; prefix: string | null; value: string; line1: string; line2: string; name: string; avatarUrl: string | null };
export type RenderedCard = { blob: Blob; url: string };

const W = 960, H = 1344, R = 84;
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MEI', 'JUN', 'JUL', 'AGU', 'SEP', 'OKT', 'NOV', 'DES'];
const DAY = 86_400_000;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
// "28 SEP — 4 OKT 2026", or with both years when they differ; a single day when from = to.
function dateRange(fromIso: string, toIso: string): string {
  const a = new Date(fromIso), b = new Date(toIso);
  const day = (d: Date) => `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  if (startOfDay(a) === startOfDay(b)) return `${day(b)} ${b.getFullYear()}`;
  return a.getFullYear() === b.getFullYear() ? `${day(a)} — ${day(b)} ${b.getFullYear()}` : `${day(a)} ${a.getFullYear()} — ${day(b)} ${b.getFullYear()}`;
}

const daysBetween = (from: string, to: string) => Math.round((startOfDay(new Date(to)) - startOfDay(new Date(from))) / DAY) + 1;
const fit = (t: string, n: number) => (t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t);

// 494000 → "494K", 1250000 → "1,25M", 12400000 → "12,4M" (Threads-style K/M/B)
export function compactIdr(n: number): string {
  const f = (v: number, unit: string) => `${v.toLocaleString('id-ID', { maximumFractionDigits: v < 10 ? 2 : v < 100 ? 1 : 0 })}${unit}`;
  if (n >= 1e9) return f(n / 1e9, 'B');
  if (n >= 1e6) return f(n / 1e6, 'M');
  if (n >= 1e3) return f(n / 1e3, 'K');
  return String(Math.round(n));
}

function loadImage(src: string, cors = false): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    if (cors) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function logoSrc(): string | undefined {
  const mod = require('../../assets/tapp-mark-white.png');
  return typeof mod === 'string' ? mod : mod?.uri ?? mod?.default?.uri ?? mod?.default ?? RNImage.resolveAssetSource?.(mod)?.uri;
}

async function draw(c: Spec): Promise<HTMLCanvasElement> {
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d')!;
  try { await Promise.all([document.fonts.load('300px BebasNeue'), document.fonts.load('40px RobotoMono')]); } catch { /* fallback faces */ }

  const shape = () => { g.beginPath(); g.roundRect(1, 1, W - 2, H - 2, R); };
  g.save(); shape(); g.clip();

  // Black card, soft light from the top-left (the Threads sheen) with a hint of TAPP blue.
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  const sheen = g.createRadialGradient(W * 0.12, H * 0.08, 0, W * 0.12, H * 0.08, W * 0.95);
  sheen.addColorStop(0, 'rgba(120,130,145,0.55)'); sheen.addColorStop(0.45, 'rgba(40,48,60,0.35)'); sheen.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = sheen; g.fillRect(0, 0, W, H);
  const blue = g.createRadialGradient(W, H, 0, W, H, W * 0.9);
  blue.addColorStop(0, 'rgba(12,101,196,0.22)'); blue.addColorStop(1, 'rgba(12,101,196,0)');
  g.fillStyle = blue; g.fillRect(0, 0, W, H);

  // Photo, cropped by the top-right corner.
  const cx = W * 0.8, cy = H * 0.15, cr = W * 0.29;
  g.save(); g.beginPath(); g.arc(cx, cy, cr, 0, Math.PI * 2); g.clip();
  let photo: HTMLImageElement | null = null;
  if (c.avatarUrl) { try { photo = await loadImage(c.avatarUrl, true); } catch { photo = null; } }
  if (photo) {
    const s = Math.max((cr * 2) / photo.width, (cr * 2) / photo.height);
    g.drawImage(photo, cx - (photo.width * s) / 2, cy - (photo.height * s) / 2, photo.width * s, photo.height * s);
  } else {
    const fill = g.createLinearGradient(cx - cr, cy - cr, cx + cr, cy + cr);
    fill.addColorStop(0, '#2F86E8'); fill.addColorStop(1, '#08254A');
    g.fillStyle = fill; g.fillRect(cx - cr, cy - cr, cr * 2, cr * 2);
    g.fillStyle = '#FFFFFF'; g.font = `${Math.round(cr * 1.15)}px BebasNeue, sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText((c.name.trim()[0] ?? 'T').toUpperCase(), cx - cr * 0.12, cy + cr * 0.12);
    g.textAlign = 'left';
  }
  g.restore();

  // Logo.
  try { const src = logoSrc(); if (src) g.drawImage(await loadImage(src), 96, 104, 104, 104); } catch { /* no logo */ }

  // Label + number.
  g.fillStyle = '#FFFFFF'; g.textBaseline = 'alphabetic';
  g.font = '44px RobotoMono, monospace';
  g.fillText(c.label, 96, H * 0.5);
  const pre = c.prefix ? `${c.prefix}` : '';
  let size = 360;
  const width = () => { g.font = `${size}px BebasNeue, sans-serif`; const a = g.measureText(c.value).width; if (!pre) return a; g.font = `${size * 0.42}px BebasNeue, sans-serif`; return a + g.measureText(pre).width + 16; };
  while (width() > W - 180 && size > 120) size -= 10;
  const base = H * 0.5 + 40 + size * 0.86;
  let x = 92;
  if (pre) { g.font = `${size * 0.42}px BebasNeue, sans-serif`; g.fillText(pre, x, base); x += g.measureText(pre).width + 14; }
  g.font = `${size}px BebasNeue, sans-serif`; g.fillText(c.value, x, base);

  // Footer.
  g.font = '44px RobotoMono, monospace';
  g.fillText(c.line1, 96, H - 190);
  g.fillStyle = 'rgba(255,255,255,0.92)';
  g.fillText(c.line2, 96, H - 118);
  g.restore();

  // Hairline edge.
  shape(); g.strokeStyle = 'rgba(255,255,255,0.16)'; g.lineWidth = 2; g.stroke();
  return cv;
}

async function render(spec: Spec): Promise<RenderedCard> {
  if (Platform.OS !== 'web') throw new Error('Kartu tersedia di versi web.');
  const cv = await draw(spec);
  const blob: Blob = await new Promise((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error('Gagal membuat gambar.'))), 'image/png'));
  return { blob, url: URL.createObjectURL(blob) };
}

// Since the first paid payout, counted up to the day the card is made.
export function renderPayoutCard(c: PayoutCard): Promise<RenderedCard> {
  const from = c.from ?? c.to;
  return render({ label: 'TOTAL PAYOUT', prefix: 'RP', value: compactIdr(c.total), name: c.name, avatarUrl: c.avatarUrl,
    line1: `${daysBetween(from, c.to).toLocaleString('id-ID')} HARI`, line2: dateRange(from, c.to) });
}

// Qualified views in one campaign, since the creator joined it.
export function renderViewsCard(c: ViewsCard): Promise<RenderedCard> {
  const from = c.from ?? c.to;
  return render({ label: 'QUALIFIED VIEWS', prefix: null, value: compactIdr(c.views), name: c.name, avatarUrl: c.avatarUrl,
    line1: fit(c.campaign.toUpperCase(), 30), line2: dateRange(from, c.to) });
}

// Monthly recap (0071): qualified views of the month, then clips, standing and level. Never money.
const MONTHS_FULL = ['JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI', 'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER'];
export function renderRecapCard(c: RecapCard): Promise<RenderedCard> {
  const d = new Date(`${c.month}T00:00:00`);
  const bits = [`${c.clips.toLocaleString('id-ID')} KLIP`, c.topPct ? `TOP ${c.topPct}%` : null, c.streak && c.streak >= 2 ? `🔥 ${c.streak} WEEKS` : null, c.tier.toUpperCase()].filter(Boolean).join(' · ');
  return render({ label: `REKAP ${MONTHS_FULL[d.getMonth()]}`, prefix: null, value: compactIdr(c.views), name: c.name, avatarUrl: c.avatarUrl,
    line1: `${bits}`, line2: `QUALIFIED VIEWS · ${d.getFullYear()}` });
}

// Weekly streak (0075/0076): orange "fire" card — giant white number, "🔥 9 WEEKS STREAK", the last 13 weeks as a strip.
// A badge, never money.
export type StreakCard = { weeks: number; best: number; badge: string | null; name: string; avatarUrl: string | null; recent?: boolean[] };
export async function renderStreakCard(c: StreakCard): Promise<RenderedCard> {
  if (Platform.OS !== 'web') throw new Error('Kartu tersedia di versi web.');
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d')!;
  try { await Promise.all([document.fonts.load('300px BebasNeue'), document.fonts.load('40px RobotoMono')]); } catch { /* fallback faces */ }
  const shape = () => { g.beginPath(); g.roundRect(1, 1, W - 2, H - 2, R); };
  g.save(); shape(); g.clip();

  // Fire gradient: deep red at the bottom-left to warm amber at the top-right, a soft hot spot behind the number.
  const bg = g.createLinearGradient(0, H, W, 0);
  bg.addColorStop(0, '#B3170B'); bg.addColorStop(0.45, '#F2541B'); bg.addColorStop(1, '#FFAA3B');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  const hot = g.createRadialGradient(W * 0.35, H * 0.52, 0, W * 0.35, H * 0.52, W * 0.75);
  hot.addColorStop(0, 'rgba(255,236,170,0.55)'); hot.addColorStop(1, 'rgba(255,236,170,0)');
  g.fillStyle = hot; g.fillRect(0, 0, W, H);
  const shade = g.createLinearGradient(0, H * 0.7, 0, H);
  shade.addColorStop(0, 'rgba(60,4,0,0)'); shade.addColorStop(1, 'rgba(60,4,0,0.45)');
  g.fillStyle = shade; g.fillRect(0, 0, W, H);

  try { const src = logoSrc(); if (src) g.drawImage(await loadImage(src), 96, 104, 96, 96); } catch { /* no logo */ }
  g.fillStyle = 'rgba(255,255,255,0.92)'; g.font = '40px RobotoMono, monospace'; g.textAlign = 'right';
  g.fillText(fit(c.name.toUpperCase(), 18), W - 96, 168); g.textAlign = 'left';

  // Label + giant number.
  g.fillStyle = '#FFFFFF'; g.textBaseline = 'alphabetic';
  g.font = '52px RobotoMono, monospace';
  g.fillText('🔥 WEEKS STREAK', 96, H * 0.36);
  // Fit the number between the label and the week strip (Bebas caps are ~0.7 of the font size).
  const val = String(c.weeks), stripY = H - 300, base = stripY - 64, top = H * 0.36 + 44;
  let size = Math.floor((base - top) / 0.72);
  g.font = `${size}px BebasNeue, sans-serif`;
  while (g.measureText(val).width > W - 180 && size > 200) { size -= 20; g.font = `${size}px BebasNeue, sans-serif`; }
  g.shadowColor = 'rgba(120,20,0,0.35)'; g.shadowBlur = 40; g.shadowOffsetY = 12;
  g.fillText(val, 84, base);
  g.shadowColor = 'transparent'; g.shadowBlur = 0; g.shadowOffsetY = 0;

  // Last 13 weeks strip.
  const rec = (c.recent ?? []).slice(-13);
  const gap = 12, cell = (W - 192 - gap * 12) / 13, y = stripY;
  for (let i = 0; i < 13; i++) {
    const on = rec[i - (13 - rec.length)] ?? false;
    g.beginPath(); g.roundRect(96 + i * (cell + gap), y, cell, cell, 12);
    g.fillStyle = on ? '#FFFFFF' : 'rgba(255,255,255,0.22)'; g.fill();
  }
  g.font = '40px RobotoMono, monospace'; g.fillStyle = '#FFFFFF';
  g.fillText([`${c.weeks} WEEKS`, c.badge ? c.badge.toUpperCase() : null].filter(Boolean).join(' · '), 96, H - 168);
  g.fillStyle = 'rgba(255,255,255,0.85)';
  g.fillText(c.best > c.weeks ? `BEST ${c.best} WEEKS · TAPP` : 'TAPP CREATORS', 96, H - 108);
  g.restore();
  shape(); g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 2; g.stroke();
  const blob: Blob = await new Promise((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error('Gagal membuat gambar.'))), 'image/png'));
  return { blob, url: URL.createObjectURL(blob) };
}

// Share sheet on phones (Save Image / Instagram / WhatsApp), download elsewhere.
export async function shareRenderedCard(card: RenderedCard): Promise<void> {
  const file = new File([card.blob], 'tapp-card.png', { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try { await nav.share({ files: [file], title: 'TAPP' }); return; }
    catch (e) { if ((e as Error).name === 'AbortError') return; }
  }
  const a = document.createElement('a'); a.href = card.url; a.download = 'tapp-card.png'; a.click();
}
