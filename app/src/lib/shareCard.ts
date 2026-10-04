import { Image as RNImage, Platform } from 'react-native';

// Shareable "total payout" card, drawn on a canvas (web) and saved or shared as a PNG — like Threads' views card.
export type PayoutCard = { amount: string; name: string; handle: string | null; payouts: number; since: string | null };

const W = 1080, H = 1350;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function draw(c: PayoutCard): Promise<HTMLCanvasElement> {
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d')!;
  try { await Promise.all([document.fonts.load('600 160px InterTight'), document.fonts.load('500 40px Geist-Medium')]); } catch { /* system fallback */ }

  // Navy canvas with a blue glow and light beams.
  const bg = g.createRadialGradient(W * 0.5, H * 0.05, 40, W * 0.5, H * 0.35, H * 0.95);
  bg.addColorStop(0, '#0F4A8C'); bg.addColorStop(0.35, '#08254A'); bg.addColorStop(0.7, '#04101F'); bg.addColorStop(1, '#020509');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.save(); g.globalCompositeOperation = 'screen'; g.filter = 'blur(40px)';
  for (const [x, a] of [[W * 0.18, 0.5], [W * 0.82, -0.5]] as const) {
    g.save(); g.translate(x, -60); g.rotate(a);
    const b = g.createLinearGradient(0, 0, 0, H); b.addColorStop(0, 'rgba(170,214,255,0.55)'); b.addColorStop(0.6, 'rgba(12,101,196,0)');
    g.fillStyle = b; g.fillRect(-70, 0, 140, H * 1.1); g.restore();
  }
  g.restore();
  g.fillStyle = 'rgba(156,200,255,0.25)';
  for (let i = 1; i < 60; i++) { g.beginPath(); g.arc((i * 197) % W, (i * 131) % H, 1.6 + (i % 3) * 0.6, 0, Math.PI * 2); g.fill(); }

  // Glass card.
  const x = 90, y = 300, w = W - 180, h = 690, r = 56;
  const glass = () => { g.beginPath(); g.roundRect(x, y, w, h, r); };
  g.save(); g.shadowColor = 'rgba(0,0,0,0.85)'; g.shadowBlur = 90; g.shadowOffsetY = 40;
  glass(); const gl = g.createLinearGradient(0, y, 0, y + h); gl.addColorStop(0, 'rgba(255,255,255,0.13)'); gl.addColorStop(1, 'rgba(255,255,255,0.04)');
  g.fillStyle = gl; g.fill(); g.restore();
  glass(); g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 2; g.stroke();
  const glow = g.createRadialGradient(x + w * 0.85, y, 10, x + w * 0.85, y, w * 0.7);
  glow.addColorStop(0, 'rgba(47,134,232,0.45)'); glow.addColorStop(1, 'rgba(47,134,232,0)');
  g.save(); glass(); g.clip(); g.fillStyle = glow; g.fillRect(x, y, w, h); g.restore();

  // Logo + label.
  try {
    const mod = require('../../assets/tapp-mark-white.png');
    const src: string = typeof mod === 'string' ? mod : mod?.uri ?? mod?.default?.uri ?? mod?.default ?? RNImage.resolveAssetSource?.(mod)?.uri;
    const logo = await loadImage(src);
    g.drawImage(logo, x + 70, y + 70, 76, 76);
  } catch { /* no logo */ }
  g.fillStyle = '#FFFFFF'; g.font = '600 44px InterTight, sans-serif'; g.textBaseline = 'middle';
  g.fillText('TAPP', x + 166, y + 108);
  g.fillStyle = 'rgba(194,221,250,0.85)'; g.font = '500 38px Geist-Medium, sans-serif';
  g.fillText('Total payout dari TAPP', x + 70, y + 250);

  // Amount: shrink to fit.
  let size = 150;
  g.font = `600 ${size}px InterTight, sans-serif`;
  while (g.measureText(c.amount).width > w - 140 && size > 60) { size -= 6; g.font = `600 ${size}px InterTight, sans-serif`; }
  const amt = g.createLinearGradient(0, y + 300, 0, y + 300 + size);
  amt.addColorStop(0, '#FFFFFF'); amt.addColorStop(1, '#A4CCF8');
  g.fillStyle = amt; g.textBaseline = 'alphabetic';
  g.fillText(c.amount, x + 66, y + 300 + size * 0.85);

  g.fillStyle = 'rgba(255,255,255,0.72)'; g.font = '500 36px Geist-Medium, sans-serif';
  g.fillText(`${c.payouts.toLocaleString('id-ID')}x pencairan${c.since ? ` · sejak ${c.since}` : ''}`, x + 70, y + 560);
  g.fillStyle = '#FFFFFF'; g.font = '600 40px InterTight, sans-serif';
  g.fillText(c.handle ? `@${c.handle}` : c.name, x + 70, y + 630);

  // Footer.
  g.textAlign = 'center'; g.fillStyle = 'rgba(194,221,250,0.9)'; g.font = '500 34px Geist-Medium, sans-serif';
  g.fillText('Clip jadi penghasilan nyata', W / 2, H - 200);
  g.fillStyle = '#FFFFFF'; g.font = '600 42px InterTight, sans-serif';
  g.fillText('tappcreators.com', W / 2, H - 140);
  return cv;
}

// Share sheet on phones (Save Image / Instagram / WhatsApp), download elsewhere.
export async function savePayoutCard(c: PayoutCard): Promise<'shared' | 'downloaded'> {
  if (Platform.OS !== 'web') throw new Error('Simpan kartu tersedia di versi web.');
  const cv = await draw(c);
  const blob: Blob = await new Promise((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error('Gagal membuat gambar.'))), 'image/png'));
  const file = new File([blob], 'tapp-total-payout.png', { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try { await nav.share({ files: [file], title: 'Total payout TAPP' }); return 'shared'; }
    catch (e) { if ((e as Error).name === 'AbortError') return 'shared'; }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'tapp-total-payout.png'; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return 'downloaded';
}
