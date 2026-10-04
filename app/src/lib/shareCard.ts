import { Image as RNImage, Platform } from 'react-native';

// Shareable "total payout" card in the style of Threads' views card: a black portrait card with the creator's
// photo cropped into the corner, a big condensed number and mono labels. Drawn on a canvas (web only).
export type PayoutCard = { total: number; payouts: number; from: string | null; to: string; name: string; avatarUrl: string | null };
export type RenderedCard = { blob: Blob; url: string };

const W = 960, H = 1344, R = 84;
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MEI', 'JUN', 'JUL', 'AGU', 'SEP', 'OKT', 'NOV', 'DES'];
const month = (iso: string) => { const d = new Date(iso); return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };

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

async function draw(c: PayoutCard): Promise<HTMLCanvasElement> {
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
  g.fillText('TOTAL PAYOUT', 96, H * 0.5);
  const num = compactIdr(c.total);
  let size = 360;
  const fit = () => { g.font = `${size}px BebasNeue, sans-serif`; const a = g.measureText(num).width; g.font = `${size * 0.42}px BebasNeue, sans-serif`; return a + g.measureText('RP').width + 16; };
  while (fit() > W - 180 && size > 120) size -= 10;
  const base = H * 0.5 + 40 + size * 0.86;
  g.font = `${size * 0.42}px BebasNeue, sans-serif`; g.fillText('RP', 92, base);
  const rpW = g.measureText('RP').width + 14;
  g.font = `${size}px BebasNeue, sans-serif`; g.fillText(num, 92 + rpW, base);

  // Footer.
  g.font = '44px RobotoMono, monospace';
  g.fillText(`${c.payouts}X PENCAIRAN`, 96, H - 190);
  g.fillStyle = 'rgba(255,255,255,0.92)';
  g.fillText(c.from && month(c.from) !== month(c.to) ? `${month(c.from)} — ${month(c.to)}` : month(c.to), 96, H - 118);
  g.restore();

  // Hairline edge.
  shape(); g.strokeStyle = 'rgba(255,255,255,0.16)'; g.lineWidth = 2; g.stroke();
  return cv;
}

export async function renderPayoutCard(c: PayoutCard): Promise<RenderedCard> {
  if (Platform.OS !== 'web') throw new Error('Kartu tersedia di versi web.');
  const cv = await draw(c);
  const blob: Blob = await new Promise((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error('Gagal membuat gambar.'))), 'image/png'));
  return { blob, url: URL.createObjectURL(blob) };
}

// Share sheet on phones (Save Image / Instagram / WhatsApp), download elsewhere.
export async function sharePayoutCard(card: RenderedCard): Promise<void> {
  const file = new File([card.blob], 'tapp-total-payout.png', { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try { await nav.share({ files: [file], title: 'Total payout TAPP' }); return; }
    catch (e) { if ((e as Error).name === 'AbortError') return; }
  }
  const a = document.createElement('a'); a.href = card.url; a.download = 'tapp-total-payout.png'; a.click();
}
